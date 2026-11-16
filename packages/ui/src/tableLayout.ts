import { seatRingFits } from './SeatRing';

export const TABLE_BAR_HEIGHT = 56;

export type TableMode = 'ring' | 'side' | 'rail' | 'bar';

export interface TableLayoutInput {
  width: number;
  height: number;
  seats: number;
  seatsAround?: boolean;
  seatsOnBoard?: boolean;
  fullBleed?: boolean;
}

export interface TableLayout {
  /** ring: Sitzring · side: Leiste links · rail: ☰-Schiene links (quer) · bar: ☰-Zeile oben (Hochformat, #485) */
  mode: TableMode;
  collapsed: boolean;
  landscape: boolean;
  crowded: boolean;
  /** Breite der Seitenleiste in px im Zustand `side` (#493). */
  sideWidth: number;
}

/** Breite (px) der Seitenleiste im Zustand `side` (#493). */
export function sideBarWidth(width: number, seats: number): number {
  if (width >= 1400) return 352;
  if (width >= 1100) return 320;
  return seats > 2 ? 320 : 288;
}

/** Breite (px) des Spielerschilds in der Leiste; 0 = kompakte Chips wie bisher (#493). */
export function sideShieldSize(seats: number, sideHeight: number): number {
  if (seats <= 0) return 0;
  const available = sideHeight - 56 - 60 - 170;
  if (available <= 0) return 0;
  const perCard = available / seats;
  if (perCard >= 170) return 96;
  if (perCard >= 124) return 72;
  if (perCard >= 88) return 52;
  return 0;
}

/** Entscheidet den Layout-Zustand des Spieltischs aus Fenstergröße, Platzzahl und Spielangaben (#484, #493). */
export function tableLayout(input: TableLayoutInput): TableLayout {
  const { width, height, seats, seatsAround, seatsOnBoard, fullBleed } = input;
  const crowded = seats > 2;
  const landscape = width > height && height > 0;
  const around = Boolean(seatsAround) && seatRingFits(seats, width, height - TABLE_BAR_HEIGHT);
  // Hochformat ohne Sitzring: immer die schmale Leiste oben, für alle Spiele und jede Breite (#485); auch noch ungemessen.
  // Querformat: Schiene links bei `fullBleed` oder `seatsOnBoard` mit wenig Höhe, sonst die Seitenleiste.
  const rail = landscape && (Boolean(fullBleed) || (Boolean(seatsOnBoard) && height <= 540));
  const mode: TableMode = around ? 'ring' : !landscape ? 'bar' : rail ? 'rail' : 'side';
  const collapsed = mode === 'rail' || mode === 'bar';
  return {
    mode,
    collapsed,
    landscape,
    crowded,
    sideWidth: sideBarWidth(width, seats),
  };
}
