import { computeBotMove, resolveOptions, type Options } from '@brett-und-blatt/engine';
import { gameContractChecks } from '@brett-und-blatt/engine/testing';
import { describe, expect, it, test } from 'vitest';
import { MILLS, NEIGHBORS } from '../src/board';
import { gameModule, isInMill, phaseOf, removable, type MillMove, type MillState } from '../src';

function start(options: Options = {}): MillState {
  return gameModule.setup(2, resolveOptions(gameModule, options), 'test');
}

/** Spielstand mit gegebener Belegung in der Zugphase. */
function position(white: number[], black: number[], turn = 0, options: Options = {}): MillState {
  const state = start(options);
  const cells: MillState['cells'] = Array(24).fill(null);
  for (const p of white) cells[p] = 0;
  for (const p of black) cells[p] = 1;
  return { ...state, cells, inHand: [0, 0], turn };
}

describe('Brett', () => {
  it('hat 24 Punkte, 32 Linien und 16 Mühlen', () => {
    expect(NEIGHBORS).toHaveLength(24);
    expect(NEIGHBORS.reduce((sum, n) => sum + n.length, 0) / 2).toBe(32);
    expect(MILLS).toHaveLength(16);
    for (const mill of MILLS) expect(new Set(mill).size).toBe(3);
  });
});

describe('Regeln', () => {
  it('der erste Zug hat genau 24 Möglichkeiten', () => {
    expect(gameModule.legalMoves(start(), 0)).toHaveLength(24);
  });

  it('erkennt Mühlen und verlangt Wegnehmen', () => {
    let state = start();
    // Weiß setzt 0, 1 (Schwarz irgendwo) und schließt mit 2 die Mühle 0-1-2.
    for (const [seat, to] of [
      [0, 0],
      [1, 20],
      [0, 1],
      [1, 21],
    ] as const) {
      state = gameModule.applyMove(state, seat, { type: 'place', to, remove: [] }).state;
    }
    const moves = gameModule.legalMoves(state, 0).filter((m) => m.to === 2);
    expect(moves.map((m) => m.remove)).toEqual([[20], [21]]);
    const { state: after } = gameModule.applyMove(state, 0, moves[0]!);
    expect(after.cells[20]).toBeNull();
    expect(isInMill(after.cells, 1)).toBe(true);
  });

  it('Steine in Mühlen sind geschützt, außer alle stehen in Mühlen', () => {
    // Schwarz: Mühle 8-9-10 und ein freier Stein auf 20.
    const state = position([0, 1], [8, 9, 10, 20]);
    expect(removable(state, state.cells, 1)).toEqual([20]);
    const allInMills = position([0, 1], [8, 9, 10]);
    expect(removable(allInMills, allInMills.cells, 1).sort((a, b) => a - b)).toEqual([8, 9, 10]);
    const always = position([0, 1], [8, 9, 10, 20], 0, { removeFromMills: 'always' });
    expect(removable(always, always.cells, 1)).toHaveLength(4);
  });

  it('mit drei Steinen wird gesprungen, mit weniger ist das Spiel verloren', () => {
    const state = position([0, 1, 13], [8, 9, 18, 22], 0);
    expect(phaseOf(state, 0)).toBe('fly');
    expect(phaseOf(position([0, 1, 13], [8], 0, { flying: 'off' }), 0)).toBe('move');
    // Weiß zieht 13 → 2 und schließt 0-1-2; Schwarz hat danach nur noch drei Steine – nimmt Weiß einen, verliert Schwarz.
    const black = position([0, 1, 13], [8, 9, 18], 0);
    const move = gameModule.legalMoves(black, 0).find((m) => m.to === 2 && m.remove.length === 1)!;
    const { state: end } = gameModule.applyMove(black, 0, move);
    expect(gameModule.result(end)).toEqual({ kind: 'win', winners: [0] });
  });

  it('wer nicht mehr ziehen kann, verliert', () => {
    // Schwarz auf 0, 2, 4 ist von Weiß auf 1, 3, 5, 7 eingeschlossen. Weiß zieht 16 → 23, danach kann Schwarz nicht ziehen.
    const state = position([1, 3, 5, 7, 16], [0, 2, 4], 0, { flying: 'off' });
    const { state: end } = gameModule.applyMove(state, 0, { type: 'move', from: 16, to: 23, remove: [] });
    expect(gameModule.result(end)).toEqual({ kind: 'win', winners: [0] });
  });

  it('Doppelmühle nimmt mit der Option zwei Steine', () => {
    // Weiß zieht von 15 nach 1 und schließt 0-1-2 und 1-9-17 gleichzeitig.
    const state = position([0, 2, 9, 17, 15], [20, 21, 23, 4], 0, { doubleMill: 'two' });
    const moves = gameModule.legalMoves(state, 0).filter((m) => m.type === 'move' && m.from === 15 && m.to === 1);
    // 15 und 1 sind nicht benachbart – Weiß hat 5 Steine, kein Springen. Deshalb ohne Ergebnis.
    expect(moves).toHaveLength(0);
    const placing = { ...position([0, 2, 9, 17], [20, 21, 23, 4], 0, { doubleMill: 'two' }), inHand: [1, 1] as [number, number] };
    const double = gameModule.legalMoves(placing, 0).filter((m) => m.to === 1);
    expect(double.every((m) => m.remove.length === 2)).toBe(true);
    expect(double.length).toBe(6);
  });
});

describe('Bot', () => {
  it('schließt eine sofort mögliche Mühle', () => {
    const state = { ...start(), cells: start().cells.map((_, p) => (p === 0 || p === 1 ? 0 : p === 20 || p === 21 ? 1 : null)), inHand: [7, 7] as [number, number] };
    const move = computeBotMove(gameModule, { gameId: 'mill', botId: 'mill', level: 'medium', seat: 0, view: state, seed: 'x', timeBudgetMs: 400 }) as MillMove;
    expect(move.to).toBe(2);
    expect(move.remove).toHaveLength(1);
  });
});

describe('Vertrag für Spielmodule', () => {
  for (const check of gameContractChecks(gameModule, { randomGames: 8 })) test(check.name, check.run);
});
