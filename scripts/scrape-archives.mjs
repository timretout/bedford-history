// Lists pages of the Bedfordshire Archives' Community Histories into
// src/data/archives-index.json: the index page of every community, and every
// page the Bedford sections link to. Only titles and URLs are kept, not page
// text. Paths are relative to the CommunityHistories folder.
//
//   node scripts/scrape-archives.mjs

import { writeFile } from 'node:fs/promises';

const base = 'https://bedsarchives.bedford.gov.uk/CommunityHistories/';
const alphabet = ['A-to-B', 'C-to-D', 'E-to-H', 'I-to-P', 'R-to-S', 'T-to-Z'].map((r) => `Community-Histories-${r}.aspx`);
const bedford = 'Bedford/BedfordIndexOfPages.aspx';
const out = new URL('../src/data/archives-index.json', import.meta.url);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const decode = (s) => s
  .replace(/<[^>]*>/g, '')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&#39;|&rsquo;/g, "'")
  .replace(/&quot;/g, '"')
  .replace(/\s+/g, ' ')
  .trim();

async function get(page) {
  await sleep(1000);
  const r = await fetch(base + page, { headers: { 'User-Agent': 'bedford-history (https://timretout.github.io/bedford-history/)' } });
  if (!r.ok) throw new Error(`${page}: HTTP ${r.status}`);
  return r.text();
}

/** Links to pages in a community's folder, as [page, link text] pairs. */
function links(html) {
  const found = [];
  for (const [, href, text] of html.matchAll(/<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const url = new URL(href, base);
    if (!url.href.startsWith(base)) continue;
    const page = decodeURIComponent(url.pathname.slice(new URL(base).pathname.length));
    if (page.includes('/') && page.endsWith('.aspx') && !page.startsWith('Roll-of-Honour/')) found.push([page, decode(text)]);
  }
  return found;
}

const pages = new Map();
const add = (page, title, section) => {
  if (title && !pages.has(page)) pages.set(page, { page, title, section });
};

for (const range of alphabet) {
  for (const [page, title] of links(await get(range))) add(page, title, 'Communities');
}

// The narrative pages mention places in passing, so a page is credited to the
// listing sections first.
const narrative = (page) => /Introduction|Timeline/.test(page);
const sections = [...new Map(links(await get(bedford)).filter(([page]) => page !== bedford))]
  .sort(([a], [b]) => narrative(a) - narrative(b));
for (const [section, sectionTitle] of sections) {
  add(section, sectionTitle, 'Bedford');
  for (const [page, title] of links(await get(section))) add(page, title, sectionTitle);
}

const list = [...pages.values()].sort((a, b) => a.page.localeCompare(b.page));
await writeFile(out, JSON.stringify(list, null, 2) + '\n');
console.log(`${list.length} pages written to ${out.pathname}`);
