import { computeBotMove } from '@brett-und-blatt/engine';
import { gameContractChecks } from '@brett-und-blatt/engine/testing';
import { describe, expect, it, test } from 'vitest';
import {
  buildDeck,
  fits,
  gameModule,
  handSize,
  legalMoves,
  type ElevensMove,
  type ElevensState,
} from '../src';

function base(overrides: Partial<ElevensState> = {}): ElevensState {
  return {
    seats: 2,
    hands: [[], []],
    stock: [],
    rows: { r: null, y: null, g: null, b: null },
    turn: 0,
    played: 0,
    drawn: 0,
    opening: null,
    drawLimit: 3,
    winner: null,
    rng: [1, 2, 3, 4],
    ...overrides,
  };
}

describe('Elf zuerst! – Regeln', () => {
  it('hat 80 Karten und teilt je nach Spielerzahl aus', () => {
    expect(buildDeck()).toHaveLength(80);
    expect(new Set(buildDeck()).size).toBe(80);
    for (const [seats, size, stock] of [[2, 20, 40], [3, 20, 20], [4, 15, 20], [5, 12, 20], [6, 10, 20]] as const) {
      const state = gameModule.setup(seats, {}, `deal-${seats}`);
      expect(handSize(seats)).toBe(size);
      expect(state.hands.every((h) => h.length === size)).toBe(true);
      expect(state.stock).toHaveLength(stock);
    }
  });

  it('wer die rote Elf hat, beginnt und muss sie legen', () => {
    for (let i = 0; i < 20; i++) {
      const state = gameModule.setup(4, {}, `rot-${i}`);
      if (state.opening !== 'r11') continue;
      expect(state.hands[state.turn]).toContain('r11');
      expect(legalMoves(state, state.turn)).toEqual([{ type: 'play', card: 'r11' }]);
    }
  });

  it('angelegt wird nur an die Enden derselben Farbe', () => {
    const rows = { r: { low: 9, high: 13 }, y: null, g: null, b: null };
    expect(fits(rows, 'r8')).toBe(true);
    expect(fits(rows, 'r14')).toBe(true);
    expect(fits(rows, 'r12')).toBe(false);
    expect(fits(rows, 'y11')).toBe(true);
    expect(fits(rows, 'y12')).toBe(false);
  });

  it('beliebig viele Karten legen, dann „Fertig“', () => {
    let state = base({ hands: [['r11', 'r12', 'r13', 'b5'], ['g3']] });
    state = gameModule.applyMove(state, 0, { type: 'play', card: 'r11' }).state;
    expect(legalMoves(state, 0)).toEqual([{ type: 'play', card: 'r12' }, { type: 'end' }]);
    state = gameModule.applyMove(state, 0, { type: 'play', card: 'r12' }).state;
    state = gameModule.applyMove(state, 0, { type: 'play', card: 'r13' }).state;
    // Nichts passt mehr: Der Zug endet von selbst.
    expect(state.turn).toBe(1);
    expect(state.rows.r).toEqual({ low: 11, high: 13 });
  });

  it('wer nicht kann, zieht bis zu drei Karten und gibt dann weiter', () => {
    let state = base({ hands: [['b5'], ['g3']], stock: ['y2', 'y3', 'y4', 'y5'] });
    expect(legalMoves(state, 0)).toEqual([{ type: 'draw' }]);
    state = gameModule.applyMove(state, 0, { type: 'draw' }).state;
    state = gameModule.applyMove(state, 0, { type: 'draw' }).state;
    expect(state.turn).toBe(0);
    state = gameModule.applyMove(state, 0, { type: 'draw' }).state;
    expect(state.turn).toBe(1);
    expect(state.hands[0]).toHaveLength(4);
  });

  it('eine passende gezogene Karte darf gleich gelegt werden', () => {
    let state = base({ hands: [['b5'], ['g3']], stock: ['r11', 'y3'] });
    state = gameModule.applyMove(state, 0, { type: 'draw' }).state;
    expect(legalMoves(state, 0)).toEqual([{ type: 'play', card: 'r11' }]);
  });

  it('wer die letzte Karte legt, gewinnt', () => {
    const state = base({ hands: [['r11'], ['g3']] });
    const next = gameModule.applyMove(state, 0, { type: 'play', card: 'r11' }).state;
    expect(gameModule.result(next)).toEqual({ kind: 'win', winners: [0] });
  });

  it('der schwere Bot hält Karten zurück, die nur den anderen helfen', () => {
    const state = base({
      hands: [['r12', 'r13', 'g10', 'b2', 'b3'], ['y5']],
      rows: { r: { low: 11, high: 11 }, y: null, g: { low: 11, high: 11 }, b: null },
      played: 1,
    });
    const move = computeBotMove(gameModule, {
      gameId: 'elevens', botId: 'elevens', level: 'hard', seat: 0, view: gameModule.playerView(state, 0), seed: 'x', timeBudgetMs: 50,
    }) as ElevensMove;
    expect(move).toEqual({ type: 'play', card: 'r12' });
    const later = base({
      hands: [['g10', 'b2', 'b3', 'b7'], ['y5']],
      rows: { r: { low: 11, high: 13 }, y: null, g: { low: 11, high: 11 }, b: null },
      played: 2,
    });
    const stop = computeBotMove(gameModule, {
      gameId: 'elevens', botId: 'elevens', level: 'hard', seat: 0, view: gameModule.playerView(later, 0), seed: 'y', timeBudgetMs: 50,
    }) as ElevensMove;
    expect(stop).toEqual({ type: 'end' });
  });
});

describe('Elf zuerst! – Plattform-Vertragstests', () => {
  for (const check of gameContractChecks(gameModule)) {
    test(check.name, check.run, 60_000);
  }
});
