import { cardId, SUITS, type CardId } from '@brett-und-blatt/engine';

/** Die Ränge des klassischen 32er-Blatts: 7, 8, 9, 10, Bube, Dame, König, Ass. */
export const MAU_MAU_RANKS = [7, 8, 9, 10, 11, 12, 13, 1] as const;

/** Baut ein frisches 32er-Blatt mit eindeutigen Karten-IDs. */
export function buildMauMauDeck(): CardId[] {
  const deck: CardId[] = [];
  for (const suit of SUITS) {
    for (const rank of MAU_MAU_RANKS) {
      deck.push(cardId(suit, rank));
    }
  }
  return deck;
}
