import type { BotDefinition } from '@brett-und-blatt/engine';
import { legalMoves, type NumberWallMove, type NumberWallState } from './rules';

export const numberWallBot: BotDefinition<NumberWallState, NumberWallMove> = {
  id: 'number-wall',
  name: 'Mauerbaumeister',
  levels: ['easy', 'medium', 'hard'],
  chooseMove(ctx) {
    const { view, seat, level, rng } = ctx;
    const moves = legalMoves(view, seat);
    if (moves.length === 0) {
      return { type: 'submit', values: view.givens.map((g) => g ?? 0) };
    }
    if (level === 'hard') {
      return moves[0]!;
    }
    if (level === 'medium') {
      return rng.pick(moves.slice(0, 2));
    }
    return rng.pick(moves);
  },
};
