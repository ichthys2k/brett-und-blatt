import { computeBotMove, resolveOptions, type Options } from '@brett-und-blatt/engine';
import { gameContractChecks } from '@brett-und-blatt/engine/testing';
import { describe, expect, it, test } from 'vitest';
import { gameModule, playableBoards, type UltimateMove, type UltimateState } from '../src';

const place = (board: number, cell: number): UltimateMove => ({ type: 'place', board, cell });

function play(moves: [number, number][], options: Options = {}): UltimateState {
  let state = gameModule.setup(2, resolveOptions(gameModule, options), 'test');
  for (const [board, cell] of moves) state = gameModule.applyMove(state, state.turn, place(board, cell)).state;
  return state;
}

describe('Regeln', () => {
  it('der Zug bestimmt das Feld des Gegners', () => {
    const state = play([[4, 2]]);
    expect(playableBoards(state)).toEqual([2]);
    expect(gameModule.legalMoves(state, 1).every((m) => m.board === 2)).toBe(true);
  });

  // Kreis gewinnt Feld 0 mit den Zellen 3, 4, 5; danach schickt Kreuz Kreis zurück in Feld 0.
  const WIN_BOARD_0: [number, number][] = [
    [0, 0],
    [0, 4],
    [4, 0],
    [0, 3],
    [3, 0],
    [0, 5],
    [5, 0],
  ];

  it('kleines Feld gewinnen und danach freie Wahl, wenn man dorthin geschickt wird', () => {
    const state = play(WIN_BOARD_0);
    expect(state.boards[0]).toBe(1);
    expect(playableBoards(state).length).toBeGreaterThan(1);
    expect(playableBoards(state)).not.toContain(0);
  });

  it('Variante: entschiedene Felder bleiben bespielbar', () => {
    expect(playableBoards(play(WIN_BOARD_0, { decided: 'playable' }))).toEqual([0]);
  });

  it('drei kleine Felder in einer Reihe gewinnen', () => {
    let state = gameModule.setup(2, resolveOptions(gameModule), 'sieg');
    // Kreuz gewinnt die Felder 0, 1, 2 nacheinander; Kreis spielt nur dorthin, wohin es geschickt wird.
    let guard = 0;
    const targets = [0, 1, 2];
    while (!gameModule.result(state) && guard++ < 200) {
      const moves = gameModule.legalMoves(state, state.turn);
      const preferred = state.turn === 0 ? moves.find((m) => targets.includes(m.board) && state.boards[m.board] === null) : moves.find((m) => !targets.includes(m.cell));
      state = gameModule.applyMove(state, state.turn, preferred ?? moves[0]!).state;
    }
    expect(gameModule.result(state)).not.toBeNull();
  });
});

describe('Bot', () => {
  it('nimmt einen sofortigen Gesamtsieg', () => {
    let state = gameModule.setup(2, resolveOptions(gameModule), 'bot');
    state = { ...state, boards: [0, 0, null, 1, 1, null, null, null, null], forced: 2, turn: 0 };
    state.cells = [...state.cells];
    state.cells[2 * 9 + 0] = 0;
    state.cells[2 * 9 + 1] = 0;
    const move = computeBotMove(gameModule, { gameId: gameModule.info.id, botId: 'ultimate', level: 'medium', seat: 0, view: state, seed: 'x', timeBudgetMs: 300 }) as UltimateMove;
    expect(move).toEqual(place(2, 2));
  });
});

describe('Vertrag für Spielmodule', () => {
  for (const check of gameContractChecks(gameModule, { randomGames: 20 })) test(check.name, check.run);
});
