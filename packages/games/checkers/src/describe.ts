/** Zugtexte (#335): kurze deutsche Beschreibung eines Zugs, auch für den Bildschirmleser. */
import type { CheckersMove, CheckersState } from './rules';

const DRAW_TEXTS = { offerDraw: 'Remis anbieten', acceptDraw: 'Remis annehmen', declineDraw: 'Remis ablehnen' } as const;

/** Etwa „Stein c3–d4“ oder „Dame c3 schlägt 2 Steine über e5 nach g7“. */
export function describeMove(view: CheckersState, move: CheckersMove): string {
  if (move.type !== 'move') return DRAW_TEXTS[move.type];
  const piece = view.cells[move.from];
  const name = piece?.king ? 'Dame' : 'Stein';
  const squares = move.san.split(/[-:x]/);
  const from = squares[0] ?? '';
  const to = squares[squares.length - 1] ?? '';
  const count = move.captures?.length ?? 0;
  if (count === 0) return `${name} ${from}–${to}`;
  const via = squares.slice(1, -1);
  return `${name} ${from} schlägt ${count === 1 ? 'einen Stein' : `${count} Steine`}${via.length ? ` über ${via.join(', ')}` : ''} nach ${to}`;
}
