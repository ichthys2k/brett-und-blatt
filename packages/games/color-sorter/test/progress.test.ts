import { computeBotMove, resolveOptions, Rng, type Options } from '@brett-und-blatt/engine';
import { describe, expect, it } from 'vitest';
import {
  ATELIER_BOX_PRICE,
  bossFor,
  boxOdds,
  decodeUnlocks,
  encodeUnlocks,
  gameModule,
  HIDDEN_SCORE,
  MODS,
  openAtelierBox,
  runDrops,
  scoreHand,
  UNLOCKABLES,
  type Card,
  type SorterMove,
  type SorterState,
} from '../src';

function start(seats = 1, options: Options = {}, seed = 'fortschritt'): SorterState {
  return gameModule.setup(seats, resolveOptions(gameModule, options), seed);
}

function play(state: SorterState, seat: number, move: SorterMove): SorterState {
  return gameModule.applyMove(state, seat, move).state;
}

const c = (rank: number, color: Card['color'], id: number): Card => ({
  id,
  rank,
  color,
});

/** Bringt Platz 0 an den Boss eines Levels und lässt ihn die Runde mit der ersten Hand gewinnen oder verlieren. */
function bossRound(state: SorterState, level: number, win: boolean): ReturnType<typeof gameModule.applyMove> {
  const run = state.runs[0]!;
  Object.assign(run, { level, round: 2, phase: 'choose' });
  let next = play(state, 0, { type: 'start' });
  const current = next.runs[0]!.current!;
  current.target = win ? 1 : 1e12;
  current.handsLeft = 1;
  return gameModule.applyMove(next, 0, { type: 'play', cards: [0] });
}

describe('Endlos-Modus', () => {
  it('ohne Endlos ist nach Level 8 Schluss', () => {
    const { state } = bossRound(start(), 8, true);
    expect(state.runs[0]!.phase).toBe('won');
    expect(gameModule.result(state)).toMatchObject({ kind: 'win' });
  });

  it('mit Endlos geht es nach Level 8 weiter, ein Verlust danach zählt als Sieg', () => {
    const won = bossRound(start(1, { endless: 'on' }), 8, true);
    expect(won.events.some((e) => e.type === 'cleared')).toBe(true);
    expect(won.state.runs[0]!.phase).toBe('shop');
    expect(gameModule.result(won.state)).toBeNull();
    const lost = bossRound(play(won.state, 0, { type: 'next' }), 9, false).state;
    expect(gameModule.result(lost)).toEqual({
      kind: 'win',
      winners: [0],
      reason: 'Endlos bis Hoftag 9',
    });
  });

  it('wer vor Level 8 verliert, hat verloren – auch im Endlos-Modus', () => {
    const { state } = bossRound(start(1, { endless: 'on' }), 3, false);
    expect(gameModule.result(state)).toMatchObject({ kind: 'loss' });
  });
});

describe('Boss neu wählen', () => {
  it('geht nur mit der Bittschrift, einmal je Hoftag, und kostet 5 Brezeln', () => {
    let state = start();
    const run = state.runs[0]!;
    Object.assign(run, { round: 2, phase: 'choose', tokens: 20 });
    expect(gameModule.legalMoves(state, 0).some((m) => m.type === 'rerollBoss')).toBe(false);
    run.tools = ['scope'];
    const before = bossFor(state, run);
    state = play(state, 0, { type: 'rerollBoss' });
    expect(bossFor(state, state.runs[0]!)).not.toBe(before);
    expect(state.runs[0]!.tokens).toBe(15);
    expect(gameModule.legalMoves(state, 0).some((m) => m.type === 'rerollBoss')).toBe(false);
    state = play(state, 0, { type: 'start' });
    expect(state.runs[0]!.current!.boss).toBe(state.runs[0]!.bossSwap!.key);
  });

  it('Maskenball: Die Herrschaft kommt ohne Marotte', () => {
    let state = start();
    Object.assign(state.runs[0]!, { round: 2, phase: 'choose', stickers: ['masquerade'] });
    const boss = bossFor(state, state.runs[0]!);
    state = play(state, 0, { type: 'start' });
    const round = state.runs[0]!.current!;
    expect(round.boss).toBeNull();
    expect(round.calm).toBe(boss);
    expect(state.runs[0]!.stickers).toEqual([]);
  });
});

