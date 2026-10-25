import { cardRank, createDeck, type CardId, type GameEvent, type Rng } from '@brett-und-blatt/engine';
import { fitsAlternating, fitsFoundation, foundationIndex, isAlternatingRun, last } from './common';
import type { FreeCellState, Loc, SolitaireMove } from './types';

export function setupFreeCell(rng: Rng): FreeCellState {
  const deck = rng.shuffle(createDeck());
  const tableau: CardId[][] = Array.from({ length: 8 }, () => []);
  deck.forEach((card, i) => tableau[i % 8]!.push(card));
  return { variant: 'freecell', tableau, cells: [null, null, null, null], foundations: [[], [], [], []], moveCount: 0, lastMove: null };
}

/**
 * Wie viele Karten lassen sich auf einmal verschieben? Eigentlich wandert jede
 * einzeln über freie Zellen und leere Spalten – das Ergebnis ist dasselbe.
 */
export function maxMovable(state: FreeCellState, toEmptyColumn: boolean): number {
  const freeCells = state.cells.filter((c) => c === null).length;
  const emptyColumns = state.tableau.filter((col) => col.length === 0).length - (toEmptyColumn ? 1 : 0);
  return (freeCells + 1) * 2 ** Math.max(0, emptyColumns);
}

export function freeCellMoves(state: FreeCellState): SolitaireMove[] {
  const moves: SolitaireMove[] = [];
  const firstFreeCell = state.cells.indexOf(null);
  const toFoundation = (from: Loc, card: CardId | null | undefined) => {
    if (card === null || card === undefined) return;
    const index = foundationIndex(card);
    if (fitsFoundation(state.foundations[index] ?? [], card)) moves.push({ type: 'move', from, to: { kind: 'foundation', index }, count: 1 });
  };

  state.tableau.forEach((column, index) => {
    const from: Loc = { kind: 'tableau', index };
    toFoundation(from, last(column));
    if (column.length > 0 && firstFreeCell >= 0) moves.push({ type: 'move', from, to: { kind: 'cell', index: firstFreeCell }, count: 1 });
    for (let count = 1; count <= column.length; count++) {
      const run = column.slice(-count);
      if (!isAlternatingRun(run)) break;
      state.tableau.forEach((target, to) => {
        if (to === index) return;
        if (count > maxMovable(state, target.length === 0)) return;
        // In eine leere Spalte nur die ganze Folge legen, wenn sie nicht schon allein liegt.
        if (target.length === 0 && count === column.length) return;
        if (fitsAlternating(last(target), run[0] as CardId, 'any')) moves.push({ type: 'move', from, to: { kind: 'tableau', index: to }, count });
      });
    }
  });
  state.cells.forEach((card, index) => {
    if (card === null) return;
    const from: Loc = { kind: 'cell', index };
    toFoundation(from, card);
    let emptyTaken = false;
    state.tableau.forEach((target, to) => {
      if (target.length === 0) {
        // Alle leeren Spalten sind gleichwertig – nur eine anbieten.
        if (emptyTaken) return;
        emptyTaken = true;
      }
      if (fitsAlternating(last(target), card, 'any')) moves.push({ type: 'move', from, to: { kind: 'tableau', index: to }, count: 1 });
    });
  });
  return moves;
}

export function applyFreeCell(state: FreeCellState, move: SolitaireMove): { state: FreeCellState; events: GameEvent[] } {
  if (move.type !== 'move') throw new Error('Unbekannter Zug.');
  const tableau = state.tableau.map((c) => [...c]);
  const cells = [...state.cells];
  const foundations = state.foundations.map((f) => [...f]);
  let cards: CardId[];
  if (move.from.kind === 'tableau') {
    cards = tableau[move.from.index]!.splice(-move.count);
  } else if (move.from.kind === 'cell') {
    cards = [cells[move.from.index] as CardId];
    cells[move.from.index] = null;
  } else {
    throw new Error('Von hier kann nichts verschoben werden.');
  }
  if (move.to.kind === 'tableau') tableau[move.to.index]!.push(...cards);
  else if (move.to.kind === 'cell') cells[move.to.index] = cards[0] ?? null;
  else if (move.to.kind === 'foundation') foundations[move.to.index]!.push(...cards);
  return { state: { ...state, tableau, cells, foundations }, events: [{ type: 'moved', cards, from: move.from, to: move.to }] };
}

export function freeCellWon(state: FreeCellState): boolean {
  return state.foundations.every((f) => f.length === 13);
}

/** Jede Spalte absteigend sortiert: Dann lässt sich alles der Reihe nach ablegen. */
export function freeCellTrivial(state: FreeCellState): boolean {
  return state.tableau.every((column) => column.every((card, i) => i === 0 || cardRank(column[i - 1] as CardId) >= cardRank(card)));
}
