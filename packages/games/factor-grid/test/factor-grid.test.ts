import { resolveOptions, type Options } from '@brett-und-blatt/engine';
import { gameContractChecks } from '@brett-und-blatt/engine/testing';
import { describe, expect, it, test } from 'vitest';
import { freeChainNeighbors, freeProperDivisors, gameModule } from '../src';

const start = (options: Options = {}, seats = 2, seed = 'test') =>
  gameModule.setup(seats, resolveOptions(gameModule, options), seed);

describe('Teiler-Duell – Regeln', () => {
  it('berechnet freie echte Teiler im Steuereintreiber-Modus korrekt', () => {
    const s = start({ variant: 'taxman', gridSize: '20' }, 1);
    expect(freeProperDivisors(19, s.owners)).toEqual([1]);
    expect(freeProperDivisors(18, s.owners)).toEqual([1, 2, 3, 6, 9]);
    // 1 hat keinen echten Teiler und darf daher nicht direkt gewählt werden
    expect(gameModule.isLegal!(s, 0, { type: 'pick', number: 1 })).toBe(false);
    expect(gameModule.isLegal!(s, 0, { type: 'pick', number: 19 })).toBe(true);

    // Nach Wahl von 19 gehört 19 Spieler 0 und 1 dem Steuereintreiber (1)
    const after19 = gameModule.applyMove(s, 0, { type: 'pick', number: 19 }).state;
    expect(after19.scores).toEqual([19, 1]);
    expect(after19.owners[18]).toBe(0);
    expect(after19.owners[0]).toBe(1);
    // Nun hat keine andere ungerade Primzahl (z. B. 17) mehr einen freien Teiler!
    expect(gameModule.isLegal!(after19, 0, { type: 'pick', number: 17 })).toBe(false);
  });

  it('erzwingt im Kettenmodus eine gerade Startzahl und danach Teiler oder Vielfache', () => {
    const s = start({ variant: 'chain', gridSize: '20' }, 2);
    expect(gameModule.isLegal!(s, 0, { type: 'pick', number: 7 })).toBe(false);
    expect(gameModule.isLegal!(s, 0, { type: 'pick', number: 12 })).toBe(true);

    const after12 = gameModule.applyMove(s, 0, { type: 'pick', number: 12 }).state;
    expect(after12.turn).toBe(1);
    expect(freeChainNeighbors(12, after12.size, after12.owners)).toEqual([1, 2, 3, 4, 6]);
    expect(gameModule.isLegal!(after12, 1, { type: 'pick', number: 6 })).toBe(true);
    expect(gameModule.isLegal!(after12, 1, { type: 'pick', number: 5 })).toBe(false);
  });
});

describe('Teiler-Duell – Vertrag', () => {
  for (const check of gameContractChecks(gameModule, { seatCounts: [1, 2], randomGames: 16 })) {
    test(check.name, check.run, 60_000);
  }
});
