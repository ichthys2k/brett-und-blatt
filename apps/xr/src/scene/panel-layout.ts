/**
 * Lage des Menüfensters (#364). Das Fenster hängt an einer Grundhöhe, seine Zeilen wachsen nach
 * unten. Würde die Unterkante unter die Tischplatte reichen, rückt das ganze Fenster nach oben.
 * Reine Rechnung ohne three.js, damit `tests/xr-panel.test.ts` sie prüfen kann.
 */

/** Höhe einer Textzeile im Kopfschild, Rand dazu. */
export const LINE_H = 0.045;
export const HEAD_PAD = 0.04;
/** Abstand der Knopfreihen. */
export const ROW_STEP = 0.05;
export const BUTTON_H = 0.042;
/** Lücke zwischen Kopfschild und erster Reihe (Mitte der Reihe unter der Unterkante). */
export const ROW_GAP = 0.035;
/** So hoch über der Tischplatte darf die Unterkante des Fensters frühestens liegen. */
export const MIN_ABOVE_TABLE = 0.15;
/** Lobby: so viele Platzzeilen je Seite. */
export const SEAT_PAGE = 4;

export function headHeight(lineCount: number): number {
  return lineCount * LINE_H + HEAD_PAD;
}

/** Abstand der Fensterunterkante zum Ursprung der Gruppe (negativ, nach unten). */
export function lowestEdge(lineCount: number, rowCount: number): number {
  const head = headHeight(lineCount);
  if (rowCount <= 0) return -head / 2;
  return -head / 2 - ROW_GAP - (rowCount - 1) * ROW_STEP - BUTTON_H / 2;
}

/** Wie weit das Fenster angehoben werden muss, damit es über der Tischplatte bleibt (0, wenn es passt). */
export function liftAboveTable(baseY: number, lineCount: number, rowCount: number, tableTop: number): number {
  const bottom = baseY + lowestEdge(lineCount, rowCount);
  return Math.max(0, tableTop + MIN_ABOVE_TABLE - bottom);
}

/** Zeilen der Platzliste in der Lobby: Ausschnitt der Seite und Gesamtzahl der Seiten. */
export function seatPageRange(seatCount: number, page: number): { from: number; to: number; pages: number; current: number } {
  const pages = Math.max(1, Math.ceil(seatCount / SEAT_PAGE));
  const current = Math.min(Math.max(0, page), pages - 1);
  const from = current * SEAT_PAGE;
  return { from, to: Math.min(seatCount, from + SEAT_PAGE), pages, current };
}
