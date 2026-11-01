import { cleanEntry, resolveOptions, type Options } from '@brett-und-blatt/engine';
import { gameContractChecks } from '@brett-und-blatt/engine/testing';
import { describe, expect, it, test } from 'vitest';
import katalog from '../../../../content/wortspiele/kategorien.json' with { type: 'json' };
import { classify, gameModule, parseSprintCatalog, setSprintCatalog, sprintCatalog, type SprintState } from '../src';

setSprintCatalog(parseSprintCatalog(katalog));

const start = (options: Options = {}, seats = 3, seed = 'sprint') => gameModule.setup(seats, resolveOptions(gameModule, options), seed);
const apply = (state: SprintState, seat: number, move: Parameters<typeof gameModule.applyMove>[2]) => gameModule.applyMove(state, seat, move).state;

describe('Wortlisten', () => {
  it('sind gültig, ohne Doppelte und haben je Kategorie genug Wörter', () => {
    const c = sprintCatalog();
    expect(c.status).toBe('freigegeben');
    for (const category of c.categories) {
      expect(category.words.length, category.id).toBeGreaterThanOrEqual(20);
      const keys = category.words.map((w) => w.toLowerCase());
      expect(new Set(keys).size, `${category.id}: doppelte Wörter`).toBe(keys.length);
      // Jedes Listenwort muss sich auch eintippen lassen (Filter, Länge).
      expect(category.words.filter((w) => cleanEntry(w) !== w), category.id).toEqual([]);
    }
    for (const pack of c.packs) expect(c.categories.some((cat) => cat.pack === pack.id)).toBe(true);
  });
});

describe('Regeln', () => {
  it('stuft Antworten ein: leer, falscher Buchstabe, Liste (mit Tippfehler), Zweifelsfall', () => {
    expect(classify('', 'tier', 'E', 'vote')).toBe('empty');
    expect(classify('Hund', 'tier', 'E', 'vote')).toBe('wrongLetter');
    expect(classify('Elefannt', 'tier', 'E', 'vote')).toBe('known');
    expect(classify('Ärmelhörnchen', 'tier', 'A', 'vote')).toBe('disputed');
    expect(classify('Ärmelhörnchen', 'tier', 'A', 'list')).toBe('unknown');
    expect(classify('Ärmelhörnchen', 'tier', 'A', 'trust')).toBe('trusted');
  });

  it('verbirgt fremde Antworten und künftige Buchstaben, Stopp beendet die Runde für alle', () => {
    let state = start({ pack: 'classic', count: '3', rounds: '3' });
    expect(state.categoryIds).toEqual(['stadt', 'land', 'fluss']);
    const letter = state.letters[0]!;
    const words = state.categoryIds.map((id) => sprintCatalog().categories.find((c) => c.id === id)!.words.find((w) => w.toUpperCase().startsWith(letter)) ?? `${letter}xyz`);
    words.forEach((text, category) => {
      state = apply(state, 0, { type: 'answer', category, text });
    });
    state = apply(state, 1, { type: 'answer', category: 0, text: words[0]! });
    const view = gameModule.playerView(state, 1);
    expect(view.answers[0]).toEqual(['', '', '']);
    expect(view.filled[0]).toBe(3);
    expect(view.letters).toEqual([letter]);
    expect(() => apply(state, 0, { type: 'answer', category: 1, text: 'Arsch' })).toThrow();
    state = apply(state, 0, { type: 'finish' });
    expect(state.phase).toBe('review');
    expect(state.stoppedBy).toBe(0);
    // Jetzt liegen alle Antworten offen.
    expect(gameModule.playerView(state, 1).answers[0]).toEqual(words);
  });

  it('wertet Zweifelsfälle per Abstimmung und vergibt 20/10/5 Punkte', () => {
    let state = start({ pack: 'classic', count: '3', rounds: '3', stop: 'all' }, 3, 'punkte');
    const letter = state.letters[0]!;
    const stadt = sprintCatalog().categories.find((c) => c.id === 'stadt')!.words.filter((w) => w.toUpperCase().startsWith(letter));
    // Stadt: 0 und 1 gleich (je 5), 2 anders (10). Land: nur 0 (20). Fluss: 1 erfindet etwas.
    state = apply(state, 0, { type: 'answer', category: 0, text: stadt[0]! });
    state = apply(state, 1, { type: 'answer', category: 0, text: stadt[0]!.toLowerCase() });
    state = apply(state, 2, { type: 'answer', category: 0, text: stadt[1]! });
    const land = sprintCatalog().categories.find((c) => c.id === 'land')!.words.find((w) => w.toUpperCase().startsWith(letter))!;
    state = apply(state, 0, { type: 'answer', category: 1, text: land });
    state = apply(state, 1, { type: 'answer', category: 2, text: `${letter}uppelbach` });
    for (const seat of [0, 1, 2]) state = apply(state, seat, { type: 'finish' });
    expect(state.phase).toBe('review');
    expect(state.disputed).toEqual([{ seat: 1, category: 2 }]);
    // Die Stimmen bleiben geheim, bis alle abgegeben haben.
    state = apply(state, 0, { type: 'review', verdicts: [0] });
    expect(gameModule.playerView(state, 2).vote!.ballots[0]).toEqual([null]);
    state = apply(state, 1, { type: 'review', verdicts: [1] }); // eigene Stimme zählt nicht
    state = apply(state, 2, { type: 'review', verdicts: [0] });
    expect(state.round).toBe(1);
    const last = state.lastRound!;
    expect(last.answers[0]!.map((a) => a.points)).toEqual([5, 20, 0]);
    expect(last.answers[1]!.map((a) => a.points)).toEqual([5, 0, 0]);
    expect(last.answers[1]![2]!.status).toBe('rejected');
    expect(last.answers[2]!.map((a) => a.points)).toEqual([10, 0, 0]);
    expect(state.scores).toEqual([25, 5, 10]);
  });

  it('allein zählt beim Abstimmen nur die Liste – niemand winkt sich selbst durch', () => {
    let state = start({ pack: 'classic', count: '3', rounds: '3' }, 1, 'allein');
    const letter = state.letters[0]!;
    state = apply(state, 0, { type: 'answer', category: 0, text: `${letter}uppelbach` });
    state = apply(state, 0, { type: 'finish' });
    expect(state.disputed).toEqual([]);
    expect(state.status[0]![0]).toBe('unknown');
  });
});

describe('Vertrag', () => {
  for (const check of gameContractChecks(gameModule, { seatCounts: [1, 3], randomGames: 16 })) test(check.name, check.run);
});

