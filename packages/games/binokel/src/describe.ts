/** Zugtexte (#335, #358): kurze deutsche Beschreibung eines Zugs, auch für den Bildschirmleser und die VR-App. */
import { cardNameIn, germanCardName, type CardId } from '@brett-und-blatt/engine';
import { SUIT_NAMES } from './cards';
import type { BinokelMove, BinokelState } from './rules';

function name(card: CardId, view: BinokelState): string {
  const hand = (view.hands ?? []).find((h) => h.includes(card));
  return cardNameIn(card, hand, (c) => germanCardName(c, SUIT_NAMES));
}

export function describeMove(view: BinokelState, move: BinokelMove): string {
  switch (move.type) {
    case 'bid':
      return `${move.value} reizen`;
    case 'pass':
      return 'Passen';
    case 'discard':
      return `${move.cards.map((c) => name(c, view)).join(', ')} drücken`;
    case 'declareTrump':
      return `Trumpf ${SUIT_NAMES[move.suit]}`;
    case 'declareDurch':
      return 'Durch ansagen';
    case 'fold':
      return 'Abgehen';
    case 'play':
      return `${name(move.card, view)} spielen`;
    case 'nextGame':
      return 'Nächstes Spiel';
  }
}
