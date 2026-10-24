import { eraOf, eraSpan, eras, eventById, events, timelinePosition } from './data';
import { selectEra, selectEvent, selectedEvent, step, visibleEvents, type State, type Store } from './state';
import { esc, icons } from './util';

const PLAY_INTERVAL_MS = 2500;

/** Stack ticks that would overlap into extra rows. */
function tickRows(): Map<string, number> {
  const rows = new Map<string, number>();
  const lastInRow: number[] = [];
  for (const ev of events) {
    const pos = timelinePosition(ev.year, ev.era);
    let row = 0;
    while (lastInRow[row] !== undefined && pos - lastInRow[row] < 1.2) row++;
    lastInRow[row] = pos;
    rows.set(ev.id, row);
  }
  return rows;
}

export function createTimeline(el: HTMLElement, store: Store): void {
  const rows = tickRows();
  const rowCount = Math.max(...rows.values()) + 1;

  el.innerHTML = `
    <div class="tl-head">
      <button type="button" class="tl-play" aria-label="Play through time">${icons.play}</button>
      <p class="tl-now" aria-live="polite"><span class="tl-year"></span> <span class="tl-title"></span></p>
      <div class="tl-nav">
        <button type="button" class="icon-btn" data-step="-1" aria-label="Previous event">${icons.left}</button>
        <button type="button" class="icon-btn" data-step="1" aria-label="Next event">${icons.right}</button>
      </div>
      <span class="tl-note">AD 500 to today · each era drawn at equal width</span>
    </div>
    <div class="tl-track" style="--tick-rows:${rowCount}">
      <div class="tl-ticks">
        ${events.map((ev) => `<button type="button" class="tl-tick" data-event="${esc(ev.id)}"
            style="left:${timelinePosition(ev.year, ev.era)}%;--row:${rows.get(ev.id)};background:${eraOf(ev).color}"
            aria-label="${esc(`${ev.yearLabel}: ${ev.title}`)}" title="${esc(`${ev.yearLabel}: ${ev.title}`)}"></button>`).join('')}
      </div>
      <div class="tl-bands">
        ${eras.map((era) => `<button type="button" class="tl-band" data-era="${esc(era.id)}"
            style="--era:${era.color}" aria-pressed="false">
            ${esc(era.name)}<span>${eraSpan(era)}</span></button>`).join('')}
      </div>
      <div class="tl-handle" aria-hidden="true"></div>
    </div>`;

  const play = el.querySelector<HTMLButtonElement>('.tl-play')!;
  const year = el.querySelector('.tl-year')!;
  const title = el.querySelector('.tl-title')!;
  const handle = el.querySelector<HTMLElement>('.tl-handle')!;
  const ticks = [...el.querySelectorAll<HTMLElement>('.tl-tick')];
  const bands = [...el.querySelectorAll<HTMLElement>('.tl-band')];

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

  el.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-event], [data-era], [data-step]');
    if (!target) return;
    if (target.dataset.event) selectEvent(store, target.dataset.event);
    else if (target.dataset.era) selectEra(store, store.get().era === target.dataset.era ? null : target.dataset.era);
    else if (target.dataset.step) step(store, Number(target.dataset.step) as 1 | -1);
  });

  el.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      step(store, e.key === 'ArrowRight' ? 1 : -1);
    }
  });

  function render(s: State): void {
    const ev = selectedEvent(s);
    year.textContent = ev.yearLabel;
    title.textContent = ev.title;
    handle.style.left = `${timelinePosition(ev.year, ev.era)}%`;
    for (const tick of ticks) {
      const id = tick.dataset.event!;
      tick.classList.toggle('selected', id === s.selected);
      tick.classList.toggle('dimmed', !!s.era && eventById.get(id)!.era !== s.era);
    }
    for (const band of bands) {
      const id = band.dataset.era!;
      band.setAttribute('aria-pressed', String(s.era === id));
      band.classList.toggle('dimmed', !!s.era && s.era !== id);
    }
  }

  store.subscribe(render);
  render(store.get());
}
