import { describe, expect, it, test } from 'vitest';
import { Rng, computeBotMove } from '@brett-und-blatt/engine';
import { gameContractChecks } from '@brett-und-blatt/engine/testing';
import { gameModule } from '../src';
import { applyMove, buildDeck, currentPlayers, isLegal, legalMoves, playerView, sampleHidden, setup, type Cell, type LowFlightMove, type LowFlightState } from '../src/rules';

describe('low-flight: allgemeine Prüfungen', () => {
  for (const check of gameContractChecks(gameModule)) test(check.name, check.run, 120_000);
});

const open = (value: number): Cell => ({ value, open: true });
const hidden = (value: number): Cell => ({ value, open: false });

/** Ein Tisch in der Zugphase mit festen Rastern (3 × 4, Index = Zeile · 4 + Spalte). */
function table(grids: (Cell | null)[][], patch: Partial<LowFlightState> = {}, options: Record<string, string> = {}): LowFlightState {
  const state = setup(grids.length, options, 'test');
  return { ...state, phase: 'turn', turn: 0, ...patch, players: grids.map((grid) => ({ grid, total: 0, ready: false })) };
}

function run(state: LowFlightState, ...moves: [number, LowFlightMove][]): LowFlightState {
  for (const [seat, move] of moves) state = applyMove(state, seat, move).state;
  return state;
}

const twelve = (fill: (i: number) => Cell | null) => Array.from({ length: 12 }, (_, i) => fill(i));

