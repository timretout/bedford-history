import { eras } from './data';
import { selectEra, type State, type Store } from './state';
import { esc } from './util';

export function createChips(el: HTMLElement, store: Store): void {
  const options = [{ id: '', name: 'All periods', color: '#5f6368' }, ...eras];
  el.innerHTML = options
    .map((o) => `<button type="button" class="chip" data-era="${esc(o.id)}" aria-pressed="false">
        <span class="dot" style="background:${o.color}"></span>${esc(o.name)}</button>`)
    .join('');
  const chips = [...el.querySelectorAll<HTMLElement>('.chip')];

  el.addEventListener('click', (e) => {
    const chip = (e.target as HTMLElement).closest<HTMLElement>('.chip');
    if (chip) selectEra(store, chip.dataset.era || null);
  });

  function render(s: State, prev?: State): void {
    const era = options.find((o) => (o.id || null) === s.era)!;
    document.documentElement.style.setProperty('--accent', era.color);
    for (const chip of chips) chip.setAttribute('aria-pressed', String((chip.dataset.era || null) === s.era));
    if (s.era === prev?.era) return;
    // On phones the chips scroll sideways: bring the selected era up beside "All periods".
    const chip = chips[options.indexOf(era)];
    const all = chips[0];
    // Measure on screen: "All periods" is sticky, so its offsetLeft moves as the chips scroll.
    const left = s.era ? el.scrollLeft + chip.getBoundingClientRect().left - all.getBoundingClientRect().right - 8 : 0;
    el.scrollTo({ left, behavior: prev ? 'smooth' : 'auto' });
  }

  store.subscribe(render);
  render(store.get());
}
