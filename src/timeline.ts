import { eraById, eraOf, eraSpan, eras, eventById, events, periodOf, timelinePosition, zoomedPosition } from './data';
import { matches, selectEra, selectEvent, selectedEvent, setFilters, step, visibleEvents, type State, type Store } from './state';
import type { Era, HistoryEvent } from './types';
import { esc, icons } from './util';

const PLAY_INTERVAL_MS = 2500;

/** Stack ticks that would overlap into extra rows. */
function tickRows(list: HistoryEvent[], position: (ev: HistoryEvent) => number): Map<string, number> {
  const rows = new Map<string, number>();
  const lastInRow: number[] = [];
  for (const ev of list) {
    const pos = position(ev);
    let row = 0;
    while (lastInRow[row] !== undefined && pos - lastInRow[row] < 1.2) row++;
    lastInRow[row] = pos;
    rows.set(ev.id, row);
  }
  return rows;
}

/** Ticks and bands for every era, or for the periods of one era when zoomed in. */
function track(zoom: Era | null): string {
  const list = zoom ? events.filter((e) => e.era === zoom.id) : events;
  const position = zoom ? zoomedPosition : timelinePosition;
  const rows = tickRows(list, position);
  const rowCount = Math.max(0, ...rows.values()) + 1;

  let bands: string;
  if (!zoom) {
    bands = eras.map((era) => `<button type="button" class="tl-band" data-era="${esc(era.id)}"
        style="--era:${era.color}" aria-label="${esc(`Zoom into ${era.name}`)}">
        ${esc(era.name)}<span>${eraSpan(era)}</span></button>`).join('');
  } else if (zoom.periods) {
    bands = zoom.periods.map((p) => {
      const count = list.filter((e) => periodOf(e) === p).length;
      return `<button type="button" class="tl-band" data-period="${esc(p.id)}" style="--era:${zoom.color}"
          aria-pressed="false" ${count ? '' : 'disabled title="No events yet"'}>
          ${esc(p.name)}<span>${eraSpan(p)}</span></button>`;
    }).join('');
  } else {
    bands = `<div class="tl-band" style="--era:${zoom.color}">${esc(zoom.name)}<span>${eraSpan(zoom)} · drawn to scale</span></div>`;
  }

  return `
    <div class="tl-ticks" style="--tick-rows:${rowCount}">
      ${list.map((ev) => `<button type="button" class="tl-tick" data-event="${esc(ev.id)}"
          style="left:${position(ev)}%;--row:${rows.get(ev.id)};background:${eraOf(ev).color}"
          aria-label="${esc(`${ev.yearLabel}: ${ev.title}`)}" title="${esc(`${ev.yearLabel}: ${ev.title}`)}"></button>`).join('')}
    </div>
    <div class="tl-bands">${bands}</div>
    <div class="tl-handle" aria-hidden="true"></div>`;
}

/** Where the timeline is zoomed to, with links back out. */
function crumbs(s: State): string {
  const era = s.era ? eraById.get(s.era)! : null;
  if (!era) return '<span class="tl-hint">Stone Age to today · each era drawn at equal width · click an era to zoom in</span>';
  const period = era.periods?.find((p) => p.id === s.period);
  const sep = '<span aria-hidden="true">›</span>';
  return `<button type="button" class="tl-crumb" data-zoom="all">${icons.left}All time</button> ${sep}
    ${period ? `<button type="button" class="tl-crumb" data-zoom="era">${esc(era.name)}</button> ${sep} <strong>${esc(period.name)}</strong>`
      : `<strong>${esc(era.name)}</strong>`}`;
}

