import { BOT_LEVELS, type BotContext, type BotDefinition, type BotLevel } from '../types';
import { mctsSearch } from './mcts';

/** Zufallsbot: wählt irgendeinen erlaubten Zug. Gut zum Testen und für die Kleinsten. */
export const randomBot: BotDefinition<unknown, unknown, unknown> = {
  id: 'random',
  name: 'Zufall',
  levels: BOT_LEVELS,
  chooseMove(ctx) {
    return ctx.rng.pick(ctx.module.legalMoves(stateFor(ctx), ctx.seat));
  },
};

const MCTS_ITERATIONS: Record<BotLevel, number> = { easy: 60, medium: 1_500, hard: 200_000 };

/**
 * Der allgemeine Bot: Monte-Carlo-Baumsuche über die Spielmodul-Schnittstelle.
 * Er spielt jedes Spiel sofort ordentlich, ganz ohne spielspezifisches Wissen.
 */
export const generalBot: BotDefinition<unknown, unknown, unknown> = {
  id: 'general',
  name: 'Allgemeiner Bot',
  levels: BOT_LEVELS,
  chooseMove(ctx) {
    return mctsSearch(ctx.module, stateFor(ctx), ctx.seat, ctx.rng, {
      iterations: MCTS_ITERATIONS[ctx.level],
      timeBudgetMs: ctx.timeBudgetMs,
      now: ctx.now,
      winCheck: ctx.level !== 'easy',
    });
  },
};

/** Typisierte Fassung der allgemeinen Bots für die `bots`-Liste eines Spiels. */
export function generalBots<S, M, V>(): BotDefinition<S, M, V>[] {
  return [generalBot, randomBot] as unknown as BotDefinition<S, M, V>[];
}

/**
 * Der Spielstand, mit dem ein Bot rechnen darf: bei offenen Spielen die Sicht selbst,
 * bei verdeckten eine passende Zufallsbelegung (Determinisierung).
 */
export function stateFor<S, M, V>(ctx: BotContext<S, M, V>): S {
  const { module } = ctx;
  if (module.sampleHidden) return module.sampleHidden(ctx.view, ctx.seat, ctx.rng);
  if (module.info.hiddenInformation) throw new Error(`${module.info.name} braucht sampleHidden für Bots.`);
  return ctx.view as unknown as S;
}
