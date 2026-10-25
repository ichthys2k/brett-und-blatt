import { cardRank, createDeck, type CardId, type GameEvent, type Rng } from '@brett-und-blatt/engine';
import { last } from './common';
import type { PyramidLoc, PyramidState, SolitaireMove } from './types';

/** So oft darf die Ablage wieder zum Talon werden. */
export const PYRAMID_RECYCLES = 2;

export function rowStart(row: number): number {
  return (row * (row + 1)) / 2;
}

export function rowOf(index: number): number {
  let row = 0;
  while (rowStart(row + 1) <= index) row++;
  return row;
}

export function setupPyramid(rng: Rng): PyramidState {
  const deck = rng.shuffle(createDeck());
  return { variant: 'pyramid', pyramid: deck.splice(0, 28), stock: deck, waste: [], recycles: 0, moveCount: 0, lastMove: null };
}

/** Frei ist eine Karte, wenn die beiden Karten darunter schon weg sind. */
export function isFree(state: Pick<PyramidState, 'pyramid'>, index: number): boolean {
  if (state.pyramid[index] === null || state.pyramid[index] === undefined) return false;
  const row = rowOf(index);
  if (row === 6) return true;
  const below = rowStart(row + 1) + (index - rowStart(row));
  return state.pyramid[below] === null && state.pyramid[below + 1] === null;
}

export function cardAt(state: PyramidState, loc: PyramidLoc): CardId | null {
  return loc.kind === 'waste' ? (last(state.waste) ?? null) : (state.pyramid[loc.index] ?? null);
}

export function pyramidMoves(state: PyramidState): SolitaireMove[] {
  const moves: SolitaireMove[] = [];
  const free: PyramidLoc[] = state.pyramid.flatMap((_, index) => (isFree(state, index) ? [{ kind: 'pyramid' as const, index }] : []));
  if (state.waste.length > 0) free.push({ kind: 'waste' });
  free.forEach((a, i) => {
    const rankA = cardRank(cardAt(state, a) as CardId);
    if (rankA === 13) moves.push({ type: 'pair', cards: [a] });
    for (const b of free.slice(i + 1)) {
      if (rankA + cardRank(cardAt(state, b) as CardId) === 13) moves.push({ type: 'pair', cards: [a, b] });
    }
  });
  if (state.stock.length > 0) moves.push({ type: 'draw' });
  else if (state.waste.length > 0 && state.recycles < PYRAMID_RECYCLES) moves.push({ type: 'recycle' });
  return moves;
}

export function applyPyramid(state: PyramidState, move: SolitaireMove): { state: PyramidState; events: GameEvent[] } {
  if (move.type === 'draw') {
    const stock = [...state.stock];
    const card = stock.pop() as CardId;
    return { state: { ...state, stock, waste: [...state.waste, card] }, events: [{ type: 'drawn', count: 1 }] };
  }
  if (move.type === 'recycle') {
    return { state: { ...state, stock: [...state.waste].reverse(), waste: [], recycles: state.recycles + 1 }, events: [{ type: 'recycled' }] };
  }
  if (move.type !== 'pair') throw new Error('Unbekannter Zug.');
  const pyramid = [...state.pyramid];
  let waste = state.waste;
  const cards = move.cards.map((loc) => cardAt(state, loc));
  for (const loc of move.cards) {
    if (loc.kind === 'waste') waste = waste.slice(0, -1);
    else pyramid[loc.index] = null;
  }
  return { state: { ...state, pyramid, waste }, events: [{ type: 'paired', cards }] };
}

export function pyramidWon(state: PyramidState): boolean {
  return state.pyramid.every((card) => card === null);
}