export function createTimeline(el: HTMLElement, store: Store): void {
  el.innerHTML = `
    <div class="tl-head">
      <button type="button" class="tl-play" aria-label="Play through time">${icons.play}</button>
      <p class="tl-now" aria-live="polite"><span class="tl-year"></span> <span class="tl-title"></span></p>
      <div class="tl-nav">
        <button type="button" class="icon-btn" data-step="-1" aria-label="Previous event">${icons.left}</button>
        <button type="button" class="icon-btn" data-step="1" aria-label="Next event">${icons.right}</button>
      </div>
      <nav class="tl-note" aria-label="Timeline zoom"></nav>
    </div>
    <div class="tl-track"></div>`;

  const play = el.querySelector<HTMLButtonElement>('.tl-play')!;
  const year = el.querySelector('.tl-year')!;
  const title = el.querySelector('.tl-title')!;
  const note = el.querySelector<HTMLElement>('.tl-note')!;
  const trackEl = el.querySelector<HTMLElement>('.tl-track')!;
  let zoomed: string | null | undefined;

  let timer: number | undefined;
  const stop = () => {
    clearInterval(timer);
    timer = undefined;
    play.innerHTML = icons.play;
    play.setAttribute('aria-label', 'Play through time');
  };
  play.addEventListener('click', () => {
    if (timer !== undefined) return stop();
    const s = store.get();
    const list = visibleEvents(s);
    if (list[list.length - 1]?.id === s.selected) store.set({ selected: list[0].id });
    timer = window.setInterval(() => {
      if (!step(store, 1)) stop();
    }, PLAY_INTERVAL_MS);
    play.innerHTML = icons.pause;
    play.setAttribute('aria-label', 'Pause');
  });

  const zoomOut = () => {
    const s = store.get();
    if (s.period) setFilters(store, { period: null });
    else if (s.era) selectEra(store, null);
  };

  el.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-event], [data-era], [data-period], [data-step], [data-zoom]');
    if (!target) return;
    const s = store.get();
    if (target.dataset.event) selectEvent(store, target.dataset.event);
    else if (target.dataset.era) selectEra(store, target.dataset.era);
    else if (target.dataset.period) setFilters(store, { period: s.period === target.dataset.period ? null : target.dataset.period });
    else if (target.dataset.step) step(store, Number(target.dataset.step) as 1 | -1);
    else if (target.dataset.zoom === 'all') selectEra(store, null);
    else if (target.dataset.zoom === 'era') setFilters(store, { period: null });
  });

  el.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      step(store, e.key === 'ArrowRight' ? 1 : -1);
    } else if (e.key === 'Escape') {
      zoomOut();
    }
  });

  function render(s: State): void {
    if (s.era !== zoomed) {
      const into = s.era ? eraById.get(s.era)! : null;
      const from = zoomed ? eras.findIndex((e) => e.id === zoomed) : -1;
      trackEl.innerHTML = track(into);
      // Grow out of (or shrink back into) the era's slot on the overview.
      const slot = into ? eras.indexOf(into) : from;
      trackEl.style.setProperty('--zoom-origin', `${((slot + 0.5) / eras.length) * 100}%`);
      trackEl.classList.remove('zoom-in', 'zoom-out');
      if (zoomed !== undefined) {
        void trackEl.offsetWidth;
        trackEl.classList.add(into ? 'zoom-in' : 'zoom-out');
      }
      zoomed = s.era;
    }

    const ev = selectedEvent(s);
    year.textContent = ev.yearLabel;
    title.textContent = ev.title;
    note.innerHTML = crumbs(s);
    const handle = trackEl.querySelector<HTMLElement>('.tl-handle')!;
    handle.style.left = `${(s.era ? zoomedPosition : timelinePosition)(ev)}%`;
    for (const tick of trackEl.querySelectorAll<HTMLElement>('.tl-tick')) {
      const id = tick.dataset.event!;
      tick.classList.toggle('selected', id === s.selected);
      tick.classList.toggle('dimmed', !matches(s, eventById.get(id)!));
    }
    for (const band of trackEl.querySelectorAll<HTMLElement>('.tl-band[data-period]')) {
      const id = band.dataset.period!;
      band.setAttribute('aria-pressed', String(s.period === id));
      band.classList.toggle('dimmed', !!s.period && s.period !== id);
    }
  }

  store.subscribe(render);
  render(store.get());
}
