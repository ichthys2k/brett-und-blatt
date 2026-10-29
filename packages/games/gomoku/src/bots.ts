import { Rng, type BotContext, type BotDefinition } from '@brett-und-blatt/engine';
import type { GomokuMove, GomokuState } from './types';
import { legalMoves, WIN_LENGTH, DIRECTIONS, BOARD_SIZE, findWinLine } from './rules';

function getLineScore(board: (number | null)[], size: number, seat: number, col: number, row: number, dc: number, dr: number): number {
  let count = 0;
  let open = 0;
  for (let i = -4; i <= 4; i++) {
    const c = col + dc * i;
    const r = row + dr * i;
    if (c < 0 || c >= size || r < 0 || r >= size) continue;
    const idx = r * size + c;
    const val = board[idx];
    if (val === seat) count++;
    else if (val === null) open++;
  }
  if (count >= WIN_LENGTH) return 100000;
  if (count === 4) return 10000;
  if (count === 3 && open >= 2) return 1000;
  if (count === 3) return 100;
  if (count === 2 && open >= 2) return 10;
  return count;
}

function evaluateMove(state: GomokuState, move: GomokuMove, seat: number): number {
  const size = state.size;
  const col = move.cell % size;
  const row = Math.floor(move.cell / size);
  const board = [...state.board];
  board[move.cell] = seat;
  let score = 0;
  for (const [dc, dr] of DIRECTIONS) {
    score += getLineScore(board, size, seat, col, row, dc, dr);
  }
  const opponent = 1 - seat;
  const boardOpp = [...state.board];
  boardOpp[move.cell] = opponent;
  let blockScore = 0;
  for (const [dc, dr] of DIRECTIONS) {
    blockScore += getLineScore(boardOpp, size, opponent, col, row, dc, dr);
  }
  return score * 2 + blockScore;
}

/**
 * Kandidatenfelder: nur leere Felder in der Nähe (Chebyshev-Abstand ≤ 2) zu bereits
 * besetzten Steinen. Ein Zug weit weg vom Geschehen gewinnt selten – und alle 225
 * Felder durchzuprobieren (mit Tiefenklon) war der Grund für die 10-s-Prüfung.
 * Auf leerem Brett nur die Mitte.
 */
function candidateCells(state: GomokuState): number[] {
  const size = state.size;
  const total = size * size;
  const hasStone = state.board.some((cell) => cell !== null);
  if (!hasStone) return [Math.floor(total / 2)];

  const result: number[] = [];
  const seen = new Set<number>();
  for (let cell = 0; cell < total; cell++) {
    if (state.board[cell] !== null) continue;
    const col = cell % size;
    const row = Math.floor(cell / size);
    let near = false;
    outer: for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        if (dr === 0 && dc === 0) continue;
        const r = row + dr;
        const c = col + dc;
        if (r < 0 || r >= size || c < 0 || c >= size) continue;
        if (state.board[r * size + c] !== null) {
          near = true;
          break outer;
        }
      }
    }
    if (near && !seen.has(cell)) {
      seen.add(cell);
      result.push(cell);
    }
  }
  if (result.length === 0) {
    for (let cell = 0; cell < total; cell++) {
      if (state.board[cell] === null) result.push(cell);
    }
  }
  return result;
}

function candidateMoves(state: GomokuState, seat: number): GomokuMove[] {
  const allowed = new Set(candidateCells(state));
  return legalMoves(state, seat).filter((move) => allowed.has(move.cell));
}


function wouldWin(state: GomokuState, seat: number, cell: number): boolean {
  const board = [...state.board];
  board[cell] = seat;
  return findWinLine(board, state.size, seat, cell) !== null;
}

export const gomokuBotEasy: BotDefinition<GomokuState, GomokuMove> = {
  id: 'gomoku-easy',
  name: 'Anfänger',
  levels: ['easy'],
  chooseMove(ctx: BotContext<GomokuState, GomokuMove, GomokuState>): GomokuMove {
    const { view, seat, rng } = ctx;
    const moves = legalMoves(view as GomokuState, seat);
    if (moves.length === 0) throw new Error('Kein Zug');
    const center = Math.floor((BOARD_SIZE * BOARD_SIZE) / 2);
    const move = moves.find((m: any) => m.cell === center) ?? moves[rng.int(moves.length)]!;
    return move;
  },
};

export const gomokuBotMedium: BotDefinition<GomokuState, GomokuMove> = {
  id: 'gomoku-medium',
  name: 'Fortgeschritten',
  levels: ['medium'],
  chooseMove(ctx: BotContext<GomokuState, GomokuMove, GomokuState>): GomokuMove {
    const { view, seat } = ctx;
    const s = view as GomokuState;
    const moves = candidateMoves(s, seat);
    if (moves.length === 0) throw new Error('Kein Zug');

    for (const move of moves) {
      if (wouldWin(s, seat, move.cell)) {
        return move;
      }
    }

    const opponent = 1 - seat;
    for (const move of moves) {
      if (wouldWin(s, opponent, move.cell)) {
        return move;
      }
    }

    let bestMove = moves[0]!;
    let bestScore = -Infinity;
    for (const move of moves) {
      const score = evaluateMove(s, move as any, seat as any);
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
        if (bestScore >= 10000) break;
      }
    }
    return bestMove;
  },
};

export const gomokuBotHard: BotDefinition<GomokuState, GomokuMove> = {
  id: 'gomoku-hard',
  name: 'Meister',
  levels: ['hard'],
  chooseMove(ctx: BotContext<GomokuState, GomokuMove, GomokuState>): GomokuMove {
    const { view, seat } = ctx;
    const s = view as GomokuState;
    const moves = candidateMoves(s, seat);
    if (moves.length === 0) throw new Error('Kein Zug');

    for (const move of moves) {
      if (wouldWin(s, seat, move.cell)) {
        return move;
      }
    }

    const opponent = 1 - seat;
    for (const move of moves) {
      if (wouldWin(s, opponent, move.cell)) {
        return move;
      }
    }

    const candidates = moves
      .map((move: any) => ({ move, score: evaluateMove(s, move, seat as any) }))
      .filter((c: any) => c.score > 0)
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, 20);

    if (candidates.length === 0) {
      const center = Math.floor((BOARD_SIZE * BOARD_SIZE) / 2);
      const move = moves.find((m: any) => m.cell === center) ?? moves[0]!;
      return move;
    }

    let bestMove = candidates[0].move;
    let bestScore = -Infinity;
    for (const { move } of candidates) {
      const score = evaluateMove(s, move, seat as any);
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
        if (bestScore >= 10000) break;
      }
    }
    return bestMove;
  },
};
