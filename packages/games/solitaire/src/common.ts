import { cardRank, cardSuit, isRed, SUITS, type CardId } from '@brett-und-blatt/engine';
import type { Pile } from './types';

export function last<T>(items: readonly T[]): T | undefined {
  return items[items.length - 1];
}

export function foundationIndex(card: CardId): number {
  return SUITS.indexOf(cardSuit(card));
}

/** Passt die Karte auf die Ablage ihrer Farbe? */
export function fitsFoundation(foundation: readonly CardId[], card: CardId): boolean {
  const top = last(foundation);
  return top === undefined ? cardRank(card) === 1 : cardSuit(top) === cardSuit(card) && cardRank(card) === cardRank(top) + 1;
}

/** Klondike/FreeCell: absteigend mit wechselnden Farben. */
export function fitsAlternating(target: CardId | undefined, card: CardId, emptyAccepts: 'king' | 'any'): boolean {
  if (target === undefined) return emptyAccepts === 'any' || cardRank(card) === 13;
  return isRed(target) !== isRed(card) && cardRank(target) === cardRank(card) + 1;
}

/** Ist die Folge (von unten nach oben) absteigend mit wechselnden Farben? */
export function isAlternatingRun(cards: readonly CardId[]): boolean {
  for (let i = 1; i < cards.length; i++) {
    const below = cards[i - 1] as CardId;
    const above = cards[i] as CardId;
    if (isRed(below) === isRed(above) || cardRank(below) !== cardRank(above) + 1) return false;
  }
  return true;
}

/** Spider: absteigend in derselben Farbe. */
export function isSuitedRun(cards: readonly CardId[]): boolean {
  for (let i = 1; i < cards.length; i++) {
    const below = cards[i - 1] as CardId;
    const above = cards[i] as CardId;
    if (cardSuit(below) !== cardSuit(above) || cardRank(below) !== cardRank(above) + 1) return false;
  }
  return true;
}

/** Nach einem Zug die oberste verdeckte Karte aufdecken, falls keine offene mehr liegt. */
export function flipIfNeeded(pile: Pile): { pile: Pile; flipped: boolean } {
  if (pile.up.length > 0 || pile.down.length === 0) return { pile, flipped: false };
  const card = last(pile.down);
  if (card === null || card === undefined) return { pile, flipped: false };
  return { pile: { down: pile.down.slice(0, -1), up: [card] }, flipped: true };
}

export function clonePiles(piles: readonly Pile[]): Pile[] {
  return piles.map((p) => ({ down: [...p.down], up: [...p.up] }));
}
