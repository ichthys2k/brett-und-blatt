import { describe, expect, it, test } from 'vitest';
import { Rng, alphaBetaSearch, mctsSearch } from '../src';
import { gameContractChecks } from '../src/testing';
import { nim } from './nim';

describe('allgemeine Suchverfahren', () => {
  it('MCTS findet in Nim den Gewinnzug', () => {
    for (const left of [5, 6, 7, 9, 10]) {
      const move = mctsSearch(nim, { left, turn: 0, lastTaker: null }, 0, Rng.fromSeed(`mcts${left}`), { iterations: 3_000 });
      expect((left - move.take) % 4).toBe(0);
    }
  });

  it('Alpha-Beta findet in Nim den Gewinnzug', () => {
    for (const left of [5, 6, 7, 9, 10, 15]) {
      const { move } = alphaBetaSearch(nim, { left, turn: 0, lastTaker: null }, 0, { maxDepth: 20, evaluate: () => 0 });
      expect((left - move.take) % 4).toBe(0);
    }
  });
});

describe('Vertrag für Spielmodule (am Testspiel Nim)', () => {
  for (const check of gameContractChecks(nim)) test(check.name, check.run);
});
