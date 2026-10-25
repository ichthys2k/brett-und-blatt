import { mctsSearch, stateFor, type BotDefinition, type BotLevel } from '@brett-und-blatt/engine';
import type { FourInARowMove, FourInARowState } from './rules';
import { FourInARowSearch } from './search';

const MAX_DEPTH: Record<BotLevel, number> = { easy: 2, medium: 6, hard: 64 };
const MCTS_ITERATIONS: Record<BotLevel, number> = { easy: 150, medium: 2_000, hard: 100_000 };

/**
 * Standard-Bot: rechnet mit Alpha-Beta voraus.
 * - leicht: 2 Züge tief, macht ab und zu einen Zufallszug
 * - mittel: 6 Züge tief
 * - schwer: so tief, wie die Zeit erlaubt
 *
 * Mit PopOut gibt es zusätzlich Herauszieh-Züge; dafür nimmt er die allgemeine Monte-Carlo-Suche.
 */
export const fourInARowBot: BotDefinition<FourInARowState, FourInARowMove> = {
  id: 'four-in-a-row',
  name: 'Vorausrechner',
  levels: ['easy', 'medium', 'hard'],
  chooseMove(ctx) {
    const state = stateFor(ctx);
    if (state.popOut) {
      return mctsSearch(ctx.module, state, ctx.seat, ctx.rng, {
        iterations: MCTS_ITERATIONS[ctx.level],
        timeBudgetMs: ctx.timeBudgetMs,
        now: ctx.now,
        winCheck: ctx.level !== 'easy',
      });
    }
    if (ctx.level === 'easy' && ctx.rng.chance(0.25)) return ctx.rng.pick(ctx.module.legalMoves(state, ctx.seat));
    const column = new FourInARowSearch(state).bestColumn(ctx.seat, {
      maxDepth: MAX_DEPTH[ctx.level],
      timeBudgetMs: ctx.level === 'hard' ? ctx.timeBudgetMs : Math.min(ctx.timeBudgetMs, 600),
      now: ctx.now,
      rng: ctx.rng,
    });
    return { type: 'drop', column };
  },
};