describe('low-flight: Regeln', () => {
  it('hat 150 Karten von −2 bis 12, Junior 90 Obstkarten 1–5', () => {
    const deck = buildDeck('classic');
    expect(deck).toHaveLength(150);
    expect(deck.filter((v) => v === -2)).toHaveLength(5);
    expect(deck.filter((v) => v === 0)).toHaveLength(15);
    expect(deck.filter((v) => v === 12)).toHaveLength(10);
    expect(new Set(buildDeck('junior'))).toEqual(new Set([1, 2, 3, 4, 5]));
  });

  it('teilt 12 verdeckte Karten aus (Junior 9) und eine Ablagekarte', () => {
    const s = setup(4, {}, 'a');
    expect(s.players.every((p) => p.grid.length === 12 && p.grid.every((c) => c && !c.open))).toBe(true);
    expect(s.discard).toHaveLength(1);
    expect(s.deck).toHaveLength(150 - 48 - 1);
    expect(setup(3, { variant: 'junior' }, 'a').players[0]!.grid).toHaveLength(9);
  });

  it('lässt reihum zwei Karten aufdecken; die höchste Summe beginnt', () => {
    let s = setup(3, {}, 'b');
    for (let i = 0; i < 6; i++) {
      const seat = currentPlayers(s)[0] as number;
      s = applyMove(s, seat, legalMoves(s, seat)[0]!).state;
    }
    expect(s.phase).toBe('turn');
    const sums = s.players.map((p) => p.grid.reduce((a, c) => a + (c?.open ? c.value : 0), 0));
    expect(s.turn).toBe(sums.indexOf(Math.max(...sums)));
  });

  it('tauscht die Ablagekarte gegen eine verdeckte Karte', () => {
    const s0 = table([twelve(() => hidden(9)), twelve(() => hidden(5))], { discard: [1] });
    const s = run(s0, [0, { type: 'takeDiscard' }], [0, { type: 'swap', slot: 4 }]);
    expect(s.players[0]!.grid[4]).toEqual(open(1));
    expect(s.discard).toEqual([9]);
    expect(s.turn).toBe(1);
    // Mit einer Ablagekarte darf man nicht abwerfen und aufdecken.
    const taken = run(s0, [0, { type: 'takeDiscard' }]);
    expect(isLegal(taken, 0, { type: 'flip', slot: 0 })).toBe(false);
  });

  it('zieht vom Stapel, wirft ab und deckt auf', () => {
    const s0 = table([twelve(() => hidden(3)), twelve(() => hidden(5))], { deck: [11], discard: [0] });
    const s = run(s0, [0, { type: 'draw' }], [0, { type: 'flip', slot: 7 }]);
    expect(s.players[0]!.grid[7]).toEqual(open(3));
    expect(s.discard).toEqual([0, 11]);
  });

  it('räumt eine Spalte mit drei gleichen offenen Karten ab', () => {
    // Spalte 1: Felder 1, 5, 9
    const grid = twelve((i) => (i === 1 || i === 5 ? open(7) : hidden(2)));
    const s = run(table([grid, twelve(() => hidden(5))], { discard: [7] }), [0, { type: 'takeDiscard' }], [0, { type: 'swap', slot: 9 }]);
    expect([1, 5, 9].map((i) => s.players[0]!.grid[i])).toEqual([null, null, null]);
    expect(s.discard.slice(-3)).toEqual([7, 7, 7]);
  });

  it('räumt mit Option auch Zeilen ab', () => {
    const grid = twelve((i) => (i < 3 ? open(4) : hidden(1)));
    const s = run(table([grid, twelve(() => hidden(5))], { discard: [4] }, { rows: 'on' }), [0, { type: 'takeDiscard' }], [0, { type: 'swap', slot: 3 }]);
    expect(s.players[0]!.grid.slice(0, 4)).toEqual([null, null, null, null]);
  });

  it('beendet die Runde nach einer letzten Runde für alle anderen; Beender ohne Bestwert zahlt doppelt', () => {
    const a = twelve((i) => (i === 11 ? hidden(5) : open(Math.floor(i / 4) + 1)));
    const b = twelve(() => hidden(0));
    const c = twelve(() => hidden(0));
    let s = run(table([a, b, c], { deck: [1, 2, 3, 4] }), [0, { type: 'draw' }], [0, { type: 'flip', slot: 11 }]);
    expect(s.ender).toBe(0);
    expect(s.phase).toBe('turn');
    s = run(s, [1, { type: 'draw' }], [1, { type: 'flip', slot: 0 }], [2, { type: 'draw' }], [2, { type: 'flip', slot: 0 }]);
    expect(s.phase).toBe('roundEnd');
    // Beender: 4 × 1 + 4 × 2 + 3 × 3 + 5 = 26 → verdoppelt 52; die anderen haben 0.
    expect(s.lastRound).toMatchObject({ ender: 0, doubled: true, points: [52, 0, 0] });
    expect(s.players.map((p) => p.total)).toEqual([52, 0, 0]);
  });

  it('verdoppelt nicht, wenn der Beender allein die niedrigste Summe hat – oder ohne Option', () => {
    const a = twelve((i) => (i === 11 ? hidden(0) : open(0)));
    const b = twelve(() => hidden(5));
    const s = run(table([a, b], { deck: [9, 9] }), [0, { type: 'draw' }], [0, { type: 'flip', slot: 11 }], [1, { type: 'draw' }], [1, { type: 'flip', slot: 0 }]);
    expect(s.lastRound!.doubled).toBe(false);
    const c = twelve((i) => (i === 11 ? hidden(5) : open(1)));
    const d = twelve(() => hidden(0));
    const t = run(table([c, d], { deck: [9, 9] }, { doubling: 'off' }), [0, { type: 'draw' }], [0, { type: 'flip', slot: 11 }], [1, { type: 'draw' }], [1, { type: 'flip', slot: 0 }]);
    expect(t.lastRound!.doubled).toBe(false);
  });

  it('endet bei 100 Punkten, die niedrigste Gesamtsumme gewinnt', () => {
    const a = twelve((i) => (i === 11 ? hidden(5) : open(Math.floor(i / 4) + 1)));
    const b = twelve(() => hidden(0));
    let s = table([a, b], { deck: [9, 9] });
    s = { ...s, players: s.players.map((p, i) => ({ ...p, total: i === 0 ? 60 : 99 })) };
    s = run(s, [0, { type: 'draw' }], [0, { type: 'flip', slot: 11 }], [1, { type: 'draw' }], [1, { type: 'flip', slot: 0 }]);
    // Platz 0: 60 + 2 × 26 = 112, Platz 1: 99 + 0
    expect(s.phase).toBe('gameEnd');
    expect(gameModule.result(s)).toEqual({ kind: 'win', winners: [1] });
  });

  it('verdeckt Werte für alle, auch für den Besitzer', () => {
    const s = setup(2, {}, 'c');
    const view = playerView(s, 0);
    expect(view.players[0]!.grid.every((c) => c?.value === null)).toBe(true);
    expect('deck' in view).toBe(false);
    const world = sampleHidden(view, 0, new Rng([1, 2, 3, 4]));
    expect(world.deck.length + world.players.flatMap((p) => p.grid).length + world.discard.length).toBe(150);
  });
});

describe('low-flight: Bot', () => {
  for (const level of ['easy', 'medium', 'hard'] as const) {
    it(`spielt auf „${level}“ eine ganze Partie`, () => {
      let s = gameModule.setup(3, {}, `bot-${level}`);
      for (let guard = 0; !gameModule.result(s) && guard < 5000; guard++) {
        const seat = currentPlayers(s)[0] as number;
        const move = computeBotMove(gameModule, { gameId: 'low-flight', botId: 'wolkenspringer', level, seat, view: playerView(s, seat), seed: `${level}/${guard}`, timeBudgetMs: 100 }) as LowFlightMove;
        s = applyMove(s, seat, move).state;
      }
      expect(gameModule.result(s)).not.toBeNull();
    }, 60_000);
  }
});
