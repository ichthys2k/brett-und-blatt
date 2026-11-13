/** Zugtexte (#335, #358): kurze deutsche Beschreibung eines Zugs, auch für den Bildschirmleser und die VR-App. */
import { cardNameIn, type CardId } from '@brett-und-blatt/engine';
import type { PresidentMove, PresidentView } from './rules';

function names(cards: CardId[], view: PresidentView): string {
  const hand = view.hands.find((h) => cards.every((c) => h.includes(c)));
  return cards.map((c) => cardNameIn(c, hand)).join(', ');
}

export function describeMove(view: PresidentView, move: PresidentMove): string {
  switch (move.type) {
    case 'play':
      return `${names(move.cards, view)} spielen`;
    case 'give':
      return `${names(move.cards, view)} abgeben`;
    case 'pass':
      return 'Passen';
    case 'ready':
      return 'Bereit';
  }
}
