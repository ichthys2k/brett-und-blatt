import { resolveOptions, type Options } from '@brett-und-blatt/engine';
import { gameContractChecks } from '@brett-und-blatt/engine/testing';
import { describe, expect, it, test } from 'vitest';
import { formatStoneValue, gameModule, solveWallFromGivens, totalStones } from '../src';

const start = (options: Options = {}, seats = 2, seed = 'test') =>
  gameModule.setup(seats, resolveOptions(gameModule, options), seed);

describe('Rechenmauer – Regeln', () => {
  it('löst jede generierte Rechenmauer eindeutig aus den vorgegebenen Steinen', () => {
    for (const numbers of ['natural', 'integers', 'decimals', 'products'] as const) {
      for (const height of ['3', '4'] as const) {
        const s = start({ numbers, height }, 1, `mauer-${numbers}-${height}`);
        expect(s.givens).toHaveLength(totalStones(s.height));
        const solved = solveWallFromGivens(s.givens, s.height, s.numberMode);
        expect(solved).toEqual(s.solution);
      }
    }
  });

  it('formatiert Dezimalzahlen (in Zehnteln) mit deutschem Komma', () => {
    expect(formatStoneValue(25, 'decimals')).toBe('2,5');
    expect(formatStoneValue(-14, 'decimals')).toBe('−1,4');
    expect(formatStoneValue(12, 'natural')).toBe('12');
  });

  it('vergibt volle Punktzahl (inkl. 4 Bonuspunkte) bei fehlerfreier Mauer', () => {
    const s = start({ height: '3', rounds: '3' }, 1, 'bonus');
    const solved = solveWallFromGivens(s.givens, s.height, s.numberMode);
    const next = gameModule.applyMove(s, 0, { type: 'submit', values: solved }).state;
    // Bei 3 Stufen (6 Steinen) sind 3 vorgegeben und 3 Lücken: 3 * 2 + 4 = 10 Punkte
    expect(next.scores[0]).toBe(10);
    expect(next.round).toBe(2);
  });
});

describe('Rechenmauer – Vertrag', () => {
  for (const check of gameContractChecks(gameModule, { seatCounts: [1, 4], randomGames: 16 })) {
    test(check.name, check.run, 60_000);
  }
});
