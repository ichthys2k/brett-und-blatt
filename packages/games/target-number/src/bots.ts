import type { BotDefinition } from '@brett-und-blatt/engine';
import { findCandidateMoves, type TargetNumberMove, type TargetNumberState } from './rules';

export const targetNumberBot: BotDefinition<TargetNumberState, TargetNumberMove> = {
  id: 'target-number',
  name: 'Rechenfuchs',
  levels: ['easy', 'medium', 'hard'],
  chooseMove(ctx) {
    const { view, level, rng } = ctx;
    const candidates = findCandidateMoves(view.cards, view.target, view.allowedOps, 3);
    if (candidates.length === 0) {
      return { type: 'submit', steps: [], finalIndex: 0 };
    }
    if (level === 'hard') {
      return candidates[0]!.move;
    }
    if (level === 'medium') {
      // Nimmt den besten oder zweitbesten Zug
      const pool = candidates.slice(0, Math.min(2, candidates.length));
      return rng.pick(pool).move;
    }
    // Leicht: nimmt einen 1- bis 2-Schritt-Versuch aus der unteren Hälfte
    const easyPool = candidates.filter((c) => c.move.steps.length <= 2);
    return rng.pick(easyPool.length > 0 ? easyPool : candidates).move;
  },
};
