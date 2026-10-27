import { computeBotMove, type BotLevel } from '@brett-und-blatt/engine';
import { gameContractChecks } from '@brett-und-blatt/engine/testing';
import { describe, expect, it, test } from 'vitest';
import { gameModule, type TicTacToeMove, type TicTacToeState } from '../src';

const place = (cell: number): TicTacToeMove => ({ type: 'place', cell });

function play(cells: number[]): TicTacToeState {
  let state = gameModule.setup(2, {}, 'test');
  for (const cell of cells) state = gameModule.applyMove(state, state.turn, place(cell)).state;
  return state;
}

/** Spielt eine Partie zwischen zwei Bots (Platz 0 beginnt). */
function botGame(levels: [BotLevel, BotLevel], seed: string, botIds: [string, string] = ['poker', 'poker']) {
  let state = gameModule.setup(2, {}, seed);
  for (let step = 0; !gameModule.result(state); step++) {
    const seat = state.turn;
    const move = computeBotMove(gameModule, {
      gameId: 'poker',
      botId: botIds[seat]!,
      level: levels[seat]!,
      seat,
      view: state,
      seed: `${seed}/${step}`,
      timeBudgetMs: 50,
    }) as TicTacToeMove;
    state = gameModule.applyMove(state, seat, move).state;
  }
  return gameModule.result(state);
}

describe('Regeln', () => {
  it('erkennt alle acht Gewinnreihen', () => {
    const wins: [number[], number[]][] = [
      [[0, 3, 1, 4, 2], [0, 1, 2]],
      [[3, 0, 4, 1, 5], [3, 4, 5]],
      [[6, 0, 7, 1, 8], [6, 7, 8]],
      [[0, 1, 3, 2, 6], [0, 3, 6]],
      [[1, 0, 4, 2, 7], [1, 4, 7]],
      [[2, 0, 5, 1, 8], [2, 5, 8]],
      [[0, 1, 4, 2, 8], [0, 4, 8]],
      [[2, 0, 4, 1, 6], [2, 4, 6]],
    ];
    for (const [cells, line] of wins) {
      const state = play(cells);
      expect(gameModule.result(state)).toEqual({ kind: 'win', winners: [0] });
      expect(state.winLine).toEqual(line);
    }
  });

  it('volles Brett ohne Reihe ist unentschieden', () => {
    expect(gameModule.result(play([0, 1, 2, 4, 3, 5, 7, 6, 8]))).toEqual({ kind: 'draw' });
  });

  it('besetzte Felder und fremde Züge sind nicht erlaubt', () => {
    const state = play([4]);
    expect(() => gameModule.applyMove(state, 1, place(4))).toThrow();
    expect(() => gameModule.applyMove(state, 0, place(0))).toThrow();
    expect(gameModule.legalMoves(state, 1)).toHaveLength(8);
    expect(gameModule.legalMoves(state, 0)).toHaveLength(0);
  });
});

describe('Bot', () => {
  it('der schwere Bot verliert nie – weder als Erster noch als Zweiter', () => {
    for (let g = 0; g < 30; g++) {
      const asFirst = botGame(['hard', 'easy'], `erster${g}`, ['poker', 'random']);
      expect(asFirst?.kind === 'draw' || (asFirst?.kind === 'win' && asFirst.winners[0] === 0)).toBe(true);
      const asSecond = botGame(['easy', 'hard'], `zweiter${g}`, ['random', 'poker']);
      expect(asSecond?.kind === 'draw' || (asSecond?.kind === 'win' && asSecond.winners[0] === 1)).toBe(true);
    }
  });

  it('zwei schwere Bots spielen immer unentschieden', () => {
    for (let g = 0; g < 5; g++) expect(botGame(['hard', 'hard'], `remis${g}`)).toEqual({ kind: 'draw' });
  });
});

describe('Vertrag für Spielmodule', () => {
  for (const check of gameContractChecks(gameModule)) test(check.name, check.run);
});
