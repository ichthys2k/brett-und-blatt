import { cardRank, cardSuit, type CardId, type Suit } from '@brett-und-blatt/engine';
import { SUIT_NAMES, SUITS } from './cards';

export interface Meld {
  label: string;
  points: number;
  cards: CardId[];
}

const take = (cards: CardId[], suit: Suit | null, rank: number, n: number): CardId[] =>
  cards.filter((c) => (suit === null || cardSuit(c) === suit) && cardRank(c) === rank).slice(0, n);

/**
 * Bestes Meldebild einer Hand. Eine Karte zählt in jeder Gruppe höchstens einmal, darf aber
 * in mehreren Gruppen stecken (z. B. der Grün-Ober in Familie, vier Obern und Binokel).
 */
export function findMelds(hand: readonly CardId[], trump: Suit | null): Meld[] {
  const cards = [...hand];
  const melds: Meld[] = [];
  const count = (suit: Suit | null, rank: number) => cards.filter((c) => (suit === null || cardSuit(c) === suit) && cardRank(c) === rank).length;

  // Gruppe 1: Familien und Paare je Farbe, dazu der Rundgang.
  const leftoverPair: Partial<Record<Suit, CardId[]>> = {};
  for (const suit of SUITS) {
    const isTrump = suit === trump;
    const families = Math.min(...[1, 10, 13, 12, 11].map((r) => count(suit, r)));
    const pool = cards.filter((c) => cardSuit(c) === suit);
    if (families === 2 && isTrump) {
      melds.push({ label: `Doppelte Familie ${SUIT_NAMES[suit]}`, points: 1000, cards: pool.filter((c) => [1, 10, 13, 12, 11].includes(cardRank(c))) });
    } else {
      for (let f = 0; f < families; f++) {
        const famCards = [1, 10, 13, 12, 11].map((r) => take(pool, suit, r, f + 1)[f]!);
        melds.push({ label: `${isTrump ? 'Trumpf-Familie' : 'Familie'} ${SUIT_NAMES[suit]}`, points: isTrump ? 150 : 100, cards: famCards });
      }
    }
    const pairs = Math.min(count(suit, 13), count(suit, 12)) - families;
    for (let p = 0; p < pairs; p++) {
      const pairCards = [take(pool, suit, 13, 2)[families + p]!, take(pool, suit, 12, 2)[families + p]!];
      melds.push({ label: `${isTrump ? 'Trumpf-Paar' : 'Paar'} ${SUIT_NAMES[suit]}`, points: isTrump ? 40 : 20, cards: pairCards });
      if (p === 0) leftoverPair[suit] = pairCards;
    }
  }
  if (SUITS.every((s) => leftoverPair[s])) {
    melds.push({ label: 'Rundgang', points: 100, cards: SUITS.flatMap((s) => leftoverPair[s]!) });
  }

  // Gruppe 2: gleiche Ränge.
  const RANKS: [number, string, number][] = [
    [1, 'Sauen', 100],
    [13, 'Könige', 80],
    [12, 'Ober', 60],
    [11, 'Unter', 40],
  ];
  for (const [rank, name, points] of RANKS) {
    if (count(null, rank) === 8) melds.push({ label: `Acht ${name}`, points: 1000, cards: take(cards, null, rank, 8) });
    else if (SUITS.every((s) => count(s, rank) > 0)) melds.push({ label: `Vier ${name}`, points, cards: SUITS.map((s) => take(cards, s, rank, 1)[0]!) });
  }

  // Gruppe 3: Binokel (Grün-Ober und Schellen-Unter).
  const ober = take(cards, 'S', 12, 2);
  const unter = take(cards, 'D', 11, 2);
  if (ober.length === 2 && unter.length === 2) melds.push({ label: 'Doppelter Binokel', points: 300, cards: [...ober, ...unter] });
  else if (ober.length > 0 && unter.length > 0) melds.push({ label: 'Binokel', points: 40, cards: [ober[0]!, unter[0]!] });

  // Gruppe 4: Dissle (Trumpf-Sieben).
  if (trump) for (const seven of take(cards, trump, 7, 2)) melds.push({ label: 'Dissle', points: 10, cards: [seven] });

  return melds;
}

export const meldPoints = (melds: readonly Meld[]) => melds.reduce((sum, m) => sum + m.points, 0);
