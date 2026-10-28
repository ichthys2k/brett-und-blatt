import { describe, expect, it } from 'vitest';
import { gameContractChecks } from '@brett-und-blatt/engine/testing';
import { gameModule } from '../src';
import { applyMove, legalMoves, result, setup } from '../src/rules';

describe('gomoku: allgemeine Prüfungen', () => {
  for (const check of gameContractChecks(gameModule)) it(check.name, check.run);
});

describe('gomoku', () => {
  it('erkennt einen horizontalen Fünfer', () => {
    let state = setup();
    for (let i = 0; i < 5; i++) {
      const move = legalMoves(state, 0).find((m) => m.cell === i * 15 + 7);
      expect(move).toBeDefined();
      state = applyMove(state, 0, move!).state;
      if (i < 4) {
        const move2 = legalMoves(state, 1).find((m) => m.cell === i * 15 + 0);
        state = applyMove(state, 1, move2!).state;
      }
    }
    expect(result(state)?.kind).toBe('win');
    expect(state.winner).toBe(0);
    expect(state.winLine).toHaveLength(5);
  });

  it('erkennt einen vertikalen Fünfer', () => {
    let state = setup();
    for (let i = 0; i < 5; i++) {
      const move = legalMoves(state, 0).find((m) => m.cell === 7 * 15 + i);
      state = applyMove(state, 0, move!).state;
      if (i < 4) {
        const move2 = legalMoves(state, 1).find((m) => m.cell === 0 * 15 + i);
        state = applyMove(state, 1, move2!).state;
      }
    }
    expect(result(state)?.kind).toBe('win');
  });

  it('erkennt einen diagonalen Fünfer', () => {
    let state = setup();
    for (let i = 0; i < 5; i++) {
      const move = legalMoves(state, 0).find((m) => m.cell === i * 15 + i);
      state = applyMove(state, 0, move!).state;
      if (i < 4) {
        const move2 = legalMoves(state, 1).find((m) => m.cell === i * 15 + (i + 1));
        state = applyMove(state, 1, move2!).state;
      }
    }
    expect(result(state)?.kind).toBe('win');
  });
});
