/** Zugtexte (#335): kurze deutsche Beschreibung eines Zugs, auch für den Bildschirmleser. */
import { flipsFor, inOpening, type ReversiMove, type ReversiState } from './rules';

export const COLOR_NAMES = ['Schwarz', 'Weiß'];

/** Feldname wie in der Oberfläche: Spalten a, b, … von links, Reihen 1, 2, … von oben. */
export function cellName(size: number, cell: number): string {
  return `${'abcdefghijklmnop'[cell % size]}${Math.floor(cell / size) + 1}`;
}

/** Etwa „Schwarz auf d3, dreht 2 Steine“. */
export function describeMove(view: ReversiState, move: ReversiMove): string {
  const text = `${COLOR_NAMES[view.turn] ?? 'Stein'} auf ${cellName(view.size, move.cell)}`;
  const flips = inOpening(view) ? 0 : flipsFor(view, move.cell, view.turn).length;
  return flips === 0 ? text : `${text}, dreht ${flips === 1 ? 'einen Stein' : `${flips} Steine`}`;
}
