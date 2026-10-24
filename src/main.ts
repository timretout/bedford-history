import './style.css';
import { createChips } from './chips';
import { eraById, eventById, themeById } from './data';
import { createMap } from './map';
import { createPanel } from './panel';
import { selectEvent, selectedEvent, setFilters, Store, type Filters, type State } from './state';
import { createTimeline } from './timeline';

const DEFAULT_EVENT = 'castle-siege';

/** Read `#event-id?era=…&period=…&theme=…`, ignoring anything unknown. */
function fromHash(): { selected: string; filters: Filters } | null {
  const [id, query = ''] = location.hash.slice(1).split('?');
  const selected = decodeURIComponent(id);
  if (!eventById.has(selected)) return null;
  const q = new URLSearchParams(query);
  const era = eraById.get(q.get('era') ?? '');
  const period = era?.periods?.find((p) => p.id === q.get('period'));
  const theme = themeById.get(q.get('theme') ?? '');
  return { selected, filters: { era: era?.id ?? null, period: period?.id ?? null, theme: theme?.id ?? null } };
}

function toHash(s: State): string {
  const q = new URLSearchParams();
  if (s.era) q.set('era', s.era);
  if (s.period) q.set('period', s.period);
  if (s.theme) q.set('theme', s.theme);
  return `#${s.selected}${q.size ? `?${q}` : ''}`;
}

const initial = fromHash();
const store = new Store({ selected: initial?.selected ?? DEFAULT_EVENT, era: null, period: null, theme: null, query: '' });
if (initial) setFilters(store, initial.filters);

// Timeline before the map: the map measures its height to keep markers in view.
createChips(document.getElementById('chips')!, store);
createTimeline(document.getElementById('timeline')!, store);
const mapView = createMap(document.getElementById('map')!, store);
createPanel(document.getElementById('panel')!, store, mapView);

function syncLocation(): void {
  const s = store.get();
  history.replaceState(null, '', toHash(s));
  document.title = `${selectedEvent(s).title} · Bedford History`;
}

store.subscribe((s, prev) => {
  if (s.selected !== prev.selected || s.era !== prev.era || s.period !== prev.period || s.theme !== prev.theme) syncLocation();
});
syncLocation();

window.addEventListener('hashchange', () => {
  const next = fromHash();
  if (!next) return;
  selectEvent(store, next.selected);
  setFilters(store, next.filters);
});
