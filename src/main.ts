import './style.css';
import { createChips } from './chips';
import { eventById } from './data';
import { createMap } from './map';
import { createPanel } from './panel';
import { selectEvent, selectedEvent, Store } from './state';
import { createTimeline } from './timeline';

const DEFAULT_EVENT = 'castle-siege';

function eventFromHash(): string | null {
  const id = decodeURIComponent(location.hash.slice(1));
  return eventById.has(id) ? id : null;
}

const store = new Store({ selected: eventFromHash() ?? DEFAULT_EVENT, era: null, query: '' });

// Timeline before the map: the map measures its height to keep markers in view.
createChips(document.getElementById('chips')!, store);
createTimeline(document.getElementById('timeline')!, store);
const mapView = createMap(document.getElementById('map')!, store);
createPanel(document.getElementById('panel')!, store, mapView);

function syncLocation(): void {
  const ev = selectedEvent(store.get());
  history.replaceState(null, '', `#${ev.id}`);
  document.title = `${ev.title} · Bedford History`;
}

store.subscribe((s, prev) => {
  if (s.selected !== prev.selected) syncLocation();
});
syncLocation();

window.addEventListener('hashchange', () => {
  const id = eventFromHash();
  if (id && id !== store.get().selected) selectEvent(store, id);
});
