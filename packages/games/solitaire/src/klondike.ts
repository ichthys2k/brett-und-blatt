import { createDeck, type CardId, type GameEvent, type Rng } from '@brett-und-blatt/engine';
import { clonePiles, fitsAlternating, fitsFoundation, flipIfNeeded, foundationIndex, last } from './common';
import type { KlondikeState, Loc, SolitaireMove } from './types';

export function setupKlondike(rng: Rng, draw: 1 | 3): KlondikeState {
  const deck = rng.shuffle(createDeck());
  const tableau = Array.from({ length: 7 }, (_, i) => {
    const cards = deck.splice(0, i + 1);
    return { down: cards.slice(0, -1), up: cards.slice(-1) };
  });
  return { variant: 'klondike', draw, tableau, foundations: [[], [], [], []], stock: deck, waste: [], moveCount: 0, lastMove: null };
}

/** Karten, die von einem Ort aus verschoben werden könnten (von unten nach oben). */
function cardsAt(state: KlondikeState, loc: Loc, count: number): CardId[] {
  if (loc.kind === 'tableau') return state.tableau[loc.index]?.up.slice(-count) ?? [];
  if (loc.kind === 'waste') return state.waste.slice(-1);
  if (loc.kind === 'foundation') return state.foundations[loc.index]?.slice(-1) ?? [];
  return [];
}

export function klondikeMoves(state: KlondikeState): SolitaireMove[] {
  const moves: SolitaireMove[] = [];
  const toFoundation = (from: Loc, card: CardId | undefined) => {
    if (card === undefined) return;
    const index = foundationIndex(card);
    if (fitsFoundation(state.foundations[index] ?? [], card)) moves.push({ type: 'move', from, to: { kind: 'foundation', index }, count: 1 });
  };
  const toTableau = (from: Loc, bottom: CardId, count: number) => {
    state.tableau.forEach((pile, index) => {
      if (from.kind === 'tableau' && from.index === index) return;
      if (pile.up.length === 0 && pile.down.length > 0) return;
      if (fitsAlternating(last(pile.up), bottom, 'king')) {
        moves.push({ type: 'move', from, to: { kind: 'tableau', index }, count });
      }
    });
  };

  state.tableau.forEach((pile, index) => {
    const from: Loc = { kind: 'tableau', index };
    toFoundation(from, last(pile.up));
    for (let count = 1; count <= pile.up.length; count++) toTableau(from, pile.up[pile.up.length - count] as CardId, count);
  });
  const waste = last(state.waste);
  if (waste !== undefined) {
    toFoundation({ kind: 'waste' }, waste);
    toTableau({ kind: 'waste' }, waste, 1);
  }
  state.foundations.forEach((foundation, index) => {
    const top = last(foundation);
    if (top !== undefined) toTableau({ kind: 'foundation', index }, top, 1);
  });
  if (state.stock.length > 0) moves.push({ type: 'draw' });
  else if (state.waste.length > 0) moves.push({ type: 'recycle' });
  return moves;
}

export function applyKlondike(state: KlondikeState, move: SolitaireMove): { state: KlondikeState; events: GameEvent[] } {
  const events: GameEvent[] = [];
  if (move.type === 'draw') {
    const stock = [...state.stock];
    const drawn = stock.splice(-Math.min(state.draw, stock.length)).reverse() as CardId[];
    return { state: { ...state, stock, waste: [...state.waste, ...drawn] }, events: [{ type: 'drawn', count: drawn.length }] };
  }
  if (move.type === 'recycle') {
    return { state: { ...state, stock: [...state.waste].reverse(), waste: [] }, events: [{ type: 'recycled' }] };
  }
  if (move.type !== 'move') throw new Error('Unbekannter Zug.');

  const cards = cardsAt(state, move.from, move.count);
  const tableau = clonePiles(state.tableau);
  const foundations = state.foundations.map((f) => [...f]);
  let waste = state.waste;
  if (move.from.kind === 'tableau') {
    const pile = tableau[move.from.index]!;
    pile.up = pile.up.slice(0, -move.count);
    const { pile: flippedPile, flipped } = flipIfNeeded(pile);
    tableau[move.from.index] = flippedPile;
    if (flipped) events.push({ type: 'flipped', pile: move.from.index });
  } else if (move.from.kind === 'waste') {
    waste = waste.slice(0, -1);
  } else if (move.from.kind === 'foundation') {
    foundations[move.from.index] = foundations[move.from.index]!.slice(0, -1);
  }
  if (move.to.kind === 'tableau') tableau[move.to.index]!.up.push(...cards);
  else if (move.to.kind === 'foundation') foundations[move.to.index]!.push(...cards);
  events.unshift({ type: 'moved', cards, from: move.from, to: move.to });
  return { state: { ...state, tableau, foundations, waste }, events };
}

export function klondikeWon(state: KlondikeState): boolean {
  return state.foundations.every((f) => f.length === 13);
}

/** Alles offen, Talon leer: Der Rest lässt sich ohne Nachdenken ablegen. */
export function klondikeTrivial(state: KlondikeState): boolean {
  return state.stock.length === 0 && state.waste.length === 0 && state.tableau.every((p) => p.down.length === 0);
}
