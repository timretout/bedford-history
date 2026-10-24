# Bedford History

An interactive explorer for the local history of Bedford, England: a
Google Maps–style interface built on [Leaflet](https://leafletjs.com/), with
a timeline for moving through the centuries and map markers for notable
events and places, each linking to its Wikipedia article.

## Running it

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck and build into dist/
```

## How it fits together

- `src/data/history.json` holds the content: **eras**, **places** (with
  coordinates and a Wikipedia article) and **events** (each at a place, in an
  era). A place can have several events; the map shows a count badge.
- `src/state.ts` is a small store: the selected event, the era filter and
  the search query. Every component subscribes to it, and the selected event
  is mirrored in the URL hash so links are shareable (`#castle-siege`).
- `src/map.ts` (Leaflet and OpenStreetMap tiles), `src/panel.ts` (details,
  search, Wikipedia lead image), `src/timeline.ts` and `src/chips.ts` render
  from that state.

The timeline gives each era equal width, so recent centuries aren't
squashed into a sliver next to the Anglo-Saxon period.

## Adding history

Add a place and an event to `src/data/history.json`. Facts in the summaries
are drawn from the linked Wikipedia articles; coordinates come from
Wikipedia where available, and places marked `"approx": true` are estimates.

See [`sketches/`](sketches/) for the original UI mock-ups.
