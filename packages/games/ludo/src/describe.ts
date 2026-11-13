/** Zugtexte (#335, #358): kurze deutsche Beschreibung eines Zugs, auch für den Bildschirmleser und die VR-App. */
import type { LudoMove, LudoState } from './rules';

export function describeMove(view: LudoState, move: LudoMove): string {
  if (move.type === 'roll') return 'Würfeln';
  if (move.type === 'pass') return 'Weiter';
  const piece = view.pieces[view.turn]?.[move.pieceIndex];
  const where = piece?.area === 'home' ? 'aus dem Haus' : piece?.area === 'goal' ? 'im Ziel' : `auf Feld ${(piece?.index ?? 0) + 1}`;
  return `Figur ${move.pieceIndex + 1} ${where} ziehen${view.dice ? ` (${view.dice})` : ''}`;
}
