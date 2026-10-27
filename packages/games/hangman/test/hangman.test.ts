import { resolveOptions, type Options } from '@brett-und-blatt/engine';
import { gameContractChecks } from '@brett-und-blatt/engine/testing';
import { describe, expect, it, test } from 'vitest';
import {
  ALPHABET,
  WORD_LISTS,
  findMatchingWords,
  gameModule,
  normalizeWord,
} from '../src';

const start = (options: Options = {}, seats = 2, seed = 'test-hangman') =>
  gameModule.setup(seats, resolveOptions(gameModule, options), seed);

describe('Galgenmännchen – Regeln & Bot', () => {
  it('normalisiert Wörter sauber (Großbuchstaben, ß -> SS)', () => {
    expect(normalizeWord('Gießkanne')).toBe('GIESSKANNE');
    expect(normalizeWord('Eichhörnchen')).toBe('EICHHÖRNCHEN');
  });

  it('deckt im Modus Gemeinsam (coop) richtige Buchstaben auf und zählt Fehlversuche bei falschen', () => {
    let state = start({ mode: 'coop', category: 'tiere', maxMistakes: '8', rounds: '3', theme: 'snowman' }, 2, 'coop-1');

    expect(state.currentTurn).toBe(0);
    const word = state.secretWords[0]!;
    const firstChar = word[0]!;

    // Richtiger Buchstabe: Zug wechselt reihum zum nächsten Sitzplatz
    state = gameModule.applyMove(state, 0, { type: 'guess', letter: firstChar }).state;
    expect(state.boards[0]!.guessedLetters).toContain(firstChar);
    expect(state.boards[0]!.mistakes).toBe(0);
    expect(state.boards[0]!.maskedWord.startsWith(firstChar)).toBe(true);
    expect(state.currentTurn).toBe(1);

    // Falscher Buchstabe: Fehlversuch steigt und der nächste Sitzplatz ist am Zug
    const wrongChar = ALPHABET.find((ch) => !word.includes(ch))!;
    state = gameModule.applyMove(state, 1, { type: 'guess', letter: wrongChar }).state;
    expect(state.boards[0]!.mistakes).toBe(1);
    expect(state.currentTurn).toBe(0);
  });

  it('blendet in playerView ungelöste Geheimwörter aus', () => {
    const state = start({ mode: 'race', category: 'alltag', maxMistakes: '8', rounds: '3' }, 2, 'view-1');
    const view0 = gameModule.playerView(state, 0);
    expect(view0.secretWords).toHaveLength(0);
    expect(view0.displayWords).toHaveLength(0);
    expect(view0.boards[0]!.maskedWord).toMatch(/^[ _-]+$/);
  });

  it('spielt im Modus Wettrennen (race) simultan bis zum Ziel', () => {
    let state = start({ mode: 'race', category: 'mathe', maxMistakes: '10', rounds: '3' }, 2, 'race-1');

    // Spieler 0 löst alle 3 Wörter fehlerfrei
    for (let w = 0; w < 3; w++) {
      const secret = state.secretWords[w]!;
      const uniqueChars = [...new Set([...secret])].filter((ch) => ALPHABET.includes(ch as (typeof ALPHABET)[number]));
      for (const ch of uniqueChars) {
        if (state.boards[0]!.roundIndex !== w || state.boards[0]!.done) break;
        state = gameModule.applyMove(state, 0, { type: 'guess', letter: ch }).state;
      }
    }

    expect(state.boards[0]!.wordsWon).toBe(3);
    expect(state.boards[0]!.done).toBe(true);
    expect(gameModule.result(state)).toEqual({ kind: 'win', winners: [0] });
  });

  it('findMatchingWords filtert Kandidaten passend zur Maske', () => {
    const sample = WORD_LISTS.tiere[0]!;
    const norm = normalizeWord(sample);
    const first = norm[0]!;
    const mask = [...norm].map((ch) => (ch === first ? first : '_')).join('');
    const matches = findMatchingWords(mask, [first], 'tiere');
    expect(matches).toContain(norm);
  });
});

describe('Galgenmännchen – Vertrag', () => {
  for (const check of gameContractChecks(gameModule, { seatCounts: [1, 4], randomGames: 16 })) {
    test(check.name, check.run, 60_000);
  }
});
