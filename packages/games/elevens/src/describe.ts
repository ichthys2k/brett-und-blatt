/** Zugtexte (#335, #358): kurze deutsche Beschreibung eines Zugs, auch für den Bildschirmleser und die VR-App. */
import type { CardId } from '@brett-und-blatt/engine';
import type { ElevensMove, ElevensState } from './rules';

const COLORS: Record<string, string> = { r: 'Rot', y: 'Gelb', g: 'Grün', b: 'Blau' };

export function elevensCardName(card: CardId): string {
  return `${COLORS[card[0]!] ?? card[0]} ${card.slice(1)}`;
}

export function describeMove(_view: ElevensState, move: ElevensMove): string {
  switch (move.type) {
    case 'play':
      return `${elevensCardName(move.card)} spielen`;
    case 'draw':
      return 'Karte ziehen';
    case 'end':
      return 'Zug beenden';
  }
}
