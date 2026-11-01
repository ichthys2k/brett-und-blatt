import { Rng, type BotLevel, type SeatId } from '@brett-und-blatt/engine';
import { describe, it } from 'vitest';
import { gameModule } from '../src';

// Abrufbare Messung des Startvorteils, läuft nur auf Wunsch:
// DRACHEN_BALANCE=1 corepack pnpm exec vitest run packages/games/drachenspiel/test/balance --disable-console-intercept
const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;
const GAMES = Number(env.DRACHEN_BALANCE_SPIELE ?? 300);
const BUDGET: Record<BotLevel, number> = { easy: 100, medium: 300, hard: 800 };

function play(seed: string, levels: [BotLevel, BotLevel], deckSelection: string) {
  let state = gameModule.setup(2, { deckSelection }, seed);
  for (let step = 0; step < 2000 && !gameModule.result(state); step++) {
    const seat = gameModule.currentPlayers(state)[0] as SeatId;
    const move = gameModule.bots[0]!.chooseMove({
      module: gameModule,
      view: gameModule.playerView(state, seat),
      seat,
      level: levels[seat],
      rng: Rng.fromSeed(`${seed}/${step}`),
      timeBudgetMs: BUDGET[levels[seat]],
      now: () => Date.now(),
    });
    state = gameModule.applyMove(state, seat, move).state;
  }
  const result = gameModule.result(state);
  const winner = result?.kind === 'win' ? result.winners[0]! : null;
  return { winner, starter: state.startingSeat, turns: state.turn };
}

describe.runIf(env.DRACHEN_BALANCE)('Drachenspiel: Startvorteil', () => {
  it('misst Startspieler- und Stufenvergleich', () => {
    const pairs: [BotLevel, BotLevel][] = [['hard', 'hard'], ['medium', 'medium'], ['easy', 'easy'], ['hard', 'medium'], ['medium', 'easy']];
    // Auf Wunsch nur ein Teil, die ganze Messung dauert lange: DRACHEN_BALANCE_DECKS=inGame, DRACHEN_BALANCE_STUFEN=hard/hard
    const decks = env.DRACHEN_BALANCE_DECKS?.split(',') ?? ['inGame', 'forest', 'sea', 'farm', 'wild', 'bugs'];
    const levelFilter = env.DRACHEN_BALANCE_STUFEN?.split(',');
    for (const deck of decks) {
      for (const levels of pairs) {
        if (deck !== 'inGame' && levels[0] !== levels[1]) continue;
        if (levelFilter && !levelFilter.includes(levels.join('/'))) continue;
        let starterWins = 0, firstLevelWins = 0, draws = 0, turns = 0;
        for (let i = 0; i < GAMES; i++) {
          const r = play(`mess-${deck}-${levels.join('-')}-${i}`, levels, deck);
          if (r.winner === null) draws++;
          else {
            if (r.winner === r.starter) starterWins++;
            if (r.winner === 0) firstLevelWins++;
          }
          turns += r.turns;
        }
        console.log(`${deck.padEnd(7)} ${levels.join('/').padEnd(14)} Startspieler ${((100 * starterWins) / GAMES).toFixed(0)} %, Platz 1 ${((100 * firstLevelWins) / GAMES).toFixed(0)} %, Remis ${draws}, Ø ${(turns / GAMES).toFixed(1)} Züge`);
      }
    }
  }, 1_800_000);
});
