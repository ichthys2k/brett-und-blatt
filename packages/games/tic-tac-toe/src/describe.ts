/** Zugtexte (#335): kurze deutsche Beschreibung eines Zugs, auch für den Bildschirmleser. */
import type { TicTacToeMove, TicTacToeState } from './rules';

export const MARK_NAMES = ['Kreuz', 'Kreis'];
export const CELL_NAMES = ['oben links', 'oben Mitte', 'oben rechts', 'Mitte links', 'Mitte', 'Mitte rechts', 'unten links', 'unten Mitte', 'unten rechts'];

export function describeMove(view: TicTacToeState, move: TicTacToeMove): string {
  return `${MARK_NAMES[view.turn] ?? 'Zeichen'} auf ${CELL_NAMES[move.cell] ?? `Feld ${move.cell + 1}`}`;
}
