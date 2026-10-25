import { computeBotMove, resolveOptions } from '@brett-und-blatt/engine';
import { gameContractChecks } from '@brett-und-blatt/engine/testing';
import { describe, expect, it, test } from 'vitest';
import { gameModule, type FourChessMove } from '../src';

describe('Anbindung an die Schnittstelle', () => {
  it('Rot beginnt und hat 20 Eröffnungszüge', () => {
    const state = gameModule.setup(4, resolveOptions(gameModule), 'test');
    expect(gameModule.currentPlayers(state)).toEqual([0]);
    expect(gameModule.legalMoves(state, 0)).toHaveLength(20);
    expect(gameModule.legalMoves(state, 1)).toHaveLength(0);
  });

  it('ein Zug ändert den alten Spielstand nicht und gibt an Blau weiter', () => {
    const state = gameModule.setup(4, resolveOptions(gameModule), 'test');
    const before = JSON.stringify(state);
    const move = gameModule.legalMoves(state, 0)[0]!;
    const { state: next, events } = gameModule.applyMove(state, 0, move);
    expect(JSON.stringify(state)).toBe(before);
    expect(gameModule.currentPlayers(next)).toEqual([1]);
    expect(events[0]).toMatchObject({ type: 'moved' });
  });

  it('der Bot liefert erlaubte Züge im Format der Schnittstelle', () => {
    const state = gameModule.setup(4, resolveOptions(gameModule), 'bot');
    for (const level of ['easy', 'medium', 'hard'] as const) {
      const move = computeBotMove(gameModule, { gameId: 'four-player-chess', botId: 'four-player-chess', level, seat: 0, view: state, seed: level, timeBudgetMs: 10 }) as FourChessMove;
      expect(gameModule.legalMoves(state, 0)).toContainEqual(move);
    }
  });
});

describe('Vertrag für Spielmodule', () => {
  for (const check of gameContractChecks(gameModule, { randomGames: 2, botMoveLimit: 40, maxMoves: 4000 })) test(check.name, check.run);
});
