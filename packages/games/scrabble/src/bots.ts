import type { BotContext, BotDefinition } from '@brett-und-blatt/engine';
import type { ScrabbleMove, ScrabbleState, ScrabbleView } from './rules';

export const scrabbleBot: BotDefinition<ScrabbleState, ScrabbleMove, ScrabbleView> = {
  id: 'scrabble',
  name: 'Wortmeister',
  levels: ['easy', 'medium', 'hard'],
  chooseMove(ctx: BotContext<ScrabbleState, ScrabbleMove, ScrabbleView>): ScrabbleMove {
    const { view, level, rng } = ctx;
    const moves = (ctx.module.legalMoves as any)(view, ctx.seat) as ScrabbleMove[];
    // Filter to reasonable moves
    const playMoves = moves.filter((m) => m.type === 'play');
    if (playMoves.length > 0) {
      if (level === 'easy') {
        return playMoves[Math.floor(rng.next() * Math.min(playMoves.length, 3))] || playMoves[0];
      }
      // For medium/hard, just pick first for now
      return playMoves[0];
    }
    // Try to exchange or pass
    const exchangeMoves = moves.filter((m) => m.type === 'exchange');
    if (exchangeMoves.length > 0 && level !== 'easy') {
      return exchangeMoves[0];
    }
    return { type: 'pass' };
  },
};

export const bots = [scrabbleBot];
