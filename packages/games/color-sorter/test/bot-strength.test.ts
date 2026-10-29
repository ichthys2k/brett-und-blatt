import { computeBotMove, resolveOptions, type BotLevel } from '@brett-und-blatt/engine';
import { it } from 'vitest';
import { gameModule } from '../src';
import type { SorterMove, SorterState } from '../src/types';

/**
 * Misst, wie weit der Bot allein kommt. Läuft nur auf Wunsch:
 *   BOT_STRENGTH=1 corepack pnpm exec vitest run packages/games/color-sorter/test/bot-strength --disable-console-intercept
 * Weitere Stellschrauben: BOT_RUNS (Läufe je Stufe, Standard 100), BOT_LEVELS (z. B. „medium,hard“),
 * BOT_BUDGET (ms je Zug, Standard 10), BOT_FROM (erster Seed, Standard 0), BOT_DEBUG (Endstand je Lauf),
 * BOT_STEP (Zähl-Uhr wie auf dem Spieleserver: jeder Blick auf die Uhr zählt so viele ms).
 */
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};

it.runIf(env.BOT_STRENGTH)(
  'Farbensortierer: erreichtes Level je Bot-Stufe',
  () => {
    const runs = Number(env.BOT_RUNS ?? 100);
    const from = Number(env.BOT_FROM ?? 0);
    const budget = Number(env.BOT_BUDGET ?? 10);
    const levels = (env.BOT_LEVELS ?? 'easy,medium,hard').split(',') as BotLevel[];
    for (const level of levels) {
      const reached: number[] = [];
      let won = 0;
      const lostAt = new Map<string, number>();
      const started = performance.now();
      let moves = 0;
      let slowest = 0;
      for (let i = from; i < from + runs; i++) {
        let last = '';
        let state = gameModule.setup(1, resolveOptions(gameModule, {}), `m${i}`);
        for (let step = 0; step < 5000 && !gameModule.result(state); step++) {
          const seat = gameModule.currentPlayers(state)[0] as number;
          const t0 = performance.now();
          let ticks = 0;
          const clock = env.BOT_STEP ? () => (ticks += Number(env.BOT_STEP)) : undefined;
          const move = computeBotMove(gameModule, {
            gameId: gameModule.info.id,
            botId: gameModule.bots[0]!.id,
            level,
            seat,
            view: gameModule.playerView(state, seat),
            seed: `b${i}-${step}`,
            timeBudgetMs: budget,
          }, clock) as SorterMove;
          slowest = Math.max(slowest, performance.now() - t0);
          const before = state.runs[0]!.current;
          state = gameModule.applyMove(state, seat, move).state as SorterState;
          if (before && move.type === 'play') last = `${before.score}/${before.target} h${before.handsLeft} ${before.boss ?? ''}`;
          moves++;
        }
        const run = state.runs[0]!;
        if (env.BOT_DEBUG)
          console.log(
            `  m${i}: L${run.level}.${run.round} ${run.phase} T${run.tokens} mods=[${run.mods.map((m) => m.key).join(',')}] cons=[${run.consumables.map((c) => c.key).join(',')}] lv=${Object.entries(run.handLevels).filter(([, v]) => v > 1).map(([k, v]) => k + v).join(',')} plays=${Object.entries(run.handPlays).filter(([, v]) => v > 0).map(([k, v]) => k + v).join(',')} deck=${run.deck.length} zuletzt=${last}`,
          );
        if (run.phase === 'won') won++;
        else {
          const key = `${run.level}.${run.round}${run.round === 2 ? ` ${run.current?.boss ?? ''}` : ''}`;
          lostAt.set(key, (lostAt.get(key) ?? 0) + 1);
        }
        reached.push(run.level);
      }
      const mean = reached.reduce((a, b) => a + b, 0) / reached.length;
      const ms = (performance.now() - started) / moves;
      const where = [...lostAt].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, n]) => `${k}:${n}`).join(' ');
      console.log(`${level.padEnd(6)} Level Ø ${mean.toFixed(2)} | gewonnen ${won}/${runs} | ${ms.toFixed(1)} ms/Zug (längster ${slowest.toFixed(0)} ms) | verloren bei ${where}`);
    }
  },
  3_600_000,
);
