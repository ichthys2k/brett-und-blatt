/** Zugtexte (#335): kurze deutsche Beschreibung eines Zugs, auch für den Bildschirmleser. */
import { cardName, SUIT_NAMES } from '@brett-und-blatt/engine';
import type { MauMauMove, MauMauState } from './types';

/**
 * Etwa „Herz Ass spielen“, „Kreuz Bube spielen, Pik wünschen“, „4 Karten ziehen“ oder
 * „Platz 2 erwischen (kein „Mau!“)“. Nennt nur eigene Karten – sie stehen in der eigenen Sicht.
 */
export function describeMove(view: MauMauState, move: MauMauMove): string {
  switch (move.type) {
    case 'play': {
      let text = `${cardName(move.cardId)} spielen`;
      if (move.chosenSuit) text += `, ${SUIT_NAMES[move.chosenSuit]} wünschen`;
      if (move.callMau) text += ' und „Mau!“ rufen';
      return text;
    }
    case 'draw':
      return view.pendingDraw > 0 ? `${view.pendingDraw} Karten ziehen` : 'Karte ziehen';
    case 'pass':
      return 'Passen';
    case 'catchMau':
      return `Platz ${move.target + 1} erwischen (kein „Mau!“)`;
    case 'callMau':
      return '„Mau!“ rufen';
  }
}
