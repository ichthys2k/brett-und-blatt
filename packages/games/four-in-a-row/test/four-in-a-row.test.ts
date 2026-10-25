import { computeBotMove, resolveOptions, type BotLevel, type Options } from '@brett-und-blatt/engine';
import { gameContractChecks } from '@brett-und-blatt/engine/testing';
import { describe, expect, it, test } from 'vitest';
import { gameModule, type FourInARowMove, type FourInARowState } from '../src';

const drop = (column: number): FourInARowMove => ({ type: 'drop', column });
const pop = (column: number): FourInARowMove => ({ type: 'pop', column });

function play(columns: number[], options: Options = {}): FourInARowState {
  let state = gameModule.setup(2, resolveOptions(gameModule, options), 'test');
  for (const column of columns) state = gameModule.applyMove(state, state.turn, drop(column)).state;
  return state;
}

function botMove(state: FourInARowState, level: BotLevel, budget = 300): FourInARowMove {
  return computeBotMove(gameModule, {
    gameId: 'four-in-a-row',
    botId: 'four-in-a-row',
    level,
    seat: state.turn,
    view: state,
    seed: `zug${state.moveCount}`,
    timeBudgetMs: budget,
  }) as FourInARowMove;
}

describe('Regeln', () => {
  it('Steine fallen auf den untersten freien Platz', () => {
    const state = play([3, 3, 3]);
    expect(state.cells[3 * 6 + 0]).toBe(0);
    expect(state.cells[3 * 6 + 1]).toBe(1);
    expect(state.cells[3 * 6 + 2]).toBe(0);
  });

  it('erkennt Vierer waagerecht, senkrecht und in beide Diagonalen, auch am Rand', () => {
    expect(gameModule.result(play([0, 0, 1, 1, 2, 2, 3]))).toEqual({ kind: 'win', winners: [0] });
    expect(gameModule.result(play([6, 0, 6, 0, 6, 0, 6]))).toEqual({ kind: 'win', winners: [0] });
    // Diagonale nach rechts oben: 0, 1, 2, 3
    expect(gameModule.result(play([0, 1, 1, 2, 2, 3, 2, 3, 3, 6, 3]))).toEqual({ kind: 'win', winners: [0] });
    // Diagonale nach links oben: 6, 5, 4, 3
    expect(gameModule.result(play([6, 5, 5, 4, 4, 3, 4, 3, 3, 0, 3]))).toEqual({ kind: 'win', winners: [0] });
  });

  it('meldet bei einem Sieg die Gewinnreihe', () => {
    expect(play([0, 0, 1, 1, 2, 2, 3]).winLines).toEqual([[0, 6, 12, 18]]);
  });

  it('volles Brett ohne Vierer ist unentschieden', () => {
    // Spaltenfolge, die ein 7×6-Brett ohne Vierer füllt.
    const order = [0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 2, 3, 2, 3, 2, 3, 3, 2, 3, 2, 3, 2, 4, 5, 4, 5, 4, 5, 5, 4, 5, 4, 5, 4, 6, 6, 6, 6, 6, 6];
    const state = play(order);
    expect(gameModule.result(state)).toEqual({ kind: 'draw', reason: 'full' });
  });

  it('volle Spalten sind nicht erlaubt', () => {
    const state = play([2, 2, 2, 2, 2, 2]);
    expect(gameModule.legalMoves(state, state.turn).some((m) => m.column === 2)).toBe(false);
    expect(() => gameModule.applyMove(state, state.turn, drop(2))).toThrow();
  });

  it('PopOut: nur eigene unterste Steine lassen sich herausziehen, der Rest rutscht nach', () => {
    let state = gameModule.setup(2, resolveOptions(gameModule, { popOut: 'on' }), 'test');
    state = gameModule.applyMove(state, 0, drop(3)).state;
    state = gameModule.applyMove(state, 1, drop(3)).state;
    expect(gameModule.legalMoves(state, 0)).toContainEqual(pop(3));
    expect(() => gameModule.applyMove(gameModule.applyMove(state, 0, drop(0)).state, 1, pop(3))).toThrow();
    state = gameModule.applyMove(state, 0, pop(3)).state;
    expect(state.cells[3 * 6]).toBe(1);
    expect(state.cells[3 * 6 + 1]).toBeNull();
  });

  it('andere Brettgrößen funktionieren', () => {
    const state = play([0, 0, 1, 1, 2, 2, 3], { size: '9x7' });
    expect(state.cols).toBe(9);
    expect(gameModule.result(state)).toEqual({ kind: 'win', winners: [0] });
  });
});

describe('Bot', () => {
  it('nimmt ab Stufe „mittel“ einen sofort möglichen Sieg', () => {
    // Platz 0 hat drei in Reihe unten (Spalten 0–2) und ist dran.
    const state = play([0, 0, 1, 1, 2, 6]);
    for (const level of ['medium', 'hard'] as const) expect(botMove(state, level)).toEqual(drop(3));
  });

  it('blockiert ab Stufe „mittel“ eine sofortige Niederlage', () => {
    // Platz 1 droht mit drei in Reihe senkrecht in Spalte 4; Platz 0 ist dran.
    const state = play([0, 4, 0, 4, 6, 4]);
    for (const level of ['medium', 'hard'] as const) expect(botMove(state, level)).toEqual(drop(4));
  });

  it('schlägt den Zufallsbot fast immer', () => {
    let wins = 0;
    for (let g = 0; g < 10; g++) {
      let state = gameModule.setup(2, resolveOptions(gameModule), `gegen-zufall${g}`);
      const botSeat = g % 2;
      while (!gameModule.result(state)) {
        const move =
          state.turn === botSeat
            ? botMove(state, 'medium', 100)
            : (computeBotMove(gameModule, { gameId: 'four-in-a-row', botId: 'random', level: 'easy', seat: state.turn, view: state, seed: `${g}/${state.moveCount}`, timeBudgetMs: 10 }) as FourInARowMove);
        state = gameModule.applyMove(state, state.turn, move).state;
      }
      const result = gameModule.result(state);
      if (result?.kind === 'win' && result.winners[0] === botSeat) wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(9);
  });
});

describe('Vertrag für Spielmodule', () => {
  for (const check of gameContractChecks(gameModule, { randomGames: 25 })) test(check.name, check.run);
});
