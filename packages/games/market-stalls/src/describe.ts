/** Zugtexte (#335, #358): kurze deutsche Beschreibung eines Zugs, auch für den Bildschirmleser und die VR-App. */
import type { MarketStallsMove, MarketStallsState } from './rules';

export function describeMove(_view: MarketStallsState, move: MarketStallsMove): string {
  return move.type === 'choose' ? `Karte ${move.card} wählen` : `An Stand ${move.stand + 1} legen`;
}
