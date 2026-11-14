/** Zugtexte (#335): kurze deutsche Beschreibung eines Zugs, auch für den Bildschirmleser. */
import { Chess, type Square } from 'chess.js';
import type { ChessMove, ChessState } from './rules';

export const PIECE_NAMES: Record<string, string> = { k: 'König', q: 'Dame', r: 'Turm', b: 'Läufer', n: 'Springer', p: 'Bauer' };

const DRAW_TEXTS = { offerDraw: 'Remis anbieten', acceptDraw: 'Remis annehmen', declineDraw: 'Remis ablehnen' } as const;

/**
 * Etwa „Springer g1–f3“, „Bauer e5 schlägt Läufer d6“, „Kurze Rochade“ oder „Bauer e7–e8 wird Dame“.
 * Fehlt bei einem Umwandlungszug die Figur, bleibt die Umwandlung offen (Zielfeld vor der Wahl).
 */
export function describeMove(view: ChessState, move: ChessMove): string {
  if (move.type !== 'move') return DRAW_TEXTS[move.type];
  const chess = new Chess(view.fen);
  const piece = chess.get(move.from as Square);
  const target = chess.get(move.to as Square);
  if (piece?.type === 'k' && Math.abs(move.from.charCodeAt(0) - move.to.charCodeAt(0)) === 2) {
    return move.to[0] === 'g' ? 'Kurze Rochade' : 'Lange Rochade';
  }
  const name = PIECE_NAMES[piece?.type ?? 'p'];
  let text: string;
  if (target) text = `${name} ${move.from} schlägt ${PIECE_NAMES[target.type]} ${move.to}`;
  else if (piece?.type === 'p' && move.from[0] !== move.to[0]) text = `${name} ${move.from} schlägt en passant ${move.to}`;
  else text = `${name} ${move.from}–${move.to}`;
  if (move.promotion) text += ` wird ${PIECE_NAMES[move.promotion]}`;
  return text;
}
