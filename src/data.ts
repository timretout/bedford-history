import raw from './data/history.json';
import type { Era, History, HistoryEvent, Place } from './types';

const data = raw as History;

export const eras: Era[] = data.eras;
export const places: Place[] = data.places;
export const events: HistoryEvent[] = [...data.events].sort((a, b) => a.year - b.year);

export const eraById = new Map(eras.map((e) => [e.id, e]));
export const placeById = new Map(places.map((p) => [p.id, p]));
export const eventById = new Map(events.map((e) => [e.id, e]));

for (const ev of events) {
  if (!placeById.has(ev.place)) console.error(`Event ${ev.id}: unknown place ${ev.place}`);
  if (!eraById.has(ev.era)) console.error(`Event ${ev.id}: unknown era ${ev.era}`);
}

export function eraOf(ev: HistoryEvent): Era {
  return eraById.get(ev.era)!;
}

export function placeOf(ev: HistoryEvent): Place {
  return placeById.get(ev.place)!;
}

export function eventsAt(placeId: string): HistoryEvent[] {
  return events.filter((e) => e.place === placeId);
}

export function eraSpan(era: Era): string {
  return `${era.from}–${era.to >= new Date().getFullYear() ? 'now' : era.to}`;
}

export function wikiUrl(title: string): string {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
}

/**
 * Position on the timeline as a percentage. Each era gets an equal share of
 * the width, so recent centuries aren't squashed into a sliver.
 */
export function timelinePosition(year: number, eraId: string): number {
  const i = eras.findIndex((e) => e.id === eraId);
  const era = eras[i];
  const clamped = Math.min(Math.max(year, era.from), era.to);
  return ((i + (clamped - era.from) / (era.to - era.from)) / eras.length) * 100;
}

export function search(query: string): HistoryEvent[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return events.filter((ev) =>
    [ev.title, ev.summary, ev.yearLabel, placeOf(ev).name, placeOf(ev).where]
      .some((text) => text.toLowerCase().includes(q)),
  );
}
