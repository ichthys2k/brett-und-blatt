import { cardRank, createDeck, type CardId, type GameEvent, type Rng, type Suit } from '@brett-und-blatt/engine';
import { clonePiles, flipIfNeeded, isSuitedRun, last } from './common';
import type { Pile, SolitaireMove, SpiderState } from './types';

const SUITS_FOR: Record<1 | 2 | 4, Suit[]> = { 1: ['S'], 2: ['S', 'H'], 4: ['C', 'D', 'H', 'S'] };

export function setupSpider(rng: Rng, suits: 1 | 2 | 4): SpiderState {
  // Immer 104 Karten: bei einer Farbe acht Sätze Pik, bei zwei je vier Sätze Pik und Herz.
  const deck = rng.shuffle(createDeck(8 / SUITS_FOR[suits].length, SUITS_FOR[suits]));
  const tableau: Pile[] = Array.from({ length: 10 }, (_, i) => {
    const cards = deck.splice(0, i < 4 ? 6 : 5);
    return { down: cards.slice(0, -1), up: cards.slice(-1) };
  });
  return { variant: 'spider', suits, tableau, stock: deck, completed: [], moveCount: 0, lastMove: null };
}

export function spiderMoves(state: SpiderState): SolitaireMove[] {
  const moves: SolitaireMove[] = [];
  state.tableau.forEach((pile, index) => {
    for (let count = 1; count <= pile.up.length; count++) {
      const run = pile.up.slice(-count);
      if (!isSuitedRun(run)) break;
      const bottom = run[0] as CardId;
      let emptyTaken = false;
      state.tableau.forEach((target, to) => {
        if (to === index) return;
        const top = last(target.up);
        if (target.up.length === 0 && target.down.length === 0) {
          // Leere Spalten sind gleichwertig; die ganze Folge eines sonst leeren Stapels umzulegen bringt nichts.
          if (emptyTaken || (count === pile.up.length && pile.down.length === 0)) return;
          emptyTaken = true;
          moves.push({ type: 'move', from: { kind: 'tableau', index }, to: { kind: 'tableau', index: to }, count });
        } else if (top !== undefined && cardRank(top) === cardRank(bottom) + 1) {
          moves.push({ type: 'move', from: { kind: 'tableau', index }, to: { kind: 'tableau', index: to }, count });
        }
      });
    }
  });
  // Austeilen geht nur, wenn keine Spalte leer ist.
  if (state.stock.length > 0 && state.tableau.every((p) => p.up.length + p.down.length > 0)) moves.push({ type: 'draw' });
  return moves;
}

/** Vollständige Folgen König bis Ass in einer Farbe werden abgelegt. */
function removeCompleted(tableau: Pile[], completed: CardId[], events: GameEvent[]): void {
  tableau.forEach((pile, index) => {
    if (pile.up.length < 13) return;
    const top13 = pile.up.slice(-13);
    if (cardRank(top13[0] as CardId) === 13 && isSuitedRun(top13)) {
      pile.up = pile.up.slice(0, -13);
      completed.push(top13[0] as CardId);
      events.push({ type: 'completed', pile: index });
      const { pile: flipped, flipped: didFlip } = flipIfNeeded(pile);
      tableau[index] = flipped;
      if (didFlip) events.push({ type: 'flipped', pile: index });
    }
  });
}

export function applySpider(state: SpiderState, move: SolitaireMove): { state: SpiderState; events: GameEvent[] } {
  const tableau = clonePiles(state.tableau);
  const completed = [...state.completed];
  const events: GameEvent[] = [];
  let stock = state.stock;
  if (move.type === 'draw') {
    const deal = stock.slice(-10) as CardId[];
    stock = stock.slice(0, -10);
    deal.reverse().forEach((card, i) => tableau[i]!.up.push(card));
    events.push({ type: 'dealt' });
  } else if (move.type === 'move' && move.from.kind === 'tableau' && move.to.kind === 'tableau') {
    const pile = tableau[move.from.index]!;
    const cards = pile.up.slice(-move.count);
    pile.up = pile.up.slice(0, -move.count);
    const { pile: flipped, flipped: didFlip } = flipIfNeeded(pile);
    tableau[move.from.index] = flipped;
    tableau[move.to.index]!.up.push(...cards);
    events.push({ type: 'moved', cards, from: move.from, to: move.to });
    if (didFlip) events.push({ type: 'flipped', pile: move.from.index });
  } else {
    throw new Error('Unbekannter Zug.');
  }
  removeCompleted(tableau, completed, events);
  return { state: { ...state, tableau, stock, completed }, events };
}

export function spiderWon(state: SpiderState): boolean {
  return state.completed.length === 8;
}