describe('Mehrspieler-Mods', () => {
  it('liegen nur zu mehreren im Laden', () => {
    const multi = Object.values(MODS)
      .filter((m) => m.multi)
      .map((m) => m.key);
    const seen = (seats: number) => {
      const keys = new Set<string>();
      for (let g = 0; g < 30; g++) {
        let state = start(seats, { mode: 'survival', pool: 'all' }, `mm/${g}`);
        Object.assign(state.runs[0]!, {
          phase: 'shop',
          tokens: 10_000,
          shop: {
            offers: Array(5).fill(null),
            packs: [],
            tool: null,
            rerollCost: 0,
          },
        });
        for (let i = 0; i < 10; i++) {
          state = play(state, 0, { type: 'reroll' });
          for (const o of state.runs[0]!.shop!.offers) if (o?.type === 'mod') keys.add(o.key);
        }
      }
      return keys;
    };
    expect([...seen(1)].some((k) => multi.includes(k))).toBe(false);
    expect([...seen(2)].some((k) => multi.includes(k))).toBe(true);
  });

  it('Teamgeist und Aufholjagd rechnen mit der Lage am Tisch', () => {
    const state = start(3, { mode: 'survival' });
    const run = {
      ...state.runs[0]!,
      mods: [
        { uid: 1, key: 'team' },
        { uid: 2, key: 'chase' },
      ],
    };
    const played = [c(5, 'h', 1)];
    const plain = scoreHand(run, played, [], new Rng([1, 2, 3, 4]));
    const table = scoreHand(run, played, [], new Rng([1, 2, 3, 4]), {
      others: 2,
      behind: 1,
    });
    expect(table.chips).toBe(plain.chips + 30);
    expect(table.mult).toBe(plain.mult + 6 + 3);
  });

  it('Zweite Chance rettet ein Leben und löst sich auf', () => {
    let state = start(2, { mode: 'duel', lives: '2' });
    state.runs[0]!.mods = [{ uid: 1, key: 'secondChance' }];
    state = play(state, 0, { type: 'start' });
    Object.assign(state.runs[0]!.current!, { target: 1e12, handsLeft: 1 });
    const { state: after, events } = gameModule.applyMove(state, 0, {
      type: 'play',
      cards: [0],
    });
    expect(events.some((e) => e.type === 'saved')).toBe(true);
    expect(after.runs[0]!.lives).toBe(2);
    expect(after.runs[0]!.mods).toEqual([]);
    expect(after.runs[0]!.phase).toBe('shop');
  });

  it('Duell-Punkte der anderen sind geheim – außer mit dem Spion', () => {
    const state = start(2, { mode: 'duel' });
    state.duel = { level: 2, scores: [120, 340] };
    state.runs[1]!.current = {
      target: 0,
      score: 340,
      handsLeft: 0,
      discardsLeft: 0,
      boss: null,
      duel: true,
      playedTypes: [],
      firstDone: true,
      silenced: false,
      faceDown: [],
    };
    const view = gameModule.playerView(state, 0);
    expect(view.duel!.scores).toEqual([120, HIDDEN_SCORE]);
    expect(view.runs[1]!.current!.score).toBe(HIDDEN_SCORE);
    expect(gameModule.eventView!({ type: 'scored', seat: 1, score: 340, total: 340, duel: true }, 0)).not.toHaveProperty('score');
    state.runs[0]!.mods = [{ uid: 1, key: 'spy' }];
    const spy = gameModule.playerView(state, 0);
    expect(spy.duel!.scores).toEqual([120, 340]);
    expect(spy.runs[1]!.current!.score).toBe(340);
  });
});

