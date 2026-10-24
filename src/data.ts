import raw from './data/history.json';
import type { Era, History, HistoryEvent, Period, Place, Theme } from './types';

const data = raw as History;

export const eras: Era[] = data.eras;
export const themes: Theme[] = data.themes;
export const places: Place[] = data.places;
export const events: HistoryEvent[] = [...data.events].sort((a, b) => a.year - b.year);

export const eraById = new Map(eras.map((e) => [e.id, e]));
export const themeById = new Map(themes.map((t) => [t.id, t]));
export const placeById = new Map(places.map((p) => [p.id, p]));
export const eventById = new Map(events.map((e) => [e.id, e]));

for (const ev of events) {
  if (!placeById.has(ev.place)) console.error(`Event ${ev.id}: unknown place ${ev.place}`);
  if (!eraById.has(ev.era)) console.error(`Event ${ev.id}: unknown era ${ev.era}`);
  for (const t of ev.themes ?? []) if (!themeById.has(t)) console.error(`Event ${ev.id}: unknown theme ${t}`);
}

for (const era of eras) {
  const ps = era.periods ?? [];
  if (ps.length && (ps[0].from !== era.from || ps[ps.length - 1].to !== era.to || ps.some((p, i) => i && p.from !== ps[i - 1].to))) {
    console.error(`Era ${era.id}: periods should run end to end from ${era.from} to ${era.to}`);
  }
}

export function eraOf(ev: HistoryEvent): Era {
  return eraById.get(ev.era)!;
}

export function placeOf(ev: HistoryEvent): Place {
  return placeById.get(ev.place)!;
}

/** The sub-period of its era that an event falls in, if the era has periods. */
export function periodOf(ev: HistoryEvent): Period | undefined {
  const ps = eraOf(ev).periods ?? [];
  return ps.find((p, i) => ev.year < p.to || i === ps.length - 1);
}

export function themesOf(ev: HistoryEvent): Theme[] {
  return (ev.themes ?? []).map((t) => themeById.get(t)!).filter(Boolean);
}

export function eventsAt(placeId: string): HistoryEvent[] {
  return events.filter((e) => e.place === placeId);
}

export function eraSpan(era: Era | Period): string {
  if ('span' in era && era.span) return era.span;
  if (era.to <= 0) return `${-era.from}–${-era.to} BC`;
  if (era.from < 0) return `${-era.from} BC–AD ${era.to}`;
  return `${era.from}–${era.to >= new Date().getFullYear() ? 'now' : era.to}`;
}

export function wikiUrl(title: string): string {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
}

/** Position as a percentage along spans drawn at equal width, within span `i`. */
function spanPosition(year: number, spans: { from: number; to: number }[], i: number): number {
  const { from, to } = spans[i];
  const clamped = Math.min(Math.max(year, from), to);
  return ((i + (clamped - from) / (to - from)) / spans.length) * 100;
}

/**
 * Position on the timeline as a percentage. Each era gets an equal share of
 * the width, so recent centuries aren't squashed into a sliver.
 */
export function timelinePosition(ev: HistoryEvent): number {
  return spanPosition(ev.year, eras, eras.findIndex((e) => e.id === ev.era));
}

/**
 * Position on the timeline when zoomed into the event's era: each of the
 * era's periods gets an equal share, or the era is drawn to scale if it has none.
 */
export function zoomedPosition(ev: HistoryEvent): number {
  const era = eraOf(ev);
  const period = periodOf(ev);
  return period ? spanPosition(ev.year, era.periods!, era.periods!.indexOf(period)) : spanPosition(ev.year, [era], 0);
}

export function search(query: string): HistoryEvent[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return events.filter((ev) =>
    [ev.title, ev.summary, ev.yearLabel, placeOf(ev).name, placeOf(ev).where]
      .some((text) => text.toLowerCase().includes(q)),
  );
}
