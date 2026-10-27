import { resolveOptions, type Options } from '@brett-und-blatt/engine';
import { gameContractChecks } from '@brett-und-blatt/engine/testing';
import { describe, expect, it, test } from 'vitest';
import {
  STEM_CATALOG,
  canFormFromStem,
  gameModule,
  getValidSubwords,
  normalizeSaladWord,
  scoreWordLength,
} from '../src';

const start = (options: Options = {}, seats = 2, seed = 'test-salad') =>
  gameModule.setup(seats, resolveOptions(gameModule, options), seed);

describe('Wort-Salat – Regeln, Wortprüfung & Bot', () => {
  it('prüft Buchstaben-Multimengen exakt und liefert für jedes Stammwort reichlich Teilwörter', () => {
    expect(canFormFromStem('SONNE', 'SONNENBLUME', 3)).toBe(true);
    expect(canFormFromStem('BLUME', 'SONNENBLUME', 3)).toBe(true);
    expect(canFormFromStem('SONNENBLUME', 'SONNENBLUME', 3)).toBe(false); // Stammwort selbst zählt nicht
    expect(canFormFromStem('BALLON', 'SONNENBLUME', 3)).toBe(false); // kein A und nur ein L

    for (const cat of ['mix', 'natur', 'mathe'] as const) {
      for (const entry of STEM_CATALOG[cat]) {
        const sub3 = getValidSubwords(entry.display, 3);
        expect(sub3.length).toBeGreaterThanOrEqual(15);
      }
    }
  });

  it('vergibt Punkte nach Wortlänge und verdoppelt Exklusiv-Funde im Modus unique', () => {
    let state = start({ mode: 'unique', category: 'natur', rounds: '1', minLength: '3' }, 2, 'unique-test');
    const valid = getValidSubwords(state.currentStem, 3);
    const wordShared = valid[0]!;
    const wordUnique0 = valid[1]!;

    // Beide finden wordShared, aber nur Platz 0 findet wordUnique0
    state = gameModule.applyMove(state, 0, { type: 'submit', word: wordShared }).state;
    state = gameModule.applyMove(state, 1, { type: 'submit', word: wordShared }).state;
    state = gameModule.applyMove(state, 0, { type: 'submit', word: wordUnique0 }).state;

    // Vor Rundenende sind die Punkte anderer Plätze sichtbar, deren Wortlisten aber verdeckt
    const view1 = gameModule.playerView(state, 1);
    expect(view1.players[0]!.foundWords).toEqual([]);
    expect(view1.players[0]!.foundCount).toBe(2);
    expect(view1.players[1]!.foundWords).toEqual([normalizeSaladWord(wordShared)]);

    // Beide beenden die Runde -> Exklusiv-Bonus wird abgerechnet
    state = gameModule.applyMove(state, 0, { type: 'finishRound' }).state;
    state = gameModule.applyMove(state, 1, { type: 'finishRound' }).state;

    expect(state.done).toBe(true);
    const expectedScore1 = scoreWordLength(wordShared.length);
    const expectedScore0 = expectedScore1 + scoreWordLength(wordUnique0.length) * 2;
    expect(state.players[1]!.score).toBe(expectedScore1);
    expect(state.players[0]!.score).toBe(expectedScore0);
    expect(gameModule.result(state)).toEqual({ kind: 'win', winners: [0] });
  });
});

describe('Wort-Salat – Vertrag', () => {
  for (const check of gameContractChecks(gameModule, { seatCounts: [1, 4], randomGames: 16 })) {
    test(check.name, check.run, 60_000);
  }
});