describe('Freischaltungen', () => {
  it('Code hin und zurück, Schmuck zählt nicht mit', () => {
    const ids = ['mod:twins', 'deck:magic', 'tool:diploma', 'back:wave'];
    const code = encodeUnlocks(ids);
    expect(code).toMatch(/^[0-9a-f]*$/);
    expect([...decodeUnlocks(code)].sort()).toEqual(['deck:magic', 'mod:twins', 'tool:diploma']);
    expect(encodeUnlocks([])).toBe('');
  });

  it('Gesperrtes kommt nicht vor, Freigeschaltetes schon', () => {
    const locked = start(1, { pool: 'mine' });
    expect(locked.locked).toContain('mod:twins');
    expect(start(1, { pool: 'mine', unlocks: encodeUnlocks(['mod:twins']) }).locked).not.toContain('mod:twins');
    expect(start(1, { pool: 'all' }).locked).toEqual([]);
    // Ein gesperrter Kartensatz wird zum Standard-Satz.
    expect(start(1, { deck: 'magic' }).deckKind).toBe('standard');
    expect(start(1, { deck: 'magic', unlocks: encodeUnlocks(['deck:magic']) }).deckKind).toBe('magic');
    // Viele Läden: kein gesperrter Mod und kein gesperrtes Werkzeug.
    for (let g = 0; g < 20; g++) {
      let state = start(1, {}, `pool/${g}`);
      for (let step = 0; step < 600 && !gameModule.result(state); step++) {
        const run = state.runs[0]!;
        for (const o of run.shop?.offers ?? []) if (o?.type === 'mod') expect(state.locked).not.toContain(`mod:${o.key}`);
        if (run.toolOffer) expect(state.locked).not.toContain(`tool:${run.toolOffer}`);
        const move = computeBotMove(gameModule, {
          gameId: 'color-sorter',
          botId: 'color-sorter',
          level: 'hard',
          seat: 0,
          view: gameModule.playerView(state, 0),
          seed: `${g}/${step}`,
          timeBudgetMs: 10,
        }) as SorterMove;
        state = play(state, 0, move);
      }
    }
  });

  it('Atelier-Lieferung: nie doppelt, Quoten ergeben 100 %', () => {
    const unlocked = new Set<string>();
    let random = 0.37;
    for (let i = 0; i < UNLOCKABLES.length; i++) {
      const odds = boxOdds(unlocked);
      expect(Math.round(odds.reduce((s, o) => s + o.percent, 0))).toBe(100);
      const item = openAtelierBox(unlocked, () => (random = (random * 7.31) % 1));
      expect(item).not.toBeNull();
      expect(unlocked.has(item!.id)).toBe(false);
      unlocked.add(item!.id);
    }
    expect(openAtelierBox(unlocked, Math.random)).toBeNull();
    expect(ATELIER_BOX_PRICE).toBeGreaterThan(0);
  });
});

describe('Farbtropfen', () => {
  it('gibt es je Level, für den Sieg und einmalig für Herausforderungen', () => {
    const { state } = bossRound(start(), 8, true);
    state.runs[0]!.bossesBeaten = 8;
    const lines = runDrops(state, 0, new Set());
    expect(lines[0]).toEqual({ label: '8 Hoftage geschafft', amount: 16 });
    expect(lines.some((l) => l.once === 'deck:standard')).toBe(true);
    expect(lines.some((l) => l.once === 'noDiscard')).toBe(true);
    const again = runDrops(state, 0, new Set(['deck:standard', 'noDiscard', 'stake:1', 'fewMods']));
    expect(again.some((l) => l.once)).toBe(false);
  });

  it('erst am Ende der Partie', () => {
    expect(runDrops(start(), 0, new Set())).toEqual([]);
  });
});
