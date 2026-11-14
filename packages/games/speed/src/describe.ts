/** Zugtexte (#335, #358): kurze deutsche Beschreibung eines Zugs, auch für den Bildschirmleser und die VR-App. */
import { cardName } from '@brett-und-blatt/engine';
import type { SpeedMove, SpeedView } from './rules';

export function describeMove(_view: SpeedView, move: SpeedMove): string {
  switch (move.type) {
    case 'play':
      return `${cardName(move.card)} auf Stapel ${move.pile + 1}`;
    case 'stuck':
      return 'Komme nicht weiter';
    case 'ready':
      return 'Bereit';
  }
}
