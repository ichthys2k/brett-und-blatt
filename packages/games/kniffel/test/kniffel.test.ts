import { gameContractChecks } from '@brett-und-blatt/engine/testing';
import { describe, expect, it } from 'vitest';
import { calculateScore, gameModule } from '../src';

describe('Kniffel-Auswertung', () => {
  it('Einser bis Sechser', () => {
    expect(calculateScore('ones', [1, 1, 2, 3, 4])).toBe(2);
    expect(calculateScore('sixes', [6, 6, 6, 1, 2])).toBe(18);
  });

  it('Dreier- und Viererpasch', () => {
    expect(calculateScore('threeOfAKind', [3, 3, 3, 1, 2])).toBe(12);
    expect(calculateScore('threeOfAKind', [1, 2, 3, 4, 5])).toBe(0);
    expect(calculateScore('fourOfAKind', [4, 4, 4, 4, 2])).toBe(18);
    expect(calculateScore('fourOfAKind', [3, 3, 3, 1, 2])).toBe(0);
  });

  it('Full House', () => {
    expect(calculateScore('fullHouse', [2, 2, 3, 3, 3])).toBe(25);
    expect(calculateScore('fullHouse', [5, 5, 5, 5, 5])).toBe(0);
    expect(calculateScore('fullHouse', [1, 1, 2, 2, 4])).toBe(0);
  });

  it('Straßen', () => {
    expect(calculateScore('smallStraight', [1, 2, 3, 4, 6])).toBe(30);
    expect(calculateScore('smallStraight', [2, 3, 4, 5, 1])).toBe(30);
    expect(calculateScore('largeStraight', [1, 2, 3, 4, 5])).toBe(40);
    expect(calculateScore('largeStraight', [2, 3, 4, 5, 6])).toBe(40);
    expect(calculateScore('largeStraight', [1, 2, 3, 4, 6])).toBe(0);
  });

  it('Kniffel und Chance', () => {
    expect(calculateScore('kniffel', [5, 5, 5, 5, 5])).toBe(50);
    expect(calculateScore('kniffel', [1, 1, 1, 1, 2])).toBe(0);
    expect(calculateScore('chance', [1, 2, 3, 4, 6])).toBe(16);
  });
});

describe('Spielablauf', () => {
  it('startet mit 3 Würfen', () => {
    const state = gameModule.setup(2, {}, 'test');
    expect(state.rollsLeft).toBe(3);
    expect(state.phase).toBe('roll');
  });

  it('würfeln funktioniert', () => {
    let state = gameModule.setup(2, {}, 'seed1');
    const moves = gameModule.legalMoves(state, 0);
    expect(moves.some((m) => m.type === 'roll')).toBe(true);
    const result = gameModule.applyMove(state, 0, { type: 'roll' });
    expect(result.state.dice?.values.length).toBe(5);
    expect(result.state.rollsLeft).toBe(2);
  });

  it('nach Eintragen wechselt der Zug', () => {
    let state = gameModule.setup(2, {}, 'seed2');
    state = gameModule.applyMove(state, 0, { type: 'roll' }).state;
    state = gameModule.applyMove(state, 0, { type: 'score', category: 'chance' }).state;
    expect(state.turn).toBe(1);
    expect(state.rollsLeft).toBe(3);
    expect(state.dice).toBeNull();
  });
});

describe('Vertrag für Spielmodule', () => {
  for (const check of gameContractChecks(gameModule)) {
    it(check.name, check.run);
  }
});
