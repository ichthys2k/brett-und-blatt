import { type BotContext, type BotDefinition } from '@brett-und-blatt/engine';
import { calculateScore, type KniffelMove, type KniffelState } from './rules';

export const kniffelBot: BotDefinition<KniffelState, KniffelMove> = {
  id: 'kniffel',
  name: 'Kniffel-Bot',
  levels: ['easy', 'medium', 'hard'],
  chooseMove(ctx: BotContext<KniffelState, KniffelMove, KniffelState>): KniffelMove {
    const { view, rng } = ctx;
    const moves = ctx.module.legalMoves(view, ctx.seat);
    if (moves.length === 0) throw new Error('Kein Zug');
    
    const rollMove = moves.find((m: any) => m.type === 'roll');
    if (rollMove && view.rollsLeft > 0) {
      // Just roll - UI/bots can manage holds separately, but legalMoves only gives roll/score
      // Keep it simple
      return rollMove;
    }

    const scoreMoves = moves.filter((m: any): m is Extract<KniffelMove, { type: 'score' }> => m.type === 'score');
    if (scoreMoves.length === 0) throw new Error('Kein Zug');
    if (ctx.level === 'easy') {
      return scoreMoves[rng.int(scoreMoves.length)]!;
    }
    if (!view.dice) return scoreMoves[0]!;

    let bestMove = scoreMoves[0]!;
    let bestScore = -1;
    for (const move of scoreMoves) {
      const s = calculateScore(move.category, view.dice.values);
      if (move.category === 'kniffel' && s === 50) {
        return move;
      }
      if (ctx.level === 'hard') {
        if ((move.category === 'largeStraight' && s === 40) || (move.category === 'smallStraight' && s === 30)) {
          return move;
        }
      }
      if (s > bestScore) {
        bestScore = s;
        bestMove = move;
      } else if (s === bestScore && rng.next() < 0.3) {
        bestMove = move;
      }
    }
    if (bestScore === 0 && scoreMoves.length > 1 && ctx.level === 'hard') {
      const upperEmpty = scoreMoves.filter((m: any) => ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'].includes(m.category));
      if (upperEmpty.length > 0) {
        return upperEmpty[upperEmpty.length - 1]!;
      }
    }
    return bestMove;
  },
};
