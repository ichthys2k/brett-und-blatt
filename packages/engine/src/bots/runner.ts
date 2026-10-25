import { Rng } from '../random';
import type { BotRequest, BotRunner } from '../session';
import type { AnyGameModule } from '../types';

/** Rechnet einen Bot-Zug aus – dieselbe Funktion läuft im Web Worker, in Tests und später auf dem Server. */
export function computeBotMove(module: AnyGameModule, request: BotRequest, now: () => number = () => Date.now()): unknown {
  const bot = module.bots.find((b) => b.id === request.botId) ?? module.bots[0];
  if (!bot) throw new Error(`${module.info.name} hat keinen Bot.`);
  return bot.chooseMove({
    module,
    view: request.view,
    seat: request.seat,
    level: request.level,
    rng: Rng.fromSeed(request.seed, 'bot'),
    timeBudgetMs: request.timeBudgetMs,
    now,
  });
}

/** Bot-Läufer ohne Worker: rechnet sofort im selben Thread (für Tests und einfache Fälle). */
export function inlineBotRunner(modules: AnyGameModule[], options: { now?: () => number; timeBudgetMs?: number } = {}): BotRunner {
  const byId = new Map(modules.map((m) => [m.info.id, m]));
  return {
    requestMove(request) {
      const module = byId.get(request.gameId);
      if (!module) return Promise.reject(new Error(`Unbekanntes Spiel: ${request.gameId}`));
      try {
        const budget = options.timeBudgetMs ?? request.timeBudgetMs;
        return Promise.resolve(computeBotMove(module, { ...request, timeBudgetMs: budget }, options.now));
      } catch (error) {
        return Promise.reject(error);
      }
    },
  };
}
