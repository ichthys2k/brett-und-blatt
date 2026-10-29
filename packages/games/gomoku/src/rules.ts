import type { Actor, GameEvent, MoveResult, Result } from '@brett-und-blatt/engine';
import type { GomokuMove, GomokuState } from './types';

export const BOARD_SIZE = 15;
export const WIN_LENGTH = 5;

export const DIRECTIONS: readonly [number, number][] = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
];

export function setup(): GomokuState {
  return {
    size: BOARD_SIZE,
    board: Array(BOARD_SIZE * BOARD_SIZE).fill(null),
    turn: 0,
    winner: null,
    winLine: null,
  };
}

export function currentPlayers(state: GomokuState): Actor[] {
  return result(state) ? [] : [state.turn];
}

export function legalMoves(state: GomokuState, actor: Actor): GomokuMove[] {
  if (actor !== state.turn || result(state)) return [];
  const moves: GomokuMove[] = [];
  const total = state.size * state.size;
  for (let cell = 0; cell < total; cell++) {
    if (state.board[cell] === null) {
      moves.push({ type: 'place', cell });
    }
  }
  return moves;
}

export function findWinLine(board: (number | null)[], size: number, seat: number, lastCell?: number): number[] | null {
  // Schneller Pfad: nur Linien durch den gerade gesetzten Stein prüfen.
  if (lastCell !== undefined) {
    const col = lastCell % size;
    const row = Math.floor(lastCell / size);
    for (const [dc, dr] of DIRECTIONS) {
      const line: number[] = [];
      for (let i = 1; i < WIN_LENGTH; i++) {
        const c = col - dc * i;
        const r = row - dr * i;
        if (c < 0 || c >= size || r < 0 || r >= size) break;
        const idx = r * size + c;
        if (board[idx] === seat) line.unshift(idx);
        else break;
      }
      line.push(lastCell);
      for (let i = 1; i < WIN_LENGTH; i++) {
        const c = col + dc * i;
        const r = row + dr * i;
        if (c < 0 || c >= size || r < 0 || r >= size) break;
        const idx = r * size + c;
        if (board[idx] === seat) line.push(idx);
        else break;
      }
      if (line.length >= WIN_LENGTH) {
        const idx = line.indexOf(lastCell);
        const start = Math.max(0, Math.min(idx - 2, line.length - WIN_LENGTH));
        return line.slice(start, start + WIN_LENGTH);
      }
    }
    return null;
  }

  const total = size * size;
  for (let start = 0; start < total; start++) {
    const col = start % size;
    const row = Math.floor(start / size);
    for (const [dc, dr] of DIRECTIONS) {
      const line: number[] = [];
      for (let i = 0; i < WIN_LENGTH; i++) {
        const c = col + dc * i;
        const r = row + dr * i;
        if (c < 0 || c >= size || r < 0 || r >= size) break;
        const idx = r * size + c;
        if (board[idx] === seat) {
          line.push(idx);
        } else {
          break;
        }
      }
      if (line.length === WIN_LENGTH) {
        return line;
      }
    }
  }
  return null;
}

export function applyMove(state: GomokuState, actor: Actor, move: GomokuMove): MoveResult<GomokuState> {
  if (actor !== state.turn || result(state)) throw new Error('Du bist nicht am Zug.');
  if (move.type !== 'place') throw new Error('Ungültiger Zug.');
  const total = state.size * state.size;
  if (!Number.isInteger(move.cell) || move.cell < 0 || move.cell >= total) throw new Error('Dieses Feld gibt es nicht.');
  if (state.board[move.cell] !== null) throw new Error('Dieses Feld ist nicht frei.');

  const board = [...state.board];
  board[move.cell] = actor;
  const events: GameEvent[] = [{ type: 'placed', cell: move.cell, seat: actor }];

  const winLine = findWinLine(board, state.size, actor, move.cell);
  if (winLine) {
    events.push({ type: 'win', seat: actor, line: [...winLine] });
  }

  return {
    state: {
      size: state.size,
      board,
      turn: 1 - actor,
      winner: winLine ? actor : null,
      winLine: winLine ? [...winLine] : null,
    },
    events,
  };
}

export function result(state: GomokuState): Result | null {
  if (state.winner !== null) return { kind: 'win', winners: [state.winner] };
  const total = state.size * state.size;
  if (state.board.every((cell) => cell !== null)) return { kind: 'draw' };
  return null;
}

export function evaluate(state: GomokuState, seat: number): number {
  const size = state.size;
  const total = size * size;
  let score = 0;
  const opponent = 1 - seat;
  
  for (let start = 0; start < total; start++) {
    const col = start % size;
    const row = Math.floor(start / size);
    for (const [dc, dr] of DIRECTIONS) {
      let ownCount = 0;
      let oppCount = 0;
      for (let i = 0; i < WIN_LENGTH; i++) {
        const c = col + dc * i;
        const r = row + dr * i;
        if (c < 0 || c >= size || r < 0 || r >= size) break;
        const idx = r * size + c;
        if (state.board[idx] === seat) ownCount++;
        if (state.board[idx] === opponent) oppCount++;
      }
      if (oppCount === 0 && ownCount > 0) score += ownCount * ownCount;
      if (ownCount === 0 && oppCount > 0) score -= oppCount * oppCount;
    }
  }
  return score;
}
