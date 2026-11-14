/** Zugtexte (#335, #358): kurze deutsche Beschreibung eines Zugs, auch für den Bildschirmleser und die VR-App. */
import { cardNameIn } from '@brett-und-blatt/engine';
import type { SpeedMove, SpeedView } from './rules';

export function describeMove(view: SpeedView, move: SpeedMove): string {
  switch (move.type) {
    case 'play': {
      const hand = view.players.find((p) => p.hand.includes(move.card))?.hand;
      return `${cardNameIn(move.card, hand)} auf Stapel ${move.pile + 1}`;
    }
    case 'draw':
      return 'Karte nachziehen';
    case 'stuck':
      return 'Komme nicht weiter';
    case 'ready':
      return 'Bereit';
  }
}
