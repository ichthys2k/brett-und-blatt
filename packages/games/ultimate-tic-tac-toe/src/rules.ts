import type { Actor, GameEvent, MoveResult, Options, Result, SeatId } from '@brett-und-blatt/engine';

/** Besitzer eines kleinen Feldes: ein Platz, „unentschieden“ oder noch offen. */
export type BoardOwner = SeatId | 'draw' | null;

export interface UltimateState {
  /** 81 Zellen: `cells[board * 9 + cell]`, Felder und Zellen zeilenweise von oben links. */
  cells: (SeatId | null)[];
  boards: BoardOwner[];
  /** In diesem kleinen Feld muss als Nächstes gespielt werden – oder null für freie Wahl. */
  forced: number | null;
  turn: SeatId;
  winner: SeatId | null;
  winLine: number[] | null;
  draw: boolean;
  lastMove: UltimateMove | null;
  /** Entschiedene Felder bleiben bespielbar, solange sie nicht voll sind (Variante). */
  playableWhenDecided: boolean;
  /** Unentschiedene kleine Felder zählen für beide (Variante). */
  drawCountsForBoth: boolean;
}

export interface UltimateMove {
  type: 'place';
  board: number;
  cell: number;
}

export const LINES: readonly (readonly [number, number, number])[] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export function setup(_seats: number, options: Options): UltimateState {
  return {
    cells: Array(81).fill(null),
    boards: Array(9).fill(null),
    forced: null,
    turn: 0,
    winner: null,
    winLine: null,
    draw: false,
    lastMove: null,
    playableWhenDecided: options.decided === 'playable',
    drawCountsForBoth: options.drawBoard === 'both',
  };
}

function boardHasSpace(state: UltimateState, board: number): boolean {
  for (let cell = 0; cell < 9; cell++) if (state.cells[board * 9 + cell] === null) return true;
  return false;
}

/** Darf in diesem kleinen Feld noch gespielt werden? */
export function isPlayable(state: UltimateState, board: number): boolean {
  if (!boardHasSpace(state, board)) return false;
  return state.boards[board] === null || state.playableWhenDecided;
}

/** Die kleinen Felder, in denen gerade gespielt werden darf. */
export function playableBoards(state: UltimateState): number[] {
  if (state.forced !== null && isPlayable(state, state.forced)) return [state.forced];
  return [0, 1, 2, 3, 4, 5, 6, 7, 8].filter((board) => isPlayable(state, board));
}

export function currentPlayers(state: UltimateState): Actor[] {
  return result(state) ? [] : [state.turn];
}

export function legalMoves(state: UltimateState, actor: Actor): UltimateMove[] {
  if (actor !== state.turn || result(state)) return [];
  const moves: UltimateMove[] = [];
  for (const board of playableBoards(state)) {
    for (let cell = 0; cell < 9; cell++) {
      if (state.cells[board * 9 + cell] === null) moves.push({ type: 'place', board, cell });
    }
  }
  return moves;
}

export function applyMove(state: UltimateState, actor: Actor, move: UltimateMove): MoveResult<UltimateState> {
  if (actor !== state.turn || result(state)) throw new Error('Du bist nicht am Zug.');
  if (!playableBoards(state).includes(move.board) || move.cell < 0 || move.cell > 8 || state.cells[move.board * 9 + move.cell] !== null) {
    throw new Error('Hier darfst du nicht setzen.');
  }

  const cells = [...state.cells];
  cells[move.board * 9 + move.cell] = actor;
  const boards = [...state.boards];
  const events: GameEvent[] = [{ type: 'placed', board: move.board, cell: move.cell, seat: actor }];

  if (boards[move.board] === null) {
    const small = LINES.find((line) => line.every((c) => cells[move.board * 9 + c] === actor));
    if (small) {
      boards[move.board] = actor;
      events.push({ type: 'boardWon', board: move.board, seat: actor });
    } else if (!cells.slice(move.board * 9, move.board * 9 + 9).includes(null)) {
      boards[move.board] = 'draw';
    }
  }

  const next: UltimateState = { ...state, cells, boards, turn: 1 - actor, forced: move.cell, lastMove: move };
  const line = winningLine(next, actor);
  if (line) {
    next.winner = actor;
    next.winLine = line;
    events.push({ type: 'win', seat: actor, line });
  } else if (legalMoves(next, next.turn).length === 0 || (!canStillWin(next, 0) && !canStillWin(next, 1))) {
    next.draw = true;
    events.push({ type: 'draw' });
  }
  return { state: next, events };
}

function counts(state: UltimateState, board: number, seat: SeatId): boolean {
  const owner = state.boards[board];
  return owner === seat || (owner === 'draw' && state.drawCountsForBoth);
}

function winningLine(state: UltimateState, seat: SeatId): number[] | null {
  const line = LINES.find((l) => l.every((board) => counts(state, board, seat)));
  return line ? [...line] : null;
}

/** Kann dieser Platz überhaupt noch eine große Reihe schaffen? */
function canStillWin(state: UltimateState, seat: SeatId): boolean {
  return LINES.some((line) => line.every((board) => counts(state, board, seat) || state.boards[board] === null));
}

export function result(state: UltimateState): Result | null {
  if (state.winner !== null) return { kind: 'win', winners: [state.winner] };
  if (state.draw) return { kind: 'draw' };
  return null;
}
