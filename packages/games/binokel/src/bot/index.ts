import type { BotContext, BotDefinition } from '@brett-und-blatt/engine';
import type { BinokelMove, BinokelState } from '../types.js';
import { legalMoves } from '../rules.js';

export const binokelBot: BotDefinition<BinokelState, BinokelMove, BinokelState> = {
  id: 'binokel:schwaben-ass',
  name: 'Schwaben-Ass',
  levels: ['easy', 'medium', 'hard'],
  chooseMove(ctx: BotContext<BinokelState, BinokelMove, BinokelState>): BinokelMove {
    const state = ctx.view as BinokelState;
    const moves = legalMoves(state, ctx.seat);
    if (moves.length === 0) throw new Error('Keine legalen Züge für Binokel-Bot');
    if (state.phase === 'bidding') {
      const bidMoves = moves.filter((m) => m.type === 'bid') as any[];
      if (bidMoves.length === 0) return { type: 'pass' };
      return bidMoves[0];
    }
    if (state.phase === 'dabbDecision') {
      if (moves.some((m) => m.type === 'takeDabb')) return { type: 'takeDabb' };
      const durch = moves.find((m) => m.type === 'declareDurch');
      if (durch) return durch;
      if (moves.some((m) => m.type === 'fold')) return { type: 'fold' };
    }
    if (state.phase === 'trumpChoice') {
      return moves[0];
    }
    if (state.phase === 'meld') {
      return { type: 'confirmMelds', melds: [] };
    }
    if (state.phase === 'play') {
      return moves[0];
    }
    return moves[0];
  },
};
