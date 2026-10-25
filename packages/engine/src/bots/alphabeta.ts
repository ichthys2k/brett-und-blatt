import { settleSystemMoves } from '../module-helpers';
import type { Actor, GameModule, SeatId } from '../types';

export interface AlphaBetaOptions<S, M> {
  maxDepth: number;
  timeBudgetMs?: number;
  now?: () => number;
  /** Bewertung einer Stellung aus Sicht von `seat` (positiv = gut für `seat`). */
  evaluate: (state: S, seat: SeatId) => number;
  /** Gute Züge zuerst untersuchen – dann schneidet Alpha-Beta mehr ab. */
  orderMoves?: (state: S, moves: M[]) => M[];
}

export interface AlphaBetaResult<M> {
  move: M;
  score: number;
  depth: number;
}

/** Wert eines Sieges; schnellere Siege zählen etwas mehr. */
export const WIN_SCORE = 1_000_000;

class TimeUp extends Error {}

/**
 * Minimax mit Alpha-Beta-Schnitt für Zwei-Personen-Spiele ohne Geheimnisse:
 * rechnet Züge voraus und lässt Zweige weg, die ohnehin nicht gewählt würden.
 * Iterative Vertiefung: erst 1 Zug tief, dann 2, 3 … – bis die Zeit um ist.
 */
export function alphaBetaSearch<S, M, V>(module: GameModule<S, M, V>, rootState: S, seat: SeatId, options: AlphaBetaOptions<S, M>): AlphaBetaResult<M> {
  const now = options.now ?? (() => Date.now());
  const deadline = options.timeBudgetMs === undefined ? Infinity : now() + options.timeBudgetMs;
  let nodes = 0;

  const order = (state: S, moves: M[]) => (options.orderMoves ? options.orderMoves(state, moves) : moves);

  const search = (state: S, depth: number, ply: number, alpha: number, beta: number): number => {
    if ((++nodes & 1023) === 0 && now() > deadline) throw new TimeUp();
    const settled = settleSystemMoves(module, state);
    const result = module.result(settled);
    if (result) {
      if (result.kind === 'draw') return 0;
      if (result.kind === 'loss') return -WIN_SCORE + ply;
      return result.winners.includes(seat) ? WIN_SCORE - ply : -WIN_SCORE + ply;
    }
    if (depth === 0) return options.evaluate(settled, seat);
    const actor = firstSeat(module.currentPlayers(settled));
    if (actor === null) return options.evaluate(settled, seat);
    const maximizing = actor === seat;
    let best = maximizing ? -Infinity : Infinity;
    for (const move of order(settled, module.legalMoves(settled, actor))) {
      const score = search(module.applyMove(settled, actor, move).state, depth - 1, ply + 1, alpha, beta);
      if (maximizing) {
        best = Math.max(best, score);
        alpha = Math.max(alpha, score);
      } else {
        best = Math.min(best, score);
        beta = Math.min(beta, score);
      }
      if (alpha >= beta) break;
    }
    return best;
  };

  let rootMoves = order(rootState, module.legalMoves(rootState, seat));
  if (rootMoves.length === 0) throw new Error('Keine erlaubten Züge.');
  let best: AlphaBetaResult<M> = { move: rootMoves[0] as M, score: 0, depth: 0 };

  for (let depth = 1; depth <= options.maxDepth; depth++) {
    try {
      let alpha = -Infinity;
      let bestMove = rootMoves[0] as M;
      let bestScore = -Infinity;
      for (const move of rootMoves) {
        const score = search(module.applyMove(rootState, seat, move).state, depth - 1, 1, alpha, Infinity);
        if (score > bestScore) {
          bestScore = score;
          bestMove = move;
        }
        alpha = Math.max(alpha, score);
      }
      best = { move: bestMove, score: bestScore, depth };
      // Den besten Zug der letzten Tiefe zuerst untersuchen.
      rootMoves = [bestMove, ...rootMoves.filter((m) => m !== bestMove)];
      if (Math.abs(bestScore) >= WIN_SCORE - 1000) break;
    } catch (error) {
      if (error instanceof TimeUp) break;
      throw error;
    }
  }
  return best;
}

function firstSeat(actors: Actor[]): SeatId | null {
  for (const actor of actors) if (actor !== 'system') return actor;
  return null;
}
