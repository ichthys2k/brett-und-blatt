import { stateFor, type BotDefinition } from '@brett-und-blatt/engine';
import type { CheckersMove, CheckersState } from './rules';
import { BOT_LEVELS, CheckersSearch } from './search';

/**
 * Standard-Bot für Dame: rechnet mit Negamax und Alpha-Beta-Schnitt voraus.
 * - leicht: geringe Rechentiefe und Rauschen – übersieht gern Schlaggelegenheiten
 * - mittel: 4 Halbzüge tief
 * - schwer: bis zu 8 Halbzüge tief mit vollem Zeitbudget
 */
export const checkersBot: BotDefinition<CheckersState, CheckersMove> = {
  id: 'checkers',
  name: 'Vorausrechner',
  levels: ['easy', 'medium', 'hard'],
  chooseMove(ctx) {
    const state = stateFor(ctx);
    const level = BOT_LEVELS[ctx.level];
    return new CheckersSearch(state).bestMove({
      maxDepth: level.depth,
      timeBudgetMs: Math.min(level.maxMs, ctx.timeBudgetMs),
      now: ctx.now,
      random: () => ctx.rng.next(),
      noise: level.noise,
    });
  },
};
