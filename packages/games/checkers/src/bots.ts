import { stateFor, type BotDefinition, type BotLevel } from '@brett-und-blatt/engine';
import { evaluate, type CheckersMove, type CheckersState } from './rules';
import { BOT_LEVELS, CheckersSearch } from './search';

/**
 * Standard-Bot für Dame: rechnet mit Negamax und Alpha-Beta-Schnitt voraus.
 * - leicht: geringe Rechentiefe und Rauschen – übersieht gern Schlaggelegenheiten
 * - mittel: 4 Halbzüge tief
 * - schwer: bis zu 8 Halbzüge tief mit vollem Zeitbudget
 * Ein Remis-Angebot nimmt er an, wenn er nach seiner Bewertung schlechter steht (`ACCEPT_DRAW_AT`,
 * ein Stein zählt 100); selbst bietet er keins an.
 */
/** Ab welcher Bewertung aus eigener Sicht nimmt der Bot ein Remis an? */
const ACCEPT_DRAW_AT: Record<BotLevel, number> = { easy: 0, medium: -150, hard: -300 };

export const checkersBot: BotDefinition<CheckersState, CheckersMove> = {
  id: 'checkers',
  name: 'Vorausrechner',
  levels: ['easy', 'medium', 'hard'],
  chooseMove(ctx) {
    const state = stateFor(ctx);
    if (state.drawOffer?.by != null) {
      return { type: evaluate(state, ctx.seat) <= ACCEPT_DRAW_AT[ctx.level] ? 'acceptDraw' : 'declineDraw' };
    }
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
