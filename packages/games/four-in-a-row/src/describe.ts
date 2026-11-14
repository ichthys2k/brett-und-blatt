/** Zugtexte (#335): kurze deutsche Beschreibung eines Zugs, auch für den Bildschirmleser. */
import type { FourInARowMove, FourInARowState } from './rules';

export const COLOR_NAMES = ['Rot', 'Gelb'];

export function describeMove(view: FourInARowState, move: FourInARowMove): string {
  const color = COLOR_NAMES[view.turn] ?? 'Stein';
  return move.type === 'drop' ? `${color} in Spalte ${move.column + 1}` : `${color}: unteren Stein aus Spalte ${move.column + 1} ziehen`;
}
