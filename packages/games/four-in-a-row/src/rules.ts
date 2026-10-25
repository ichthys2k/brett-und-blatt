import type { Actor, GameEvent, MoveResult, Options, Result, SeatId } from '@brett-und-blatt/engine';

export interface FourInARowState {
  cols: number;
  rows: number;
  /** Felder spaltenweise von unten nach oben: `cells[col * rows + row]`, Reihe 0 ist unten. */
  cells: (SeatId | null)[];
  turn: SeatId;
  popOut: boolean;
  winner: SeatId | null;
  /** Feldindizes aller Vierer des Gewinners (für die Hervorhebung). */
  winLines: number[][];
  draw: 'full' | 'repetition' | 'moveLimit' | 'stuck' | null;
  moveCount: number;
  lastMove: FourInARowMove | null;
  /** Nur PopOut: wie oft jede Stellung schon vorkam (Wiederholungsregel). */
  seen: Record<string, number>;
}

export type FourInARowMove = { type: 'drop'; column: number } | { type: 'pop'; column: number };

export const SIZES: Record<string, [cols: number, rows: number]> = {
  '6x5': [6, 5],
  '7x6': [7, 6],
  '8x7': [8, 7],
  '9x7': [9, 7],
};

/** PopOut kann endlos laufen – nach so vielen Zügen ist es unentschieden. */
export const POPOUT_MOVE_LIMIT = 200;

const DIRECTIONS: readonly [number, number][] = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
];

export function setup(_seats: number, options: Options): FourInARowState {
  const [cols, rows] = SIZES[options.size ?? '7x6'] ?? [7, 6];
  const state: FourInARowState = {
    cols,
    rows,
    cells: Array(cols * rows).fill(null),
    turn: 0,
    popOut: options.popOut === 'on',
    winner: null,
    winLines: [],
    draw: null,
    moveCount: 0,
    lastMove: null,
    seen: {},
  };
  return state.popOut ? { ...state, seen: { [positionKey(state.cells, 0)]: 1 } } : state;
}

export function cellIndex(state: Pick<FourInARowState, 'rows'>, col: number, row: number): number {
  return col * state.rows + row;
}

export function columnHeight(state: Pick<FourInARowState, 'rows' | 'cells'>, col: number): number {
  let height = 0;
  while (height < state.rows && state.cells[col * state.rows + height] !== null) height++;
  return height;
}

export function currentPlayers(state: FourInARowState): Actor[] {
  return result(state) ? [] : [state.turn];
}

export function legalMoves(state: FourInARowState, actor: Actor): FourInARowMove[] {
  if (actor !== state.turn || result(state)) return [];
  const moves: FourInARowMove[] = [];
  for (let col = 0; col < state.cols; col++) {
    if (columnHeight(state, col) < state.rows) moves.push({ type: 'drop', column: col });
  }
  if (state.popOut) {
    for (let col = 0; col < state.cols; col++) {
      if (state.cells[col * state.rows] === actor) moves.push({ type: 'pop', column: col });
    }
  }
  return moves;
}

export function applyMove(state: FourInARowState, actor: Actor, move: FourInARowMove): MoveResult<FourInARowState> {
  if (actor !== state.turn || result(state)) throw new Error('Du bist nicht am Zug.');
  const { cols, rows } = state;
  if (!Number.isInteger(move.column) || move.column < 0 || move.column >= cols) throw new Error('Diese Spalte gibt es nicht.');

  const cells = [...state.cells];
  const events: GameEvent[] = [];
  const opponent = 1 - actor;

  if (move.type === 'drop') {
    const row = columnHeight(state, move.column);
    if (row >= rows) throw new Error('Diese Spalte ist voll.');
    cells[move.column * rows + row] = actor;
    events.push({ type: 'dropped', column: move.column, row, seat: actor });
  } else {
    if (!state.popOut || cells[move.column * rows] !== actor) throw new Error('Hier kannst du keinen Stein herausziehen.');
    for (let row = 0; row < rows - 1; row++) cells[move.column * rows + row] = cells[move.column * rows + row + 1] ?? null;
    cells[move.column * rows + rows - 1] = null;
    events.push({ type: 'popped', column: move.column, seat: actor });
  }

  // Wer zieht und dabei (auch) einen Vierer hat, gewinnt – beim Herausziehen
  // kann auch ein Vierer des Gegners entstehen.
  const ownLines = findLines(cells, cols, rows, actor);
  const otherLines = move.type === 'pop' ? findLines(cells, cols, rows, opponent) : [];
  const winner = ownLines.length > 0 ? actor : otherLines.length > 0 ? opponent : null;
  const winLines = winner === actor ? ownLines : winner === opponent ? otherLines : [];
  if (winner !== null) events.push({ type: 'win', seat: winner, lines: winLines });

  const next: FourInARowState = {
    ...state,
    cells,
    turn: opponent,
    winner,
    winLines,
    moveCount: state.moveCount + 1,
    lastMove: move,
  };

  if (winner === null) {
    if (state.popOut) {
      const key = positionKey(cells, opponent);
      next.seen = { ...state.seen, [key]: (state.seen[key] ?? 0) + 1 };
      if ((next.seen[key] ?? 0) >= 3) next.draw = 'repetition';
      else if (next.moveCount >= POPOUT_MOVE_LIMIT) next.draw = 'moveLimit';
      else if (legalMoves(next, opponent).length === 0) next.draw = 'stuck';
    } else if (cells.every((cell) => cell !== null)) {
      next.draw = 'full';
    }
    if (next.draw) events.push({ type: 'draw', reason: next.draw });
  }

  return { state: next, events };
}

export function result(state: FourInARowState): Result | null {
  if (state.winner !== null) return { kind: 'win', winners: [state.winner] };
  if (state.draw) return { kind: 'draw', reason: state.draw };
  return null;
}

/** Alle Vierer (Feldindizes) eines Platzes – waagerecht, senkrecht und diagonal. */
export function findLines(cells: readonly (SeatId | null)[], cols: number, rows: number, seat: SeatId): number[][] {
  const lines: number[][] = [];
  for (let col = 0; col < cols; col++) {
    for (let row = 0; row < rows; row++) {
      for (const [dc, dr] of DIRECTIONS) {
        const endCol = col + 3 * dc;
        const endRow = row + 3 * dr;
        if (endCol < 0 || endCol >= cols || endRow < 0 || endRow >= rows) continue;
        const line = [0, 1, 2, 3].map((i) => (col + i * dc) * rows + (row + i * dr));
        if (line.every((index) => cells[index] === seat)) lines.push(line);
      }
    }
  }
  return lines;
}

function positionKey(cells: readonly (SeatId | null)[], turn: SeatId): string {
  return `${turn}:${cells.map((c) => (c === null ? '.' : c)).join('')}`;
}
