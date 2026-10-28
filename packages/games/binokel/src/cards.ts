import { cardEyePoints, cardId, cardRank, cardSuit, type CardId, type Suit, type TrickContract } from '@brett-und-blatt/engine';

/** Eichel, Grün (Schippe), Herz, Schellen – im französischen Bild Kreuz, Pik, Herz, Karo. */
export const SUITS: Suit[] = ['C', 'S', 'H', 'D'];
export const SUIT_NAMES: Record<Suit, string> = { C: 'Eichel', S: 'Grün', H: 'Herz', D: 'Schellen' };

/** Doppeltes Blatt: je zwei Sau, Zehn, König, Ober, Unter (und auf Wunsch Siebener). */
export function createDeck(deckSize: 40 | 48): CardId[] {
  const ranks = deckSize === 48 ? [1, 10, 13, 12, 11, 7] : [1, 10, 13, 12, 11];
  const deck: CardId[] = [];
  for (const suit of SUITS) for (const rank of ranks) for (const copy of [1, 2]) deck.push(cardId(suit, rank, copy));
  return deck;
}

/** Augen: Sau 11, Zehn 10, König 4, Ober 3, Unter 2, Sieben 0. */
export const eyes = cardEyePoints;

/** Rangfolge im Stich: Sau > Zehn > König > Ober > Unter > Sieben. */
export function power(card: CardId): number {
  return ({ 1: 6, 10: 5, 13: 4, 12: 3, 11: 2, 7: 1 } as Record<number, number>)[cardRank(card)] ?? 0;
}

/** Stichregeln: Farbzwang, Überstichzwang, Trumpfzwang, Übertrumpfen. Ohne Trumpf beim Durch. */
export function binokelContract(trump: Suit | null): TrickContract {
  return {
    isTrump: (card) => trump !== null && cardSuit(card) === trump,
    effectiveSuit: (card) => (trump !== null && cardSuit(card) === trump ? 'TRUMP' : cardSuit(card)),
    cardPower: power,
    rules: { hasTrumps: trump !== null, mustFollowSuit: true, mustOvertake: true, mustTrump: true, overtakeTrump: true },
  };
}
