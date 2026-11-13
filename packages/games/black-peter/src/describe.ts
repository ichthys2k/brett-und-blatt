/** Zugtexte (#335, #358): kurze deutsche Beschreibung eines Zugs, auch für den Bildschirmleser und die VR-App. */
import type { BlackPeterMove, BlackPeterState } from './rules';

export function describeMove(_view: BlackPeterState, move: BlackPeterMove): string {
  return move.type === 'draw' ? `Karte ${move.index + 1} ziehen` : 'Eigene Karten mischen';
}
