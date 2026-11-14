/** Zugtexte (#335): kurze deutsche Beschreibung eines Zugs, auch für den Bildschirmleser. */
import type { GomokuMove, GomokuState } from './types';

export const COLOR_NAMES = ['Schwarz', 'Weiß'];

/** Etwa „Schwarz auf Reihe 8, Spalte 8“ (wie die Felder in der Oberfläche heißen). */
export function describeMove(view: GomokuState, move: GomokuMove): string {
  const row = Math.floor(move.cell / view.size) + 1;
  const col = (move.cell % view.size) + 1;
  return `${COLOR_NAMES[view.turn] ?? 'Stein'} auf Reihe ${row}, Spalte ${col}`;
}
