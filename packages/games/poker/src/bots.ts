import { alphaBetaSearch, mctsSearch, stateFor, type BotDefinition } from '@brett-und-blatt/engine';
import { evaluate, type TicTacToeMove, type TicTacToeState } from './rules';

/**
 * Der Standard-Bot für Poker. Ein Bot bekommt nur die Sicht seines Platzes –
 * bei offenen Spielen wie diesem ist das der ganze Spielstand.
 *
 * - leicht: oft ein zufälliger Zug, sonst eine kurze Suche
 * - mittel: Monte-Carlo-Suche (MCTS) mit wenigen Durchläufen
 * - schwer: rechnet bis zum Ende durch und verliert deshalb nie
 */
export const ticTacToeBot: BotDefinition<TicTacToeState, TicTacToeMove> = {
  id: 'poker',
  name: 'Poker-Bot',
  levels: ['easy', 'medium', 'hard'],
  chooseMove(ctx) {
    const state = stateFor(ctx);
    const moves = ctx.module.legalMoves(state, ctx.seat);
    if (ctx.level === 'easy') {
      if (ctx.rng.chance(0.5)) return ctx.rng.pick(moves);
      return mctsSearch(ctx.module, state, ctx.seat, ctx.rng, { iterations: 40 });
    }
    if (ctx.level === 'medium') {
      return mctsSearch(ctx.module, state, ctx.seat, ctx.rng, { iterations: 400, winCheck: true, timeBudgetMs: ctx.timeBudgetMs, now: ctx.now });
    }
    return alphaBetaSearch(ctx.module, state, ctx.seat, { maxDepth: 9, evaluate }).move;
  },
};
