/// <reference types="vite/client" />
/*
 * Prüfstand für alle Spiele – gründlicher als die Vertragsprüfungen, deshalb nur auf Abruf:
 *
 *   PRUEFSTAND=1 corepack pnpm exec vitest run tests/pruefstand.test.ts
 *   PRUEFSTAND=1 PRUEFSTAND_SPIELE=skat,uno corepack pnpm exec vitest run tests/pruefstand.test.ts
 *
 * Je Spiel: Zufallspartien über alle Optionen und bis zu vier Platzzahlen mit Proben unerlaubter
 * Züge, Geheimnis-Prüfung, jeder Bot auf jeder Stufe mit Zeitmessung und der Standard-Bot „schwer“
 * gegen Zufallsspieler. Am Ende steht je Spiel eine Zeile mit den Kennzahlen; Fehler lassen den Test
 * scheitern, Hinweise (langsamer oder schwacher Bot) werden nur ausgegeben.
 */
import { describe, expect, it } from 'vitest';
import { computeBotMove, isLegalMove, resolveOptions, Rng, settleSystemMoves } from '../packages/engine/src/index';
import { checkSecrets } from '../packages/engine/src/testing/index';
import type { Actor, AnyGameModule, BotLevel, GameInfo, Options, SeatId } from '../packages/engine/src/types';

const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;
const enabled = env.PRUEFSTAND === '1';
const only = env.PRUEFSTAND_SPIELE?.split(',').map((s) => s.trim()).filter(Boolean);

const metas = import.meta.glob<GameInfo>('../packages/games/*/src/meta.ts', { eager: true, import: 'meta' });
const modules = import.meta.glob<AnyGameModule>('../packages/games/*/src/index.ts', { import: 'gameModule' });
const ids = Object.values(metas)
  .map((info) => info.id)
  .filter((id) => !only || only.includes(id))
  .sort();

const BOT_BUDGET_MS = 150;

function seatCountsOf(info: GameInfo): number[] {
  const min = info.players.min;
  const max = Math.min(info.players.max, 10);
  return [...new Set([min, Math.min(min + 1, max), Math.round((min + max) / 2), max])];
}

function optionSetsOf(module: AnyGameModule): Options[] {
  const defaults = resolveOptions(module);
  const sets: Options[] = [defaults];
  for (const spec of module.options) for (const c of spec.choices) if (c.value !== spec.default) sets.push({ ...defaults, [spec.id]: c.value });
  return sets;
}

/** Zufallspartie mit Proben: Unsinnszüge und Züge fremder Plätze müssen abgelehnt werden. */
function probedRandomGame(module: AnyGameModule, seats: number, options: Options, seed: string, errors: string[]): number {
  const rng = Rng.fromSeed(seed, 'pruefstand');
  let state = module.setup(seats, options, seed);
  for (let step = 0; step < 6_000; step++) {
    if (module.result(state)) return step;
    const actors = module.currentPlayers(state);
    if (actors.length === 0) {
      errors.push(`kein Ergebnis, aber niemand am Zug (${seats} Plätze, ${JSON.stringify(options)})`);
      return step;
    }
    const actor = rng.pick(actors);
    const moves = module.legalMoves(state, actor);
    if (moves.length === 0) {
      errors.push(`Platz ${String(actor)} am Zug ohne erlaubten Zug (${seats} Plätze, ${JSON.stringify(options)})`);
      return step;
    }
    if (step % 5 === 0) {
      if (isLegalMove(module, state, actor, { type: '__unsinn__' })) errors.push('ein Unsinnszug gilt als erlaubt');
      const idle = [...Array(seats).keys()].find((s) => !actors.includes(s));
      if (idle !== undefined && isLegalMove(module, state, idle, moves[0])) {
        try {
          module.applyMove(state, idle, moves[0]);
        } catch (e) {
          errors.push(`Zug eines Platzes, der nicht dran ist, gilt als erlaubt und wirft dann: ${(e as Error).message}`);
        }
      }
    }
    state = module.applyMove(state, actor, actor === 'system' ? moves[0] : rng.pick(moves)).state;
  }
  return 6_000;
}

