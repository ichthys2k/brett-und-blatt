import type { BotLevel, SeatId } from '@brett-und-blatt/engine';
import {
  applyMove,
  evaluate,
  boardMoves,
  result,
  type CheckersStep,
  type CheckersState,
} from './rules';

export interface SearchOptions {
  maxDepth: number;
  timeBudgetMs: number;
  now?: () => number;
  random?: () => number;
  noise?: number;
}

class TimeUp extends Error {}

const WIN_SCORE = 100_000;

export const BOT_LEVELS: Record<BotLevel, { depth: number; maxMs: number; noise: number }> = {
  easy: { depth: 2, maxMs: 300, noise: 120 },
  medium: { depth: 4, maxMs: 800, noise: 25 },
  hard: { depth: 8, maxMs: Infinity, noise: 0 },
};

/**
 * Sortiert Züge für effizienten Alpha-Beta-Schnitt:
 * Schlagzüge mit den meisten Opfern zuerst, danach Züge vorwärts bzw. Damenzüge.
 */
export function orderCheckersMoves(moves: CheckersStep[]): CheckersStep[] {
  return [...moves].sort((a, b) => {
    const aCaps = a.captures?.length ?? 0;
    const bCaps = b.captures?.length ?? 0;
    if (aCaps !== bCaps) return bCaps - aCaps;
    return 0;
  });
}

/**
 * Negamax-Suche mit Alpha-Beta-Schnitt für Dame – technisch angelehnt an ChessSearch.
 */
export class CheckersSearch {
  private deadline = Infinity;
  private now: () => number = () => Date.now();
  nodes = 0;

  constructor(private readonly rootState: CheckersState) {}

  bestMove(options: SearchOptions): CheckersStep {
    this.now = options.now ?? (() => Date.now());
    this.deadline = this.now() + options.timeBudgetMs;
    this.nodes = 0;
    const random = options.random ?? Math.random;

    const actor = this.rootState.turn;
    let rootMoves = orderCheckersMoves(boardMoves(this.rootState, actor));
    if (rootMoves.length === 0) throw new Error('Keine erlaubten Züge.');
    if (rootMoves.length === 1) return rootMoves[0]!;

    let best = rootMoves[0]!;

    for (let depth = 1; depth <= options.maxDepth; depth++) {
      try {
        let bestScore = -Infinity;
        const scored: { move: CheckersStep; score: number }[] = [];

        for (const move of rootMoves) {
          if ((++this.nodes & 511) === 0 && this.now() > this.deadline) throw new TimeUp();

          const next = applyMove(this.rootState, actor, move).state;
          // Wenn mit Rauschen gerechnet wird, brauchen wir den genauen Wert
          const beta = options.noise ? Infinity : 1 - bestScore;
          const score =
            -this.negamax(next, 1 - actor as SeatId, depth - 1, -Infinity, beta, 1) +
            (options.noise ? (random() - 0.5) * 2 * options.noise : 0);

          scored.push({ move, score });
          if (score > bestScore) bestScore = score;
        }

        const top = scored.filter((s) => s.score >= bestScore - (options.noise ? 0 : 0.5));
        best = (top[Math.floor(random() * top.length)] ?? scored[0])!.move;
        rootMoves = [best, ...rootMoves.filter((m) => m !== best)];

        if (Math.abs(bestScore) > WIN_SCORE - 1000) break;
      } catch (error) {
        if (error instanceof TimeUp) break;
        throw error;
      }
    }

    return best;
  }

  private negamax(
    state: CheckersState,
    currentSeat: SeatId,
    depth: number,
    alpha: number,
    beta: number,
    ply: number,
  ): number {
    if ((++this.nodes & 511) === 0 && this.now() > this.deadline) throw new TimeUp();

    const res = result(state);
    if (res) {
      if (res.kind === 'draw') return 0;
      if (res.kind === 'win') {
        return res.winners.includes(currentSeat) ? WIN_SCORE - ply : -WIN_SCORE + ply;
      }
      return -WIN_SCORE + ply;
    }

    if (depth <= 0) {
      return evaluate(state, currentSeat);
    }

    const moves = orderCheckersMoves(boardMoves(state, currentSeat));
    if (moves.length === 0) {
      return -WIN_SCORE + ply;
    }

    let maxScore = -Infinity;
    for (const move of moves) {
      const next = applyMove(state, currentSeat, move).state;
      const score = -this.negamax(next, 1 - currentSeat as SeatId, depth - 1, -beta, -alpha, ply + 1);
      if (score > maxScore) maxScore = score;
      if (score > alpha) alpha = score;
      if (alpha >= beta) break;
    }

    return maxScore;
  }
}
