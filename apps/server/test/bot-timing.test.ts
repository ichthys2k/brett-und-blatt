import { resolveOptions, settleSystemMoves, type AnyGameModule } from '@brett-und-blatt/engine';
import { serverBotRunner } from '@brett-und-blatt/online';
import { it } from 'vitest';
import { BOT_BUDGET_MS, BOT_STEP_MS } from '../src/bots';
import { onlineGames } from '../src/games';

/**
 * Misst, wie lange die Bots mit der Zähl-Uhr des Servers rechnen. Läuft nur auf Wunsch:
 *   BOT_TIMING=1 corepack pnpm exec vitest run apps/server/test/bot-timing --disable-console-intercept
 */
/** Umgebungsvariable lesen, ohne die Node-Typen einzubinden. */
const wanted = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.BOT_TIMING;

it.runIf(wanted)('Rechenzeit der Bots je Spiel und Stufe', async () => {
  const runner = serverBotRunner(onlineGames, { stepMs: BOT_STEP_MS });
  for (const module of onlineGames as AnyGameModule[]) {
    const state = settleSystemMoves(module, module.setup(Math.max(2, module.info.players.min), resolveOptions(module), 'messung'));
    const seat = module.currentPlayers(state).find((a: unknown) => a !== 'system') as number;
    const row: string[] = [];
    for (const level of ['easy', 'medium', 'hard'] as const) {
      const started = performance.now();
      for (let i = 0; i < 3; i++) {
        await runner.requestMove({ gameId: module.info.id, botId: module.bots[0]!.id, level, seat, view: module.playerView(state, seat), seed: `m${i}`, timeBudgetMs: BOT_BUDGET_MS[level] });
      }
      row.push(`${level} ${((performance.now() - started) / 3).toFixed(0)} ms`);
    }
    console.log(`${module.info.id.padEnd(22)} ${row.join(' | ')}`);
  }
}, 600_000);
