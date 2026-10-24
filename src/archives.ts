import L from 'leaflet';
import { archivesUrl } from './data';
import places from './data/archives-places.json';
import { esc } from './util';

interface ArchivesPlace {
  page: string;
  title: string;
  address?: string;
  lat?: number;
  lng?: number;
  /** True when only the street was found, not the building. */
  approx?: boolean;
}

export type ArchivesLayer = L.LayerGroup;

/** A dot for each Bedfordshire Archives Community Histories page about a building. */
export function createArchivesLayer(): ArchivesLayer {
  const layer = L.layerGroup();
  for (const p of places as ArchivesPlace[]) {
    if (p.lat === undefined || p.lng === undefined) continue;
    const note = [p.address !== p.title && p.address, p.approx && 'approximate location'].filter(Boolean).join(' · ');
    L.circleMarker([p.lat, p.lng], {
      radius: 5, weight: 1.5, color: '#fff', fillColor: '#5f6368', fillOpacity: 0.9,
    })
      .bindTooltip(esc(p.title))
      .bindPopup(`<strong>${esc(p.title)}</strong>${note ? `<p>${esc(note)}</p>` : ''}
        <a href="${archivesUrl(p.page)}" target="_blank" rel="noopener">Bedfordshire Archives: Community Histories</a>`,
        { className: 'archives-popup' })
      .addTo(layer);
  }
  return layer;
}
