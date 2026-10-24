// OpenHistoricalMap as a Leaflet layer. Loaded on demand, as MapLibre is large.
import L from 'leaflet';
import '@maplibre/maplibre-gl-leaflet';
import { setWorkerUrl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { filterByDate } from '@openhistoricalmap/maplibre-gl-dates';

// MapLibre finds its worker next to its own module, which bundling breaks.
setWorkerUrl(workerUrl);

const OHM_STYLE = 'https://www.openhistoricalmap.org/map-styles/main/main.json';

export interface HistoricLayer {
  layer: L.Layer;
  /** Show only what existed in the given year (negative for BC). */
  showYear(year: number): void;
}

/** An event year as an OpenHistoricalMap date: astronomical, so 1 BC is year 0, and at most four digits. */
function ohmDate(year: number): string {
  const y = Math.max(year < 0 ? year + 1 : year, -9999);
  return `${y < 0 ? '-' : ''}${String(Math.abs(y)).padStart(4, '0')}`;
}

export function createHistoricLayer(): HistoricLayer {
  const layer = L.maplibreGL({
    style: OHM_STYLE,
    // The bridge passes this to Leaflet's attribution control.
    attributionControl: {
      customAttribution: '&copy; <a href="https://www.openhistoricalmap.org/copyright">OpenHistoricalMap</a> contributors',
    },
  });
  let year: number | null = null;

  return {
    layer,
    showYear(next) {
      // MapLibre only exists once the layer is on a map.
      const gl = layer.getMaplibreMap();
      if (!gl || next === year) return;
      year = next;
      // The style loads asynchronously; filter once it has, or straight away if it already has.
      if (gl.isStyleLoaded()) filterByDate(gl, ohmDate(year));
      else gl.once('styledata', () => filterByDate(gl, ohmDate(year!)));
    },
  };
}
