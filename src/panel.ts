import { eraOf, eraSpan, eventsAt, placeOf, search, wikiUrl } from './data';
import type { MapView } from './map';
import { neighbours, selectEvent, selectedEvent, type State, type Store } from './state';
import type { HistoryEvent } from './types';
import { esc, icons } from './util';

const thumbnails = new Map<string, Promise<string | null>>();

/** Lead image for a Wikipedia article, via the REST summary endpoint. */
function thumbnail(title: string): Promise<string | null> {
  let p = thumbnails.get(title);
  if (!p) {
    p = fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j?.thumbnail?.source ?? null)
      .catch(() => null);
    thumbnails.set(title, p);
  }
  return p;
}

function eventButton(ev: HistoryEvent, extra = ''): string {
  return `<button type="button" class="event-link" data-event="${esc(ev.id)}">
    <span class="dot" style="background:${eraOf(ev).color}"></span>
    <span><strong>${esc(ev.yearLabel)}</strong> · ${esc(ev.title)}${extra}</span>
  </button>`;
}

function details(s: State): string {
  const ev = selectedEvent(s);
  const place = placeOf(ev);
  const era = eraOf(ev);
  const { prev, next } = neighbours(s);
  const others = eventsAt(place.id).filter((e) => e.id !== ev.id);
  const links = [place.wiki, ev.wiki].filter((t, i, all): t is string => !!t && all.indexOf(t) === i);

  return `
    <figure class="photo"><span class="photo-empty">${esc(place.name)}</span></figure>
    <header class="place-head">
      <h1>${esc(place.name)}</h1>
      <p class="meta"><span class="dot" style="background:${era.color}"></span>${esc(era.name)} · ${esc(ev.yearLabel)}</p>
    </header>
    <div class="actions">
      <a class="action primary" href="${wikiUrl(ev.wiki ?? place.wiki)}" target="_blank" rel="noopener">
        <span class="action-icon">${icons.wiki}</span>Wikipedia</a>
      <button type="button" class="action" data-action="zoom"><span class="action-icon">${icons.zoom}</span>Zoom in</button>
      <button type="button" class="action" data-action="share"><span class="action-icon">${icons.share}</span><span class="share-label">Share</span></button>
    </div>
    <section class="event">
      <h2>${esc(ev.title)}</h2>
      <p>${esc(ev.summary)}</p>
    </section>
    <ul class="rows">
      <li>${icons.pin}<span>${esc(place.where)}${place.approx ? ' <em>(approximate location)</em>' : ''}</span></li>
      <li>${icons.calendar}<span>${esc(ev.yearLabel)} · ${esc(era.name)} (${eraSpan(era)})</span></li>
      ${links.map((t) => `<li>${icons.external}<a href="${wikiUrl(t)}" target="_blank" rel="noopener">Wikipedia: ${esc(t)}</a></li>`).join('')}
    </ul>
    ${others.length ? `<section class="list"><h2>Also at this place</h2>${others.map((e) => eventButton(e)).join('')}</section>` : ''}
    <section class="list">
      <h2>Through time${s.era ? ` <span class="muted">· ${esc(era.name)} only</span>` : ''}</h2>
      ${prev ? eventButton(prev) : ''}
      ${next ? eventButton(next) : ''}
    </section>`;
}

function results(s: State): string {
  const found = search(s.query);
  if (!found.length) return `<p class="empty">No events match “${esc(s.query.trim())}”.</p>`;
  return `<section class="list results"><h2>${found.length} result${found.length === 1 ? '' : 's'}</h2>
    ${found.map((e) => eventButton(e, `<br><span class="muted">${esc(placeOf(e).name)}</span>`)).join('')}</section>`;
}

export function createPanel(el: HTMLElement, store: Store, mapView: MapView): void {
  el.innerHTML = `
    <form class="search" role="search">
      <label for="search" class="sr-only">Search Bedford's history</label>
      <input id="search" type="search" placeholder="Search Bedford's history" autocomplete="off">
      <button type="submit" class="icon-btn" aria-label="Search">${icons.search}</button>
    </form>
    <div class="panel-body"></div>`;
  const form = el.querySelector('form')!;
  const input = el.querySelector('input')!;
  const body = el.querySelector<HTMLElement>('.panel-body')!;

  const clearSearch = () => {
    input.value = '';
    store.set({ query: '' });
  };

  input.addEventListener('input', () => store.set({ query: input.value }));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const [first] = search(input.value);
    if (first) {
      clearSearch();
      selectEvent(store, first.id);
    }
  });

  body.addEventListener('click', async (e) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-event], [data-action]');
    if (!target) return;
    if (target.dataset.event) {
      if (store.get().query) clearSearch();
      selectEvent(store, target.dataset.event);
    } else if (target.dataset.action === 'zoom') {
      mapView.zoomTo(selectedEvent(store.get()).place);
    } else if (target.dataset.action === 'share') {
      const ev = selectedEvent(store.get());
      if (navigator.share) {
        await navigator.share({ title: ev.title, url: location.href }).catch(() => {});
      } else {
        await navigator.clipboard.writeText(location.href);
        target.querySelector('.share-label')!.textContent = 'Link copied';
      }
    }
  });

  function render(s: State): void {
    if (s.query.trim()) {
      body.innerHTML = results(s);
      return;
    }
    body.innerHTML = details(s);
    body.scrollTop = 0;
    const place = placeOf(selectedEvent(s));
    thumbnail(place.wiki).then((src) => {
      const figure = body.querySelector('.photo');
      if (!src || !figure || placeOf(selectedEvent(store.get())).id !== place.id) return;
      figure.innerHTML = `<img src="${esc(src)}" alt="${esc(place.name)}">
        <figcaption><a href="${wikiUrl(place.wiki)}" target="_blank" rel="noopener">Image via Wikipedia</a></figcaption>`;
    });
  }

  store.subscribe((s, prev) => {
    if (s.selected !== prev.selected || s.era !== prev.era || s.query !== prev.query) render(s);
  });
  render(store.get());
}
