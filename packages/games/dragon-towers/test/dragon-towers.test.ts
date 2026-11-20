import { computeBotMove } from '@brett-und-blatt/engine';
import { gameContractChecks } from '@brett-und-blatt/engine/testing';
import { describe, expect, it } from 'vitest';
import { BOARD_COLORS, gameModule, type DragonTowersMove, type DragonTowersState, type Tower } from '../src';
import { describeMove } from '../src/describe';

const sq = (name: string) => (8 - Number(name[1])) * 8 + 'abcdefgh'.indexOf(name[0]!);

/** Leeres Brett mit einzelnen Türmen für gezielte Lagen. */
function position(towers: Record<string, Tower>, extra: Partial<DragonTowersState> = {}): DragonTowersState {
  const state = gameModule.setup(2, {}, 'test');
  const cells: (Tower | null)[] = Array(64).fill(null);
  for (const [name, tower] of Object.entries(towers)) cells[sq(name)] = tower;
  return { ...state, towers: cells, ...extra };
}

describe('Drachentürme – Brett und Aufstellung', () => {
  it('jede Farbe kommt in jeder Reihe und Spalte genau einmal vor, das Brett ist drehsymmetrisch', () => {
    for (let i = 0; i < 8; i++) {
      expect(new Set(BOARD_COLORS.slice(i * 8, i * 8 + 8)).size).toBe(8);
      expect(new Set(Array.from({ length: 8 }, (_, r) => BOARD_COLORS[r * 8 + i])).size).toBe(8);
    }
    for (let i = 0; i < 64; i++) expect(BOARD_COLORS[i]).toBe(BOARD_COLORS[63 - i]);
  });

  it('jeder Turm steht auf dem Feld seiner Farbe, Schwarz beginnt mit freier Wahl', () => {
    const state = gameModule.setup(2, {}, 'test');
    state.towers.forEach((tower, index) => {
      if (tower) expect(BOARD_COLORS[index]).toBe(tower.color);
    });
    expect(state.towers.filter((t) => t?.seat === 0)).toHaveLength(8);
    expect(state.towers.filter((t) => t?.seat === 1)).toHaveLength(8);
    expect(state.turn).toBe(0);
    expect(state.required).toBeNull();
    const froms = new Set(gameModule.legalMoves(state, 0).map((m) => (m.type === 'move' ? m.from : -1)));
    expect(froms.size).toBe(8);
  });
});

describe('Drachentürme – Ziehen', () => {
  it('Türme ziehen gerade und schräg vorwärts, nie durch andere Türme', () => {
    const state = position({ d1: { seat: 0, color: 4 }, d4: { seat: 1, color: 0 }, f3: { seat: 1, color: 1 } }, { required: 4 });
    const targets = gameModule.legalMoves(state, 0).map((m) => (m.type === 'move' ? m.to : -1)).sort((a, b) => a - b);
    // gerade: d2, d3 (d4 besetzt); links schräg: c2, b3, a4; rechts schräg: e2 (f3 besetzt)
    expect(targets).toEqual(['d2', 'd3', 'c2', 'b3', 'a4', 'e2'].map(sq).sort((a, b) => a - b));
  });

  it('der Gegner muss den Turm in der Farbe des Landefelds ziehen', () => {
    const state = gameModule.setup(2, {}, 'test');
    const move = gameModule.legalMoves(state, 0).find((m) => m.type === 'move' && m.from === sq('a1') && m.to === sq('a4'))!;
    const next = gameModule.applyMove(state, 0, move).state;
    expect(next.turn).toBe(1);
    expect(next.required).toBe(BOARD_COLORS[sq('a4')]);
    const froms = new Set(gameModule.legalMoves(next, 1).map((m) => (m.type === 'move' ? m.from : -1)));
    expect(froms.size).toBe(1);
    expect(next.towers[[...froms][0]!]).toEqual({ seat: 1, color: BOARD_COLORS[sq('a4')] });
  });

  it('wer die gegnerische Grundreihe erreicht, gewinnt', () => {
    const state = position({ b7: { seat: 0, color: 2 }, h8: { seat: 1, color: 7 } }, { required: 2 });
    const win = gameModule.legalMoves(state, 0).find((m) => m.type === 'move' && m.to === sq('b8'))!;
    const { state: after, events } = gameModule.applyMove(state, 0, win);
    expect(gameModule.result(after)).toMatchObject({ kind: 'win', winners: [0] });
    expect(events.map((e) => e.type)).toContain('win');
  });
});

describe('Drachentürme – Aussetzen und Blockade', () => {
  it('ein eingesperrter Turm setzt aus, der Gegner zieht die Farbe seines Feldes', () => {
    // Schwarzer Turm auf e4 ist von drei Gold-Türmen eingesperrt.
    const state = position({ e4: { seat: 0, color: 3 }, d5: { seat: 1, color: 5 }, e5: { seat: 1, color: 1 }, f5: { seat: 1, color: BOARD_COLORS[sq('e4')]! } }, { required: 3, lastMover: 1 });
    const moves = gameModule.legalMoves(state, 0);
    expect(moves).toEqual([{ type: 'pass' }]);
    expect(describeMove(state, moves[0]!)).toBe('Aussetzen (Turm Rosa eingesperrt)');
    const after = gameModule.applyMove(state, 0, moves[0]!).state;
    expect(after.turn).toBe(1);
    expect(after.required).toBe(BOARD_COLORS[sq('e4')]);
    expect(after.end).toBeNull();
  });

  it('sperren sich beide gegenseitig ein, verliert, wer zuletzt wirklich gezogen hat', () => {
    // Schwarz e4 und Gold e5 blockieren sich. Die Farben sind so gewählt, dass jeder immer den blockierten Turm ziehen muss.
    const e4 = BOARD_COLORS[sq('e4')]!;
    const e5 = BOARD_COLORS[sq('e5')]!;
    const state = position(
      { e4: { seat: 0, color: e5 }, e5: { seat: 1, color: e4 }, d5: { seat: 1, color: e4 === 0 ? 1 : 0 }, f5: { seat: 1, color: e4 === 2 ? 3 : 2 }, d4: { seat: 0, color: e5 === 4 ? 5 : 4 }, f4: { seat: 0, color: e5 === 6 ? 7 : 6 } },
      { required: e5, lastMover: 0 },
    );
    let current = state;
    const actor = () => current.turn;
    for (let i = 0; i < 4 && current.end === null; i++) {
      const moves = gameModule.legalMoves(current, actor());
      expect(moves).toEqual([{ type: 'pass' }]);
      current = gameModule.applyMove(current, actor(), moves[0]!).state;
    }
    expect(current.end).toBe('deadlock');
    expect(gameModule.result(current)).toMatchObject({ kind: 'win', winners: [1] });
  });
});

describe('Drachentürme – Bot', () => {
  it('nimmt einen sofortigen Sieg auf jeder Stufe', () => {
    const state = position({ c7: { seat: 0, color: 5 }, h8: { seat: 1, color: 7 } }, { required: 5 });
    for (const level of ['easy', 'medium', 'hard'] as const) {
      const move = computeBotMove(gameModule, { gameId: 'dragon-towers', botId: 'dragon-towers', level, seat: 0, view: state, seed: `sieg-${level}`, timeBudgetMs: 500 }) as DragonTowersMove;
      expect(move.type === 'move' && Math.floor(move.to / 8) === 0).toBe(true);
    }
  });
});

describe('Drachentürme – Vertrag', () => {
  for (const check of gameContractChecks(gameModule)) it(check.name, check.run);
});
