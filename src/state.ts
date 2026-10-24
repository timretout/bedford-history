import { eras, eventById, events, periodOf } from './data';
import type { HistoryEvent } from './types';

export interface State {
  /** Id of the selected event. */
  selected: string;
  /** Era filter, or null for all periods. Also zooms the timeline into the era. */
  era: string | null;
  /** Sub-period of the era to filter to, or null for the whole era. */
  period: string | null;
  /** Theme filter, or null for every event. */
  theme: string | null;
  query: string;
}

export type Filters = Pick<State, 'era' | 'period' | 'theme'>;

export type Listener = (state: State, prev: State) => void;

export class Store {
  private state: State;
  private listeners: Listener[] = [];

  constructor(initial: State) {
    this.state = initial;
  }

  get(): State {
    return this.state;
  }

  set(patch: Partial<State>): void {
    const prev = this.state;
    this.state = { ...prev, ...patch };
    for (const listener of this.listeners) listener(this.state, prev);
  }

  subscribe(listener: Listener): void {
    this.listeners.push(listener);
  }
}

export function selectedEvent(s: State): HistoryEvent {
  return eventById.get(s.selected)!;
}

/** Whether an event passes the era, period and theme filters. */
export function matches(f: Filters, ev: HistoryEvent): boolean {
  return (!f.era || ev.era === f.era)
    && (!f.period || periodOf(ev)?.id === f.period)
    && (!f.theme || !!ev.themes?.includes(f.theme));
}

export function visibleEvents(s: State): HistoryEvent[] {
  return events.filter((e) => matches(s, e));
}

export function neighbours(s: State): { prev?: HistoryEvent; next?: HistoryEvent } {
  const list = visibleEvents(s);
  const i = list.findIndex((e) => e.id === s.selected);
  return { prev: list[i - 1], next: list[i + 1] };
}

/** Select an event, dropping any filter that would hide it. */
export function selectEvent(store: Store, id: string): void {
  const ev = eventById.get(id);
  if (!ev) return;
  const s = store.get();
  const era = s.era === ev.era ? s.era : null;
  store.set({
    selected: id,
    era,
    period: era && s.period === periodOf(ev)?.id ? s.period : null,
    theme: s.theme && ev.themes?.includes(s.theme) ? s.theme : null,
  });
}

/**
 * Change filters, moving the selection into what's left if necessary. A
 * theme with nothing in the new era is dropped; filters that would leave
 * nothing at all are ignored.
 */
export function setFilters(store: Store, patch: Partial<Filters>): void {
  const s = store.get();
  const f: Filters = { era: s.era, period: s.period, theme: s.theme, ...patch };
  if (patch.era !== undefined && patch.period === undefined && patch.era !== s.era) f.period = null;
  if (f.theme && !events.some((e) => matches(f, e))) f.theme = null;
  const list = events.filter((e) => matches(f, e));
  if (!list.length) return;
  const keep = list.some((e) => e.id === s.selected);
  store.set({ ...f, selected: keep ? s.selected : list[0].id });
}

/** Filter to an era, zooming the timeline into it. */
export function selectEra(store: Store, era: string | null): void {
  setFilters(store, { era, period: null });
}

/**
 * Move the era filter to the next or previous era that has events, selecting
 * its first event going forwards or its last going back. With no era
 * filter, moves on from the selected event's era. False at either end.
 */
export function stepEra(store: Store, dir: 1 | -1): boolean {
  const s = store.get();
  let i = eras.findIndex((e) => e.id === (s.era ?? selectedEvent(s).era));
  for (i += dir; i >= 0 && i < eras.length; i += dir) {
    const era = eras[i].id;
    if (!events.some((e) => e.era === era)) continue;
    setFilters(store, { era, period: null });
    const list = visibleEvents(store.get());
    store.set({ selected: (dir === 1 ? list[0] : list[list.length - 1]).id });
    return true;
  }
  return false;
}

/** Move through visible events in time order; false at either end. */
export function step(store: Store, dir: 1 | -1): boolean {
  const { prev, next } = neighbours(store.get());
  const target = dir === 1 ? next : prev;
  if (!target) return false;
  store.set({ selected: target.id });
  return true;
}
