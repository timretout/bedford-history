export interface Era {
  id: string;
  name: string;
  from: number;
  to: number;
  /** Display form of the date range, when the dates alone would mislead. */
  span?: string;
  color: string;
}

export interface Place {
  id: string;
  name: string;
  lat: number;
  lng: number;
  /** Short street-level description shown in the panel. */
  where: string;
  /** English Wikipedia article title for the place. */
  wiki: string;
  /** True when the coordinates are estimated rather than sourced. */
  approx?: boolean;
}

export interface HistoryEvent {
  id: string;
  place: string;
  era: string;
  /** Sort key and timeline position. */
  year: number;
  /** Display form, e.g. "c. 1166" or "1660–72". */
  yearLabel: string;
  title: string;
  summary: string;
  /** Wikipedia article for the event, when it differs from the place's. */
  wiki?: string;
}

export interface History {
  eras: Era[];
  places: Place[];
  events: HistoryEvent[];
}
