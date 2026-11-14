/** Zugtexte (#335, #358): kurze deutsche Beschreibung eines Zugs, auch für den Bildschirmleser und die VR-App. */
import { formatCoord, type BattleshipMove, type BattleshipState } from './rules';

export function describeMove(view: BattleshipState, move: BattleshipMove): string {
  return move.type === 'shoot' ? `Schuss auf ${formatCoord(move.cell, view.coords)}` : 'Flotte aufstellen (zufällig)';
}
