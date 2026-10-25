import { computeBotMove, resolveOptions, type BotLevel, type Options } from '@brett-und-blatt/engine';
import { gameContractChecks } from '@brett-und-blatt/engine/testing';
import { describe, expect, it, test } from 'vitest';
import { countStones, flipsFor, gameModule, type ReversiMove, type ReversiState } from '../src';

const at = (row: number, col: number, size = 8) => row * size + col;
const place = (cell: number): ReversiMove => ({ type: 'place', cell });

function start(options: Options = {}): ReversiState {
  return gameModule.setup(2, resolveOptions(gameModule, options), 'test');
}

describe('Regeln', () => {
  it('Kreuzstellung mit vier Zügen für Schwarz', () => {
    const state = start();
    expect(countStones(state)).toEqual([2, 2]);
    expect(gameModule.legalMoves(state, 0).map((m) => m.cell).sort((a, b) => a - b)).toEqual([at(2, 3), at(3, 2), at(4, 5), at(5, 4)]);
  });

  it('dreht in mehreren Richtungen gleichzeitig um', () => {
    const state = start();
    const cells: ReversiState['cells'] = Array(64).fill(null);
    // Schwarz setzt auf d4 und schließt Weiß nach rechts und nach unten ein.
    cells[at(3, 4)] = 1;
    cells[at(3, 5)] = 0;
    cells[at(4, 3)] = 1;
    cells[at(5, 3)] = 0;
    cells[at(4, 4)] = 1;
    cells[at(5, 5)] = 0;
    const custom = { ...state, cells };
    expect(flipsFor(custom, at(3, 3), 0).sort((a, b) => a - b)).toEqual([at(3, 4), at(4, 3), at(4, 4)]);
  });

  it('ohne Einschließen ist kein Zug erlaubt', () => {
    expect(() => gameModule.applyMove(start(), 0, place(0))).toThrow();
  });

  it('wer nicht ziehen kann, muss passen; kann niemand ziehen, ist Schluss', () => {
    // Weiß hat nur einen Stein, den Schwarz sofort umdreht: danach kann niemand mehr ziehen.
    const cells: ReversiState['cells'] = Array(64).fill(null);
    cells[at(0, 0)] = 0;
    cells[at(0, 1)] = 1;
    const state = { ...start(), cells };
    const { state: next, events } = gameModule.applyMove(state, 0, place(at(0, 2)));
    expect(next.over).toBe(true);
    expect(events.some((e) => e.type === 'over')).toBe(true);
    expect(gameModule.result(next)).toEqual({ kind: 'win', winners: [0] });
  });

  it('freie Eröffnung: die ersten vier Steine in die Mitte, ohne Umdrehen', () => {
    let state = start({ opening: 'free' });
    expect(gameModule.legalMoves(state, 0)).toHaveLength(4);
    for (let i = 0; i < 4; i++) state = gameModule.applyMove(state, state.turn, gameModule.legalMoves(state, state.turn)[0]!).state;
    expect(countStones(state)).toEqual([2, 2]);
  });
});

describe('Bot', () => {
  function botGame(levels: [BotLevel, BotLevel], seed: string) {
    let state = start();
    while (!gameModule.result(state)) {
      const move = computeBotMove(gameModule, { gameId: 'reversi', botId: 'reversi', level: levels[state.turn]!, seat: state.turn, view: state, seed: `${seed}/${state.cells.join()}`, timeBudgetMs: 50 }) as ReversiMove;
      state = gameModule.applyMove(state, state.turn, move).state;
    }
    return gameModule.result(state);
  }

  it('nimmt eine freie Ecke', () => {
    const cells: ReversiState['cells'] = Array(64).fill(null);
    cells[at(0, 1)] = 1;
    cells[at(0, 2)] = 0;
    cells[at(4, 4)] = 1;
    cells[at(4, 5)] = 0;
    const state = { ...start(), cells };
    const move = computeBotMove(gameModule, { gameId: 'reversi', botId: 'reversi', level: 'medium', seat: 0, view: state, seed: 'ecke', timeBudgetMs: 300 }) as ReversiMove;
    expect(move.cell).toBe(at(0, 0));
  });

  it('der mittlere Bot schlägt den leichten meistens', () => {
    let wins = 0;
    for (let g = 0; g < 4; g++) {
      const result = botGame(g % 2 === 0 ? ['medium', 'easy'] : ['easy', 'medium'], `spiel${g}`);
      if (result?.kind === 'win' && result.winners[0] === g % 2) wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(3);
  });
});

describe('Vertrag für Spielmodule', () => {
  for (const check of gameContractChecks(gameModule, { randomGames: 15 })) test(check.name, check.run);
});
