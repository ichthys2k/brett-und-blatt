/** Zugtexte (#335, #358): kurze deutsche Beschreibung eines Zugs, auch für den Bildschirmleser und die VR-App. */
import type { TurnipMove, TurnipState } from './rules';

export function describeMove(_view: TurnipState, move: TurnipMove): string {
  return move.type === 'draw' ? 'Karte ziehen' : `Hase ${move.hare + 1} hüpfen lassen`;
}
