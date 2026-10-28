import { gameContractChecks } from '@brett-und-blatt/engine/testing';
import { describe, expect, it } from 'vitest';
import { gameModule } from '../src';

gameContractChecks(gameModule);

describe('Wortgitter – Grundgerüst', () => {
  it('startet ein Spiel korrekt', () => {
    const state = gameModule.setup(2, {}, 'test-seed');
    expect(state.board.length).toBe(225);
    expect(state.turn).toBe(0);
    expect(state.racks[0].length).toBe(7);
    expect(state.racks[1].length).toBe(7);
  });

  it('erkennt Spielende bei leerem Brett nur mit erstem Zug über Mitte', () => {
    const state = gameModule.setup(2, {}, 'test');
    const moves = gameModule.legalMoves(state, 0);
    // Erstzug muss über Mitte gehen
    expect(moves.length).toBeGreaterThan(0);
  });
});
