import { computeBotMove, forbiddenWordIn, resolveOptions, sameWord, type Options } from '@brett-und-blatt/engine';
import { gameContractChecks } from '@brett-und-blatt/engine/testing';
import { describe, expect, it, test } from 'vitest';
import katalog from '../../../../content/wortspiele/begriffe.json' with { type: 'json' };
import { blockers, clueProblem, duelCatalog, gameModule, guessers, parseDuelCatalog, setDuelCatalog, termOf, type DuelMove, type DuelState } from '../src';

setDuelCatalog(parseDuelCatalog(katalog));

const start = (options: Options = {}, seats = 4, seed = 'duell') => gameModule.setup(seats, resolveOptions(gameModule, options), seed);
const apply = (state: DuelState, seat: number, move: DuelMove) => gameModule.applyMove(state, seat, move).state;

describe('Begriffe', () => {
  it('Umschreibungen des Bots verraten den Begriff nicht', () => {
    expect(duelCatalog().status).toBe('freigegeben');
    for (const pack of duelCatalog().packs) {
      for (const term of pack.terms) {
        expect(term.hints.length, term.name).toBeGreaterThanOrEqual(5);
        for (const clue of term.clues) expect(forbiddenWordIn(clue, [term.name, ...(term.aliases ?? [])]), `${term.name}: ${clue}`).toBeNull();
        expect(term.hints.some((h) => sameWord(h, term.name)), term.name).toBe(false);
      }
    }
  });
});

describe('Regeln', () => {
  it('Teams aus der Lobby, Sperrwörter vom anderen Team, geheim für die Ratenden', () => {
    let state = start({ teams: '0,0,1,1' }, 4, 'teams');
    expect(state.teams).toEqual([0, 0, 1, 1]);
    const explainer = state.explainer;
    const [b1, b2] = blockers(state);
    const [guesser] = guessers(state);
    // Ratende sehen weder Begriff noch Vorschläge.
    expect(gameModule.playerView(state, guesser!).term).toBeNull();
    expect(gameModule.playerView(state, 'spectator').term).toBeNull();
    expect(gameModule.playerView(state, explainer).term).toBe(state.term);
    const term = termOf(state, state.term)!;
    expect(() => apply(state, b1!, { type: 'block', words: [term.name] })).toThrow();
    state = apply(state, b1!, { type: 'block', words: ['Apfel', 'Birne'] });
    expect(gameModule.playerView(state, b2!).proposals[b1!]).toEqual([]);
    state = apply(state, b2!, { type: 'block', words: ['Birne', 'Kirsche', 'Pflaume'] });
    expect(state.phase).toBe('explain');
    expect(state.blocked).toEqual(['Birne', 'Apfel', 'Kirsche']);
    expect(gameModule.playerView(state, guesser!).blocked).toEqual([]);
    // Gesperrte Wörter (auch gebeugt) und der Begriff selbst gehen nicht durch.
    expect(clueProblem(state, 'viele Äpfel')).toContain('Apfel');
    expect(clueProblem(state, `fast wie ${term.name}`)).toContain(term.name);
    expect(() => apply(state, explainer, { type: 'clue', text: 'eine Birne' })).toThrow();
    expect(gameModule.currentPlayers(state)).toEqual([explainer]);
    state = apply(state, explainer, { type: 'clue', text: 'Erster Hinweis' });
    expect(gameModule.currentPlayers(state)).toEqual([explainer, guesser]);
    state = apply(state, guesser!, { type: 'guess', text: 'Irgendwas' });
    state = apply(state, guesser!, { type: 'guess', text: term.name.toLowerCase() });
    expect(state.scores[0]).toBe(3);
    expect(state.lastTurn).toMatchObject({ outcome: 'guessed', points: 3, guessedBy: guesser });
    expect(state.team).toBe(1);
    expect(state.phase).toBe('block');
  });

  it('Sprech-Modus: „Gesagt!“ geht außer der Reihe an das andere Team', () => {
    let state = start({ mode: 'speak' }, 4, 'sprechen');
    for (const seat of blockers(state)) state = apply(state, seat, { type: 'block', words: [] });
    const other = blockers(state)[0]!;
    expect(gameModule.currentPlayers(state)).toEqual([state.explainer]);
    expect(gameModule.isLegal!(state, other, { type: 'buzz' })).toBe(true);
    const team = state.team;
    state = apply(state, other, { type: 'buzz' });
    expect(state.scores[1 - team]).toBe(1);
  });

  it('Bots spielen im Schreib-Modus ganze Partien und erraten Begriffe', () => {
    let state = start({ turns: '8' }, 4, 'bots');
    for (let step = 0; !gameModule.result(state) && step < 2000; step++) {
      const seat = gameModule.currentPlayers(state).at(-1) as number;
      const move = computeBotMove(gameModule, { gameId: 'describe-duel', botId: 'wortakrobat-duell', level: 'hard', seat, view: gameModule.playerView(state, seat), seed: `${step}`, timeBudgetMs: 10 });
      state = apply(state, seat, move as DuelMove);
    }
    expect(gameModule.result(state)).not.toBeNull();
    expect(state.scores[0]! + state.scores[1]!).toBeGreaterThanOrEqual(8);
  });
});

describe('Vertrag', () => {
  for (const check of gameContractChecks(gameModule, { seatCounts: [4, 7], randomGames: 16 })) test(check.name, check.run);
});
