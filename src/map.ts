import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { eraOf, eventsAt, places } from './data';
import type { HistoricLayer } from './historic';
import { matches, selectEvent, selectedEvent, type State, type Store } from './state';
import { esc, icons } from './util';

const START: L.LatLngTuple = [52.1362, -0.4655];

export interface MapView {
  zoomTo(placeId: string): void;
}

function pinIcon(color: string, label: string | null, count: number): L.DivIcon {
  const selected = label !== null;
  const w = selected ? 34 : 24;
  const h = selected ? 45 : 32;
  const badge = count > 1 ? `<span class="pin-count">${count}</span>` : '';
  const text = label ? `<span class="pin-label" style="color:${color}">${esc(label)}</span>` : '';
  return L.divIcon({
    className: selected ? 'pin pin-selected' : 'pin',
    iconSize: [w, h],
    iconAnchor: [w / 2, h],
    html:
      `<svg width="${w}" height="${h}" viewBox="0 0 24 32" aria-hidden="true">` +
      `<path d="M12 31C12 31 2 18.5 2 11a10 10 0 0 1 20 0c0 7.5-10 20-10 20z" fill="${color}" stroke="#fff" stroke-width="1.5"/>` +
      `<circle cx="12" cy="11" r="4" fill="#fff"/></svg>${badge}${text}`,
  });
}

const HISTORIC_KEY = 'historic-map';

function loadHistoric(): boolean {
  try {
    return localStorage.getItem(HISTORIC_KEY) === '1';
  } catch {
    return false;
  }
}

function saveHistoric(on: boolean): void {
  try {
    localStorage.setItem(HISTORIC_KEY, on ? '1' : '0');
  } catch {
    // Not remembered; the toggle still works for this visit.
  }
}

/** Map padding that keeps markers clear of the floating panel and timeline. */
function padding(): { paddingTopLeft: L.Point; paddingBottomRight: L.Point } {
  // The era chips can wrap onto several rows; leave room for a selected pin below them.
  const top = (document.getElementById('chips')?.getBoundingClientRect().bottom ?? 64) + 56;
  if (!matchMedia('(min-width: 768px)').matches) {
    return { paddingTopLeft: L.point(24, top), paddingBottomRight: L.point(24, 24) };
  }
  const panel = document.getElementById('panel')?.offsetWidth ?? 0;
  const timeline = document.getElementById('timeline')?.offsetHeight ?? 0;
  return { paddingTopLeft: L.point(panel + 48, top), paddingBottomRight: L.point(80, timeline + 64) };
}

export function createMap(el: HTMLElement, store: Store): MapView {
  const map = L.map(el, { zoomControl: false }).setView(START, 16);
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  const modern = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  });

  // OpenHistoricalMap, filtered to the selected event's year. Loaded on first use.
  let historic: HistoricLayer | null = null;
  let historicOn = loadHistoric();

  async function setBase(on: boolean): Promise<void> {
    historicOn = on;
    toggle.setAttribute('aria-pressed', String(on));
    if (on) {
      historic ??= (await import('./historic')).createHistoricLayer();
      if (!historicOn) return; // Toggled off again while loading.
      modern.remove();
      historic.layer.addTo(map);
      historic.showYear(selectedEvent(store.get()).year);
    } else {
      historic?.layer.remove();
      modern.addTo(map);
    }
  }

  const toggle = L.DomUtil.create('button', 'map-toggle');
  toggle.type = 'button';
  toggle.innerHTML = `${icons.layers}<span>Historic map</span>`;
  toggle.title = 'Show OpenHistoricalMap as it was at the selected event';
  L.DomEvent.disableClickPropagation(toggle);
  toggle.addEventListener('click', () => {
    void setBase(!historicOn);
    saveHistoric(historicOn);
  });
  new (L.Control.extend({ onAdd: () => toggle }))({ position: 'bottomright' }).addTo(map);
  void setBase(historicOn);

  const markers = new Map<string, L.Marker>();
  const iconKeys = new Map<string, string>();

  for (const place of places) {
    const marker = L.marker([place.lat, place.lng], { title: place.name, alt: place.name, riseOnHover: true });
    marker.on('click', () => {
      const s = store.get();
      const here = eventsAt(place.id).filter((e) => matches(s, e));
      if (!here.length) return;
      // Clicking the selected place again cycles through its events.
      const i = here.findIndex((e) => e.id === s.selected);
      selectEvent(store, here[(i + 1) % here.length].id);
    });
    markers.set(place.id, marker);
  }

  function render(s: State): void {
    const sel = selectedEvent(s);
    for (const place of places) {
      const marker = markers.get(place.id)!;
      const here = eventsAt(place.id).filter((e) => matches(s, e));
      if (!here.length) {
        marker.remove();
        continue;
      }
      const isSelected = sel.place === place.id;
      const color = eraOf(isSelected ? sel : here[0]).color;
      // Only swap the icon when it changes, so keyboard focus isn't lost.
      const key = `${color}|${isSelected}|${here.length}`;
      if (iconKeys.get(place.id) !== key) {
        marker.setIcon(pinIcon(color, isSelected ? place.name : null, here.length));
        marker.setZIndexOffset(isSelected ? 1000 : 0);
        iconKeys.set(place.id, key);
      }
      if (!map.hasLayer(marker)) marker.addTo(map);
    }
  }

  function reveal(s: State, animate: boolean): void {
    map.panInside(markers.get(selectedEvent(s).place)!.getLatLng(), { ...padding(), animate });
  }

  store.subscribe((s, prev) => {
    render(s);
    if (historicOn) historic?.showYear(selectedEvent(s).year);
    if (selectedEvent(s).place !== selectedEvent(prev).place) reveal(s, true);
  });
  render(store.get());
  reveal(store.get(), false);

  return {
    zoomTo(placeId) {
      const marker = markers.get(placeId);
      if (marker) map.flyTo(marker.getLatLng(), 18);
    },
  };
}
