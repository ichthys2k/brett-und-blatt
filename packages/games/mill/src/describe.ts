/** Zugtexte (#335): kurze deutsche Beschreibung eines Zugs, auch für den Bildschirmleser. */
import { NEIGHBORS, pointName } from './board';
import type { MillMove, MillState } from './rules';

export const COLOR_NAMES = ['Weiß', 'Schwarz'];

/** Der Zug ohne das Wegnehmen, etwa „Weiß setzt auf d6“, „Schwarz zieht a1–a4“ oder „Weiß springt a1–g7“. */
export function describeStep(view: MillState, move: MillMove): string {
  const color = COLOR_NAMES[view.turn] ?? 'Stein';
  if (move.type === 'place') return `${color} setzt auf ${pointName(move.to)}`;
  const verb = NEIGHBORS[move.from]?.includes(move.to) ? 'zieht' : 'springt';
  return `${color} ${verb} ${pointName(move.from)}–${pointName(move.to)}`;
}

/** Mit Mühle: „Weiß setzt auf d6, Mühle, nimmt b2“. */
export function describeMove(view: MillState, move: MillMove): string {
  const step = describeStep(view, move);
  return move.remove.length === 0 ? step : `${step}, Mühle, nimmt ${move.remove.map(pointName).join(' und ')}`;
}
