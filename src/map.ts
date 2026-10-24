import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { eraOf, eventsAt, places } from './data';
import type { HistoricLayer } from './historic';
import { matches, selectEvent, selectedEvent, type State, type Store } from './state';
import { esc, icons } from './util';

const START: L.LatLngTuple = [52.1362, -0.4655];
/** Bedford Borough with a generous margin; the map won't pan beyond it. */
const BOUNDS = L.latLngBounds([51.95, -0.9], [52.42, -0.02]);
/** Bedford Borough itself, for the overview. */
const BOROUGH = L.latLngBounds([52.06, -0.67], [52.33, -0.3]);

export interface MapView {
  zoomTo(placeId: string): void;
  /** Pan so the place sits in the middle of the area left clear by the panel and timeline. */
  centreOn(placeId: string): void;
  /** Zoom out to show the whole borough. */
  overview(): void;
  /** Run `fn` without the map following the selection. */
  keepView(fn: () => void): void;
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

/** Base maps to choose between in the layers menu. */
const BASES = [
  { id: 'osm', name: 'OpenStreetMap', note: 'Today' },
  { id: 'ohm', name: 'OpenHistoricalMap', note: 'As it was at the selected event' },
] as const;
type BaseId = (typeof BASES)[number]['id'];

const BASE_KEY = 'base-map';

function loadBase(): BaseId {
  try {
    const id = localStorage.getItem(BASE_KEY);
    return BASES.find((b) => b.id === id)?.id ?? 'osm';
  } catch {
    return 'osm';
  }
}

function saveBase(id: BaseId): void {
  try {
    localStorage.setItem(BASE_KEY, id);
  } catch {
    // Not remembered; the choice still applies for this visit.
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
  const map = L.map(el, { zoomControl: false, maxBounds: BOUNDS, maxBoundsViscosity: 1, minZoom: 10 }).setView(START, 16);
  L.control.zoom({ position: 'topright' }).addTo(map);
  const modern = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  });

  // OpenHistoricalMap, filtered to the selected event's year. Loaded on first use.
  let historic: HistoricLayer | null = null;
  let base = loadBase();

  async function setBase(id: BaseId): Promise<void> {
    base = id;
    for (const input of inputs) input.checked = input.value === id;
    if (id === 'ohm') {
      historic ??= (await import('./historic')).createHistoricLayer();
      if (base !== 'ohm') return; // Changed again while loading.
      modern.remove();
      historic.layer.addTo(map);
      historic.showYear(selectedEvent(store.get()).year);
    } else {
      historic?.layer.remove();
      modern.addTo(map);
    }
  }

  // Layers button with a menu of base maps.
  const control = L.DomUtil.create('div', 'leaflet-bar map-layers');
  control.innerHTML = `
    <button type="button" class="map-layers-btn" aria-label="Base map" title="Base map" aria-expanded="false" aria-controls="map-layers-menu">${icons.layers}</button>
    <fieldset id="map-layers-menu" class="map-layers-menu" hidden>
      <legend>Base map</legend>
      ${BASES.map((b) => `<label><input type="radio" name="base-map" value="${b.id}">
        <span>${b.name}<small>${b.note}</small></span></label>`).join('')}
    </fieldset>`;
  const button = control.querySelector<HTMLButtonElement>('.map-layers-btn')!;
  const menu = control.querySelector<HTMLElement>('.map-layers-menu')!;
  const inputs = [...control.querySelectorAll<HTMLInputElement>('input')];
  L.DomEvent.disableClickPropagation(control);
  L.DomEvent.disableScrollPropagation(control);

  const setOpen = (open: boolean) => {
    menu.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
  };
  button.addEventListener('click', () => setOpen(button.getAttribute('aria-expanded') !== 'true'));
  control.addEventListener('change', (e) => {
    const id = (e.target as HTMLInputElement).value as BaseId;
    void setBase(id);
    saveBase(id);
    setOpen(false);
  });
  control.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.hidden) {
      setOpen(false);
      button.focus();
    }
  });
  document.addEventListener('click', (e) => {
    if (!control.contains(e.target as Node)) setOpen(false);
  });
  new (L.Control.extend({ onAdd: () => control }))({ position: 'topright' }).addTo(map);
  void setBase(base);

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

  let following = true;

  store.subscribe((s, prev) => {
    render(s);
    if (base === 'ohm') historic?.showYear(selectedEvent(s).year);
    if (following && selectedEvent(s).place !== selectedEvent(prev).place) reveal(s, true);
  });
  render(store.get());
  reveal(store.get(), false);

  return {
    zoomTo(placeId) {
      const marker = markers.get(placeId);
      if (marker) map.flyTo(marker.getLatLng(), 18);
    },
    overview() {
      map.flyToBounds(BOROUGH, padding());
    },
    keepView(fn) {
      following = false;
      try {
        fn();
      } finally {
        following = true;
      }
    },
    centreOn(placeId) {
      const marker = markers.get(placeId);
      if (!marker) return;
      const { paddingTopLeft: tl, paddingBottomRight: br } = padding();
      const zoom = map.getZoom();
      const offset = L.point((tl.x - br.x) / 2, (tl.y - br.y) / 2);
      map.flyTo(map.unproject(map.project(marker.getLatLng(), zoom).subtract(offset), zoom), zoom);
    },
  };
}