/** Bot-Partie; liefert längste Bedenkzeit, Zugzahl und Ergebnis. */
function botGame(module: AnyGameModule, seats: number, players: { botId: string; level: BotLevel }[], seed: string, moveLimit: number) {
  let state = settleSystemMoves(module, module.setup(seats, resolveOptions(module), seed));
  let maxMs = 0;
  for (let step = 0; step < moveLimit; step++) {
    const result = module.result(state);
    if (result) return { result, maxMs, steps: step };
    const actors = module.currentPlayers(state).filter((a: Actor): a is SeatId => a !== 'system');
    const seat = actors[step % actors.length]!;
    const player = players[seat % players.length]!;
    const t0 = performance.now();
    const move = computeBotMove(module, { gameId: module.info.id, botId: player.botId, level: player.level, seat, view: module.playerView(state, seat), seed: `${seed}/${step}`, timeBudgetMs: BOT_BUDGET_MS });
    maxMs = Math.max(maxMs, performance.now() - t0);
    if (!isLegalMove(module, state, seat, move)) throw new Error(`Bot ${player.botId}/${player.level} wählt einen unerlaubten Zug: ${JSON.stringify(move)}`);
    state = settleSystemMoves(module, module.applyMove(state, seat, move).state);
  }
  return { result: null, maxMs, steps: moveLimit };
}

describe.runIf(enabled)('Prüfstand', () => {
  for (const id of ids) {
    it(id, { timeout: 600_000 }, async () => {
      const loader = Object.entries(modules).find(([path]) => path.split('/')[3] === id)?.[1];
      const module = await loader!();
      const errors: string[] = [];
      const notes: string[] = [];
      const lengths: number[] = [];

      for (const seats of seatCountsOf(module.info)) {
        for (const options of optionSetsOf(module)) {
          for (let g = 0; g < 3; g++) {
            const steps = probedRandomGame(module, seats, options, `pruefstand/${seats}/${JSON.stringify(options)}/${g}`, errors);
            if (steps >= 6_000) notes.push(`Zufallspartie ohne Ende nach 6000 Zügen (${seats} Plätze, ${JSON.stringify(options)})`);
            else lengths.push(steps);
          }
          try {
            checkSecrets(module, seats, options, `pruefstand-geheim/${seats}/${JSON.stringify(options)}`, 2_000, module.sampleHiddenApproximate !== undefined);
          } catch (e) {
            errors.push((e as Error).message);
          }
        }
      }

      const slow: string[] = [];
      for (const bot of module.bots.filter((b) => b.id !== 'random')) {
        for (const level of bot.levels) {
          try {
            const r = botGame(module, module.info.players.min, [{ botId: bot.id, level }], `pruefstand-bot/${bot.id}/${level}`, bot.id === 'general' ? 300 : 3_000);
            if (r.maxMs > 1_000) slow.push(`${bot.id}/${level} ${Math.round(r.maxMs)} ms`);
            if (!r.result && bot.id !== 'general') notes.push(`${bot.id}/${level}: Bot-Partie endet nicht in 3000 Zügen`);
          } catch (e) {
            errors.push(`${bot.id}/${level}: ${(e as Error).message}`);
          }
        }
      }
      if (slow.length) notes.push(`langsamer Bot (Budget ${BOT_BUDGET_MS} ms): ${slow.join(', ')}`);

      let strength = '–';
      const main = module.bots[0]!;
      if (module.info.players.max >= 2 && module.bots.some((b) => b.id === 'random') && main.id !== 'random') {
        const seats = Math.max(2, module.info.players.min);
        let wins = 0;
        let played = 0;
        for (let g = 0; g < 8; g++) {
          const strong = g % seats;
          const players = Array.from({ length: seats }, (_, s) => (s === strong ? { botId: main.id, level: 'hard' as const } : { botId: 'random', level: 'easy' as const }));
          try {
            const r = botGame(module, seats, players, `pruefstand-staerke/${g}`, 3_000);
            if (!r.result) continue;
            played++;
            if (r.result.kind === 'win' && r.result.winners.includes(strong)) wins++;
          } catch (e) {
            errors.push(`Stärketest: ${(e as Error).message}`);
            break;
          }
        }
        strength = `${wins}/${played}`;
        if (played >= 4 && wins / played < (seats === 2 ? 0.6 : 1.5 / seats)) notes.push(`Standard-Bot „schwer“ gewinnt nur ${strength} gegen Zufallsspieler`);
      }

      lengths.sort((a, b) => a - b);
      const median = lengths[lengths.length >> 1] ?? 0;
      console.log(`${id.padEnd(22)} Partien ${String(lengths.length).padStart(4)} · Median ${String(median).padStart(5)} Züge · schwer gegen Zufall ${strength}${notes.length ? `\n  Hinweise: ${[...new Set(notes)].join(' | ')}` : ''}`);
      expect([...new Set(errors)]).toEqual([]);
    });
  }
});
