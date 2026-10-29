import type { BotDefinition, BotLevel, SeatId } from '@brett-und-blatt/engine';
import { deckSize, shared } from './deck';
import { targetsFor, type SymbolMatchMove, type SymbolMatchState, type SymbolMatchView } from './rules';

/** Bedenkzeit in ms je Stufe: Grundwert, Zuschlag je Symbol auf der Karte und Streuung. */
const THINK: Record<BotLevel, { base: number; perSymbol: number; spread: number }> = {
  easy: { base: 3_000, perSymbol: 450, spread: 2_000 },
  medium: { base: 1_600, perSymbol: 280, spread: 1_200 },
  hard: { base: 800, perSymbol: 160, spread: 700 },
};

/** Wie oft der Bot danebentippt. */
const SLIP: Record<BotLevel, number> = { easy: 0.15, medium: 0.04, hard: 0 };

function claim(view: SymbolMatchView, target: SeatId, symbol: number): SymbolMatchMove {
  return { type: 'claim', symbol, center: view.center!, target, top: view.players[target]!.top! };
}

export const symbolMatchBot: BotDefinition<SymbolMatchState, SymbolMatchMove, SymbolMatchView> = {
  id: 'adlerauge',
  name: 'Adlerauge',
  levels: ['easy', 'medium', 'hard'],
  delayMs({ view, level, rng }) {
    const t = THINK[level];
    return t.base + t.perSymbol * (view.options.order + 1) + rng.int(t.spread);
  },
  chooseMove({ view, seat, level, rng }) {
    const targets = targetsFor({ options: view.options, stacks: view.players.map(() => []) }, seat).filter((t) => view.players[t]!.top !== null);
    const target = rng.pick(targets);
    if (rng.chance(SLIP[level])) {
      // Danebentippen: irgendein anderes Symbol.
      const right = shared(view.options.order, view.center!, view.players[target]!.top!);
      const wrong = (right + 1 + rng.int(deckSize(view.options.order) - 1)) % deckSize(view.options.order);
      return claim(view, target, wrong);
    }
    return claim(view, target, shared(view.options.order, view.center!, view.players[target]!.top!));
  },
};

