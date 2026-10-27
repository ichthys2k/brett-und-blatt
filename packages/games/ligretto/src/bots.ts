import { stateFor, type BotDefinition } from '@brett-und-blatt/engine';
import { legalMoves, type LigrettoMove, type LigrettoState } from './rules';

export const ligrettoBot: BotDefinition<LigrettoState, LigrettoMove, LigrettoState> = {
  id: 'ligretto',
  name: 'Ligretto-Bot',
  levels: ['easy', 'medium', 'hard'],
  chooseMove(ctx) {
    const state = stateFor(ctx);
    const moves = (ctx.module.legalMoves ? ctx.module.legalMoves(state, ctx.seat) : legalMoves(state, ctx.seat)) as LigrettoMove[];
    if (moves.length === 0) return moves[0];

    const playMoves = moves.filter((m) => m.type === 'playFromHand' || m.type === 'playFromPile');
    const flipMoves = moves.filter((m) => m.type === 'flip');
    const ligrettoMoves = moves.filter((m) => m.type === 'callLigretto');

    if (ligrettoMoves.length > 0) {
      return ligrettoMoves[0];
    }

    if (ctx.level === 'easy') {
      if (playMoves.length > 0 && ctx.rng.chance(0.7)) {
        return ctx.rng.pick(playMoves);
      }
      if (flipMoves.length > 0 && ctx.rng.chance(0.5)) {
        return ctx.rng.pick(flipMoves);
      }
      return ctx.rng.pick(moves);
    }

    if (ctx.level === 'medium') {
      if (playMoves.length > 0 && ctx.rng.chance(0.9)) {
        return ctx.rng.pick(playMoves);
      }
      if (flipMoves.length > 0) {
        return ctx.rng.pick(flipMoves);
      }
      return ctx.rng.pick(moves);
    }

    if (playMoves.length > 0) {
      return ctx.rng.pick(playMoves);
    }
    if (flipMoves.length > 0) {
      return ctx.rng.pick(flipMoves);
    }
    return ctx.rng.pick(moves);
  },
};
