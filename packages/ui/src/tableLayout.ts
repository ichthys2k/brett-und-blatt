import { seatRingFits } from './SeatRing';

/** Höhe der Kopfzeile über dem Spieltisch (px). */
export const TABLE_BAR_HEIGHT = 56;

/**
 * Zustand des Spieltischs:
 * - `ring`: Spieler sitzen rund um den Tisch (`SeatRing`), nur eine Kopfzeile oben.
 * - `side`: feste Seitenleiste links (Querformat).
 * - `stack`: Hochformat mit Kopfzeile, Status und Knöpfen.
 * - `rail`: eingeklappte ☰-Schiene links (Querformat).
 * - `bar`: eingeklappte ☰-Zeile oben (Hochformat).
 */
export type TableMode = 'ring' | 'side' | 'stack' | 'rail' | 'bar';

export interface TableLayoutInput {
  /** Fensterbreite des Spieltischs in px (0 = noch nicht gemessen). */
  width: number;
  /** Fensterhöhe des Spieltischs in px (0 = noch nicht gemessen). */
  height: number;
  /** Platzzahl der Partie. */
  seats: number;
  /** Das Spiel kann Spieler um den Tisch setzen (`GameUi.seatsAround`). */
  seatsAround?: boolean;
  /** Das Spiel zeigt die Plätze selbst auf dem Brett (`GameUi.seatsOnBoard`). */
  seatsOnBoard?: boolean;
  /** Das Spiel nutzt die ganze Fläche (`GameUi.fullBleed`). */
  fullBleed?: boolean;
}

export interface TableLayout {
  mode: TableMode;
  /** `rail` oder `bar`. */
  collapsed: boolean;
  landscape: boolean;
  /** Mehr als zwei Plätze. */
  crowded: boolean;
}

/** Höchste Höhe (px), bei der Spiele mit `seatsOnBoard` im Querformat ihre Leiste einklappen. */
const RAIL_MAX_HEIGHT = 540;

/** Rechnet aus Fenstergröße, Platzzahl und Spieleigenschaften den Zustand des Spieltischs. */
export function tableLayout({ width, height, seats, seatsAround, seatsOnBoard, fullBleed }: TableLayoutInput): TableLayout {
  const measured = height > 0;
  const landscape = width > height && measured;
  const crowded = seats > 2;
  const result = (mode: TableMode): TableLayout => ({ mode, collapsed: mode === 'rail' || mode === 'bar', landscape, crowded });

  if (seatsAround && seatRingFits(seats, width, height - TABLE_BAR_HEIGHT)) return result('ring');
  if ((fullBleed && measured) || (landscape && seatsOnBoard && height <= RAIL_MAX_HEIGHT)) return result(landscape ? 'rail' : 'bar');
  return result(landscape ? 'side' : 'stack');
}
