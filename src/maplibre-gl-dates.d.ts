declare module '@openhistoricalmap/maplibre-gl-dates' {
  import type { Map } from 'maplibre-gl';
  /** Show only features that existed at some point in the given date (YYYY, YYYY-MM or YYYY-MM-DD). */
  export function filterByDate(map: Map, date: string | Date): void;
}
