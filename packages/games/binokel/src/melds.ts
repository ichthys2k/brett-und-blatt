import type { CardId, Suit } from '@brett-und-blatt/engine';
import { cardRank, cardSuit } from '@brett-und-blatt/engine';
import type { DeclaredMeld, MeldType } from './types.js';

function groupBySuit(cards: CardId[]): Record<Suit, CardId[]> {
  const map: Record<Suit, CardId[]> = { C: [], S: [], H: [], D: [] };
  for (const c of cards) map[cardSuit(c)].push(c);
  return map;
}

function hasRank(cards: CardId[], rank: number): boolean {
  return cards.some((c) => cardRank(c) === rank);
}

function countRank(cards: CardId[], rank: number): number {
  return cards.filter((c) => cardRank(c) === rank).length;
}

export function findAllMelds(hand: CardId[], deckSize: 40 | 48, trumpSuit: Suit | null): DeclaredMeld[] {
  const melds: DeclaredMeld[] = [];
  const bySuit = groupBySuit(hand);

  // Familie and pairs
  for (const suit of ['C', 'S', 'H', 'D'] as Suit[]) {
    const cards = bySuit[suit];
    const hasA = hasRank(cards, 1);
    const has10 = hasRank(cards, 10);
    const hasK = hasRank(cards, 13);
    const hasQ = hasRank(cards, 12); // Ober
    const hasJ = hasRank(cards, 11); // Unter
    const isTrump = trumpSuit === suit;

    // Familie
    if (hasA && has10 && hasK && hasQ && hasJ) {
      const famCards = cards.filter((c) => [1, 10, 11, 12, 13].includes(cardRank(c)));
      if (isTrump && deckSize >= 40) {
        melds.push({ type: 'trumpFamily', cards: famCards, points: 150, owner: '' as any });
      } else {
        melds.push({ type: 'family', cards: famCards, points: 100, owner: '' as any });
      }
    }
    // Paare (if not fully in family context - simplified)
    if (hasK && hasQ) {
      const pairCards = cards.filter((c) => cardRank(c) === 12 || cardRank(c) === 13);
      if (isTrump) {
        melds.push({ type: 'trumpPair', cards: pairCards, points: 40, owner: '' as any });
      } else {
        melds.push({ type: 'pair', cards: pairCards, points: 20, owner: '' as any });
      }
    }
  }

  // Rundgang
  let pairCount = 0;
  const roundCards: CardId[] = [];
  for (const suit of ['C', 'S', 'H', 'D'] as Suit[]) {
    const cards = bySuit[suit];
    if (hasRank(cards, 12) && hasRank(cards, 13)) {
      pairCount++;
      roundCards.push(...cards.filter((c) => cardRank(c) === 12 || cardRank(c) === 13));
    }
  }
  if (pairCount === 4) {
    melds.push({ type: 'round', cards: roundCards, points: 240, owner: '' as any });
  }

  // Vierer
  for (const rank of [1, 13, 12, 11]) {
    const allCards = hand.filter((c) => cardRank(c) === rank);
    if (allCards.length >= 4) {
      if (rank === 1) melds.push({ type: 'fourAces', cards: allCards.slice(0, 4), points: 100, owner: '' as any });
      if (rank === 13) melds.push({ type: 'fourKings', cards: allCards.slice(0, 4), points: 80, owner: '' as any });
      if (rank === 12) melds.push({ type: 'fourQueens', cards: allCards.slice(0, 4), points: 60, owner: '' as any });
      if (rank === 11) melds.push({ type: 'fourJacks', cards: allCards.slice(0, 4), points: 40, owner: '' as any });
    }
    if (allCards.length === 8) {
      melds.push({ type: 'eightOfRank', cards: allCards, points: 1000, owner: '' as any });
    }
  }

  // Binokel
  const binokelCards: CardId[] = [];
  for (const c of hand) {
    const s = cardSuit(c);
    const r = cardRank(c);
    if ((s === 'S' && r === 12) || (s === 'D' && r === 11)) binokelCards.push(c);
  }
  if (binokelCards.length === 2) {
    melds.push({ type: 'binokel', cards: binokelCards, points: 40, owner: '' as any });
  } else if (binokelCards.length >= 4) {
    melds.push({ type: 'doubleBinokel', cards: binokelCards.slice(0, 4), points: 300, owner: '' as any });
  }

  // Dissle
  if (deckSize === 48 && trumpSuit) {
    const dissle = hand.filter((c) => cardSuit(c) === trumpSuit && cardRank(c) === 7);
    if (dissle.length === 1) melds.push({ type: 'dissle', cards: dissle, points: 10, owner: '' as any });
    if (dissle.length >= 2) melds.push({ type: 'dissle', cards: dissle.slice(0, 2), points: 20, owner: '' as any });
  }

  return melds;
}

export function bestMeldSet(hand: CardId[], deckSize: 40 | 48, trumpSuit: Suit | null): DeclaredMeld[] {
  const all = findAllMelds(hand, deckSize, trumpSuit);
  // simple greedy: take highest point melds not conflicting
  const used = new Set<string>();
  const result: DeclaredMeld[] = [];
  const sorted = [...all].sort((a, b) => b.points - a.points);
  for (const m of sorted) {
    const conflict = m.cards.some((c) => used.has(c));
    if (conflict) continue;
    for (const c of m.cards) used.add(c);
    result.push(m);
  }
  return result;
}
