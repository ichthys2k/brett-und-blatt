import { cardRank, cardSuit, type CardId, type Rank, type Suit } from '@brett-und-blatt/engine';

export const BINOKEL_SUITS: Suit[] = ['C', 'S', 'H', 'D']; // Eichel, Schippe/Grün, Herz, Schellen

export function createBinokelDeck(deckSize: 40 | 48): CardId[] {
  const ranks: Rank[] = deckSize === 48 ? [1, 7, 8, 9, 10, 11, 12, 13] : [1, 10, 11, 12, 13];
  const deck: CardId[] = [];
  for (const suit of BINOKEL_SUITS) {
    for (const rank of ranks) {
      // doppeltes Blatt
      deck.push(`${suit}${rank}` as CardId);
      deck.push(`${suit}${rank}` as CardId);
    }
  }
  return deck;
}

export function isBinokel(card: CardId): boolean {
  const s = cardSuit(card);
  const r = cardRank(card);
  // Schippe/Grün Ober (12) + Schellen Unter (11) - konventionell wie im Plan beschrieben
  if (s === 'S' && r === 12) return true;
  if (s === 'D' && r === 11) return true;
  return false;
}

export function binokelKey(card: CardId): string {
  return card;
}
