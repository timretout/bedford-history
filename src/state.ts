import { eventById, events } from './data';
import type { HistoryEvent } from './types';

export interface State {
  /** Id of the selected event. */
  selected: string;
  /** Era filter, or null for all periods. */
  era: string | null;
  query: string;
}

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

export function visibleEvents(s: State): HistoryEvent[] {
  return s.era ? events.filter((e) => e.era === s.era) : events;
}

export function neighbours(s: State): { prev?: HistoryEvent; next?: HistoryEvent } {
  const list = visibleEvents(s);
  const i = list.findIndex((e) => e.id === s.selected);
  return { prev: list[i - 1], next: list[i + 1] };
}

/** Select an event, dropping the era filter if it would hide it. */
export function selectEvent(store: Store, id: string): void {
  const ev = eventById.get(id);
  if (!ev) return;
  const { era } = store.get();
  store.set({ selected: id, era: era && era !== ev.era ? null : era });
}

/** Filter to an era, moving the selection into it if necessary. */
export function selectEra(store: Store, era: string | null): void {
  const s = store.get();
  if (era && selectedEvent(s).era !== era) {
    const first = events.find((e) => e.era === era);
    store.set({ era, selected: first?.id ?? s.selected });
  } else {
    store.set({ era });
  }
}

/** Move through visible events in time order; false at either end. */
export function step(store: Store, dir: 1 | -1): boolean {
  const { prev, next } = neighbours(store.get());
  const target = dir === 1 ? next : prev;
  if (!target) return false;
  store.set({ selected: target.id });
  return true;
}
