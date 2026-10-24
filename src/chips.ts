import { eras } from './data';
import { selectEra, type State, type Store } from './state';
import { esc } from './util';

/** `onPick` is called when an era's chip is clicked, after it is selected. */
export function createChips(el: HTMLElement, store: Store, onPick: () => void): void {
  const options = [{ id: '', name: 'All periods', color: '#5f6368' }, ...eras];
  const chip = (o: (typeof options)[number]) => `<button type="button" class="chip" data-era="${esc(o.id)}" aria-pressed="false">
      <span class="dot" style="background:${o.color}"></span>${esc(o.name)}</button>`;
  // "All periods" sits outside the eras' scroller, so on phones they scroll beside it rather than under it.
  el.innerHTML = `${chip(options[0])}<div class="chip-scroll">${options.slice(1).map(chip).join('')}</div>`;
  const chips = [...el.querySelectorAll<HTMLElement>('.chip')];
  const scroller = el.querySelector<HTMLElement>('.chip-scroll')!;

  el.addEventListener('click', (e) => {
    const chip = (e.target as HTMLElement).closest<HTMLElement>('.chip');
    if (!chip) return;
    selectEra(store, chip.dataset.era || null);
    onPick();
  });

  function render(s: State, prev?: State): void {
    const era = options.find((o) => (o.id || null) === s.era)!;
    document.documentElement.style.setProperty('--accent', era.color);
    for (const chip of chips) chip.setAttribute('aria-pressed', String((chip.dataset.era || null) === s.era));
    if (s.era === prev?.era) return;
    // On phones the eras scroll sideways: bring the selected one to the start, beside "All periods".
    const selected = chips[options.indexOf(era)];
    const left = s.era ? scroller.scrollLeft + selected.getBoundingClientRect().left - scroller.getBoundingClientRect().left : 0;
    scroller.scrollTo({ left, behavior: prev ? 'smooth' : 'auto' });
  }

  store.subscribe(render);
  render(store.get());
}
