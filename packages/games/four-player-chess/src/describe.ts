/** Zugtexte (#335): kurze deutsche Beschreibung eines Zugs, auch für den Bildschirmleser. */
import * as engine from './legacy/engine';
import type { FourChessMove } from './rules';

export const COLOR_NAMES: Record<engine.Color, string> = { r: 'Rot', b: 'Blau', y: 'Gelb', g: 'Grün' };
export const PIECE_NAMES: Record<engine.PieceType, string> = { K: 'König', Q: 'Dame', R: 'Turm', B: 'Läufer', N: 'Springer', P: 'Bauer' };

/** Etwa „Springer e2–f4“, „Bauer h3 schlägt Blau Dame i4“, „Rochade mit Turm k1“, „Bauer g7–g8 wird Dame“. */
export function describeMove(view: engine.FourChessState, move: FourChessMove): string {
  if (move.t === 'claim') return 'Sieg beanspruchen';
  if (move.t === 'resign') return 'Aufgeben';
  const name = engine.squareName;
  const piece = view.board[move.f];
  const internal = engine.legalMoves(view, move.p).find((m) => m.from === move.f && m.to === move.to);
  if (internal?.castle) return `Rochade mit Turm ${name(internal.castle.from)}`;
  const pieceName = PIECE_NAMES[piece?.t ?? 'P'];
  const victimSquare = internal?.ep ?? move.to;
  const victim = view.board[victimSquare];
  let text: string;
  if (victim) {
    const owner = victim.d ? 'tote Figur' : COLOR_NAMES[victim.c];
    text = `${pieceName} ${name(move.f)} schlägt ${owner} ${PIECE_NAMES[victim.t]} ${name(move.to)}${internal?.ep !== undefined ? ' en passant' : ''}`;
  } else text = `${pieceName} ${name(move.f)}–${name(move.to)}`;
  if (move.pr) text += ` wird ${PIECE_NAMES[move.pr]}`;
  return text;
}
