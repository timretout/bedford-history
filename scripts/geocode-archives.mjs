// Places the Bedford building pages from src/data/archives-index.json on the
// map, into src/data/archives-places.json for the Archives overlay. The
// address comes from the page title or the first address in the page text,
// and is geocoded with OpenStreetMap's Nominatim. Only the title, address and
// coordinates are kept, not page text.
//
// Pages already in archives-places.json are left alone, so coordinates fixed
// by hand survive a rerun; delete an entry to look it up again. Pages that
// can't be placed are kept without coordinates, skipped by the app and tried
// again on the next run.
//
//   node scripts/geocode-archives.mjs

import { readFile, writeFile } from 'node:fs/promises';

const archives = 'https://bedsarchives.bedford.gov.uk/CommunityHistories/';
const indexFile = new URL('../src/data/archives-index.json', import.meta.url);
const historyFile = new URL('../src/data/history.json', import.meta.url);
const out = new URL('../src/data/archives-places.json', import.meta.url);
const userAgent = 'bedford-history (https://timretout.github.io/bedford-history/)';

/** Sections whose pages aren't single buildings. */
const skipSections = new Set(['Communities', 'Bedford', 'Mayors of Bedford', 'Bedfordshire Training Home for Girls']);
/** Titles of pages that tell a story or list people rather than describe a building. */
const narrative = /evidence|murder|death|inquest|verdict|defence|prosecution|background|aftermath|events|witness|introduction|rectors|vicars|ministers|priors|architecture|alterations|rector(y|ies)|vicarages|education in|map of|timeline|domesday|vikings|storm|ve day|stone age|bronze age|iron age|index|in bedford$|rose & son|before|in \d{4}|maps|manor of|parish of|references|later history/i;
const streetWords = 'Street|Road|Lane|Square|Place|Row|Walk|Hill|Terrace|Avenue|Green|Way|Bridge|Embankment|Boundary';
const address = new RegExp(`\\b(\\d{1,3}[a-z]?(?:\\s*(?:-|–|&|and)\\s*\\d{1,3}[a-z]?)?,?\\s+(?:[A-Z][a-z']+\\s+){0,2}(?:${streetWords}))\\b`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const text = (html) => html
  .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
  .replace(/<[^>]*>/g, ' ')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ');

async function page(path) {
  await sleep(1000);
  const r = await fetch(archives + path, { headers: { 'User-Agent': userAgent } });
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
  // Only the main content area, not the navigation or related links.
  const html = await r.text();
  const start = html.indexOf('id="content"');
  const end = html.indexOf('sys_related_content', start);
  return text(html.slice(Math.max(0, start), end > start ? end : undefined));
}

/** Nominatim's best match in Bedford town, or null. The villages have High Streets too. */
async function geocode(q) {
  await sleep(1100);
  const params = new URLSearchParams({
    // OpenStreetMap names streets "St Cuthbert's Street", not "Saint".
    q: q.replace(/\bSaint\b/g, 'St'), format: 'jsonv2', addressdetails: '1', limit: '1', countrycodes: 'gb',
    viewbox: '-0.53,52.17,-0.39,52.1', bounded: '1',
  });
  const r = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { headers: { 'User-Agent': userAgent } });
  if (!r.ok) throw new Error(`Nominatim: HTTP ${r.status}`);
  const hit = (await r.json())[0];
  // Kempston and Clapham are inside the box but have streets of the same names,
  // and a whole suburb or village would pile every page onto one spot.
  const a = hit?.address ?? {};
  const inBedford = (a.city ?? a.town) === 'Bedford' && !a.village;
  return inBedford && !vague.has(hit.addresstype) ? hit : null;
}

const vague = new Set(['city', 'town', 'village', 'suburb', 'quarter', 'neighbourhood', 'hamlet', 'county', 'state']);
const round = (n) => Math.round(Number(n) * 1e5) / 1e5;
const firstNumber = (a) => a.replace(/^(\d+[a-z]?)\s*(?:-|–|&|and)\s*\d+[a-z]?/, '$1');

const index = JSON.parse(await readFile(indexFile, 'utf8'));
const history = JSON.parse(await readFile(historyFile, 'utf8'));
const linked = new Set(history.places.map((p) => p.archives).filter(Boolean));
let places = [];
try {
  places = JSON.parse(await readFile(out, 'utf8'));
} catch {
  // First run.
}
places = places.filter((p) => p.lat !== undefined);
const done = new Set(places.map((p) => p.page));

const todo = index.filter((x) => !skipSections.has(x.section) && !narrative.test(x.title)
  && !linked.has(x.page) && !done.has(x.page));
console.log(`${todo.length} pages to place`);

for (const { page: path, title } of todo) {
  const fromTitle = title.match(address)?.[1];
  const found = fromTitle ?? (await page(path)).match(address)?.[1];
  const place = { page: path, title: title.replace(/\s+/g, ' ').replace(/^(\d+) HIgh/, '$1 High') };
  let hit = null;
  if (found) {
    place.address = found.replace(/\s+/g, ' ');
    // For a range such as "38-40 High Street", look up the first number.
    hit = await geocode(`${firstNumber(place.address)}, Bedford`);
    // Failing the building, the middle of the street, unless the page is about
    // a house there: the street's other houses would all land on the same spot.
    if (!fromTitle) hit ??= await geocode(`${place.address.replace(/^[^A-Za-z]+/, '')}, Bedford`);
    place.approx = !hit?.address?.house_number;
  }
  if (!hit) {
    hit = await geocode(`${place.title.replace(/ Bedford$/, '')}, Bedford`);
    place.approx = !hit || hit.addresstype === 'road';
  }
  if (hit) {
    place.lat = round(hit.lat);
    place.lng = round(hit.lon);
  } else {
    delete place.approx;
  }
  if (!place.approx) delete place.approx;
  console.log(`${hit ? (place.approx ? '~' : '✓') : '✗'} ${place.title}${place.address ? ` (${place.address})` : ''}`);
  places.push(place);
}

// More than two pages on one spot means a street or district was matched, not
// each building; leave them for placing by hand.
const spots = Map.groupBy(places.filter((p) => p.lat !== undefined), (p) => `${p.lat},${p.lng}`);
for (const pile of spots.values()) {
  if (pile.length <= 2) continue;
  console.log(`✗ ${pile.length} pages on one spot: ${pile.map((p) => p.title).join(', ')}`);
  for (const p of pile) {
    delete p.lat;
    delete p.lng;
    delete p.approx;
  }
}

places.sort((a, b) => a.page.localeCompare(b.page));
await writeFile(out, '[\n' + places.map((p) => '  ' + JSON.stringify(p)).join(',\n') + '\n]\n');
const placed = places.filter((p) => p.lat !== undefined);
console.log(`${placed.length} of ${places.length} placed, ${placed.filter((p) => p.approx).length} approximately`);
