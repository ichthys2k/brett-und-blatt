import type { BotContext, BotDefinition } from '@brett-und-blatt/engine';
import { CARDS_DB } from './cards';
import { evaluate, legalMoves, applyMove } from './rules';
import type { DrachenspielMove, DrachenspielState, DrachenspielView } from './types';

export const botDrachenhueter: BotDefinition<
  DrachenspielState,
  DrachenspielMove,
  DrachenspielView
> = {
  id: 'drachenhueter',
  name: 'Drachenhüter',
  levels: ['easy', 'medium', 'hard'],
  delayMs({ move, level }) {
    if (move.type === 'attack') {
      return level === 'easy' ? 750 : level === 'medium' ? 650 : 600;
    }
    if (move.type === 'playCard') {
      return level === 'easy' ? 500 : 400;
    }
    if (move.type === 'endTurn') {
      return 350;
    }
    return 350;
  },
  chooseMove(ctx: BotContext<DrachenspielState, DrachenspielMove, DrachenspielView>): DrachenspielMove {
    // If in deck selection or mulligan, handle straightforwardly
    if (ctx.view.phase === 'deckSelection') {
      const themes = ['forest', 'sea', 'farm', 'wild', 'bugs'] as const;
      return { type: 'chooseDeck', deck: ctx.rng.pick(themes) };
    }

    if (ctx.view.phase === 'mulligan') {
      // Discard cards that cost >= 4
      const me = ctx.view.players[ctx.seat];
      const discardIndices: number[] = [];
      if (me.hand) {
        me.hand.forEach((card, idx) => {
          const def = CARDS_DB[card.defId];
          if (def && def.cost >= 4) discardIndices.push(idx);
        });
      }
      return { type: 'mulligan', discardIndices };
    }

    // In play phase: reconstruct a sample state
    const sampleState = ctx.module.sampleHidden!(ctx.view, ctx.seat, ctx.rng);
    const moves = legalMoves(sampleState, ctx.seat);
    if (moves.length === 0) return { type: 'endTurn' };
    if (moves.length === 1) return moves[0];

    if (ctx.level === 'easy') {
      // Easy bot: plays cards or attacks randomly
      return ctx.rng.pick(moves);
    }

    if (ctx.level === 'medium') {
      // Medium bot: checks for lethal on enemy hero first, then plays cards/trades
      const attacks = moves.filter((m) => m.type === 'attack');
      const lethal = attacks.find((m) => {
        if (m.type !== 'attack' || m.target.kind !== 'hero') return false;
        const enemy = sampleState.players[1 - ctx.seat];
        const attacker = sampleState.players[ctx.seat].board.find((b) => b.id === m.attackerId);
        return attacker && enemy.health <= attacker.attack;
      });
      if (lethal) return lethal;

      // Prefer playing cards if mana is available
      const cardPlays = moves.filter((m) => m.type === 'playCard');
      if (cardPlays.length > 0 && ctx.rng.next() < 0.7) {
        // Pick card with highest cost
        cardPlays.sort((a, b) => {
          if (a.type !== 'playCard' || b.type !== 'playCard') return 0;
          const me = sampleState.players[ctx.seat];
          const costA = CARDS_DB[me.hand[a.handIndex]?.defId]?.cost ?? 0;
          const costB = CARDS_DB[me.hand[b.handIndex]?.defId]?.cost ?? 0;
          return costB - costA;
        });
        return cardPlays[0];
      }

      // If attack exists, prefer killing minions over face unless enemy has no minions
      if (attacks.length > 0) {
        const minionAttacks = attacks.filter((m) => m.type === 'attack' && m.target.kind === 'minion');
        if (minionAttacks.length > 0) {
          return ctx.rng.pick(minionAttacks);
        }
        return attacks[0];
      }

      return { type: 'endTurn' };
    }

    // Hard bot: evaluates one-ply step with `evaluate()`
    let bestMove = moves[0];
    let bestScore = -Infinity;

    for (const move of moves) {
      try {
        const res = applyMove(sampleState, ctx.seat, move);
        const score = evaluate(res.state, ctx.seat);
        // Add small random noise to break ties
        const perturbedScore = score + ctx.rng.next() * 0.1;
        if (perturbedScore > bestScore) {
          bestScore = perturbedScore;
          bestMove = move;
        }
      } catch {
        // Ignore invalid moves
      }
    }

    return bestMove;
  },
};

export const bots = [botDrachenhueter];
