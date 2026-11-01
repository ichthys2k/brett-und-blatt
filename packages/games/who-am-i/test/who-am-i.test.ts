import { computeBotMove, resolveOptions, type Options } from '@brett-und-blatt/engine';
import { gameContractChecks } from '@brett-und-blatt/engine/testing';
import { describe, expect, it, test } from 'vitest';
import katalog from '../../../../content/wortspiele/wer-bin-ich.json' with { type: 'json' };
import { candidates, gameModule, parseWhoCatalog, setWhoCatalog, whoCatalog, type WhoState } from '../src';

setWhoCatalog(parseWhoCatalog(katalog));

const start = (options: Options = {}, seats = 3, seed = 'wer') => gameModule.setup(seats, resolveOptions(gameModule, options), seed);
const apply = (state: WhoState, seat: number, move: Parameters<typeof gameModule.applyMove>[2]) => gameModule.applyMove(state, seat, move).state;

describe('Begriffe', () => {
  it('jeder Begriff lässt sich durch Fragen von allen anderen unterscheiden', () => {
    expect(whoCatalog().status).toBe('freigegeben');
    for (const pack of whoCatalog().packs) {
      const seen = new Map<string, string>();
      for (const term of pack.terms) {
        const key = [...term.yes].sort().join(',');
        expect(seen.get(key), `${pack.id}: ${term.id} gleicht ${seen.get(key)}`).toBeUndefined();
        seen.set(key, term.id);
      }
      expect(new Set(pack.terms.map((t) => t.id)).size).toBe(pack.terms.length);
    }
  });
});

describe('Regeln', () => {
  it('verbirgt nur den eigenen Begriff, beantwortet Katalogfragen selbst und lässt bei Ja weiterfragen', () => {
    let state = start({ pack: 'tiere' });
    const seat = state.turn;
    const view = gameModule.playerView(state, seat);
    expect(view.terms[seat]).toBeNull();
    expect(view.terms.filter((t) => t !== null)).toHaveLength(2);
    const pack = whoCatalog().packs.find((p) => p.id === 'tiere')!;
    const own = pack.terms.find((t) => t.id === state.terms[seat])!;
    const yesQuestion = own.yes[0]!;
    state = apply(state, seat, { type: 'ask', question: yesQuestion });
    expect(state.turn).toBe(seat);
    expect(state.history[seat]!.at(-1)).toEqual({ kind: 'ask', question: yesQuestion, answer: 0 });
    const noQuestion = pack.questions.find((q) => !own.yes.includes(q.id))!.id;
    state = apply(state, seat, { type: 'ask', question: noQuestion });
    expect(state.turn).not.toBe(seat);
    expect(state.turnsTaken[seat]).toBe(1);
  });

  it('richtig geraten bringt Punkte und deckt den Begriff auf', () => {
    let state = start({ pack: 'bibel', turns: '8' });
    const seat = state.turn;
    state = apply(state, seat, { type: 'guess', term: state.terms[seat]! });
    expect(state.solved[seat]).toBe(true);
    expect(state.scores[seat]).toBe(8);
    expect(gameModule.playerView(state, seat).terms[seat]).toBe(state.terms[seat]);
  });

  it('freier Modus: die anderen stimmen geheim ab, Raten per Eingabe mit Tippfehler', () => {
    let state = start({ pack: 'tiere', mode: 'free' }, 4, 'frei');
    const asker = state.turn;
    state = apply(state, asker, { type: 'askAloud' });
    expect(state.phase).toBe('answer');
    const voters = [0, 1, 2, 3].filter((s) => s !== asker);
    state = apply(state, voters[0]!, { type: 'answer', value: 0 });
    expect(gameModule.playerView(state, voters[1]!).pending!.vote.ballots[voters[0]!]).toEqual([null]);
    state = apply(state, voters[1]!, { type: 'answer', value: 0 });
    state = apply(state, voters[2]!, { type: 'answer', value: 1 });
    expect(state.history[asker]!.at(-1)).toEqual({ kind: 'ask', question: null, answer: 0 });
    expect(state.turn).toBe(asker);
    const name = whoCatalog().packs[0]!.terms.find((t) => t.id === state.terms[asker])!.name;
    const typo = name.length >= 5 ? `${name}x` : name.toLowerCase();
    state = apply(state, asker, { type: 'guessText', text: typo });
    expect(state.solved[asker]).toBe(true);
    // Ein falscher Rateversuch wird ohne Text gespeichert.
    const next = state.turn;
    state = apply(state, next, { type: 'guessText', text: 'Quatsch' });
    expect(state.history[next]!.at(-1)).toEqual({ kind: 'guess', term: null, correct: false });
  });

  it('der schwere Bot findet seinen Begriff zuverlässig', () => {
    let solved = 0;
    for (let g = 0; g < 10; g++) {
      let state = start({ pack: 'tiere', turns: '12' }, 3, `bot-${g}`);
      for (let step = 0; !gameModule.result(state) && step < 500; step++) {
        const seat = gameModule.currentPlayers(state)[0] as number;
        const move = computeBotMove(gameModule, { gameId: 'who-am-i', botId: 'spuernase', level: 'hard', seat, view: gameModule.playerView(state, seat), seed: `${g}/${step}`, timeBudgetMs: 10 });
        state = apply(state, seat, move as never);
      }
      solved += state.solved.filter(Boolean).length;
      expect(candidates(gameModule.playerView(state, 0), 0).length).toBeGreaterThanOrEqual(0);
    }
    expect(solved).toBe(30);
  });
});

describe('Vertrag', () => {
  for (const check of gameContractChecks(gameModule, { randomGames: 16 })) test(check.name, check.run);
});
