import { computeBotMove, resolveOptions, Rng, type Options } from '@brett-und-blatt/engine';
import { gameContractChecks } from '@brett-und-blatt/engine/testing';
import { describe, expect, it, test } from 'vitest';
import { detectHand, gameModule, handLabel, scoreHand, type Card, type RunState, type SorterMove, type SorterState } from '../src';

function start(seats = 1, options: Options = {}, seed = 'test'): SorterState {
  return gameModule.setup(seats, resolveOptions(gameModule, options), seed);
}

const c = (rank: number, color: Card['color'], extra: Partial<Card> = {}): Card => ({ id: rank * 10 + 'rybg'.indexOf(color), rank, color, ...extra });

function play(state: SorterState, seat: number, move: SorterMove): SorterState {
  return gameModule.applyMove(state, seat, move).state;
}

/** Ein Lauf mit eigener Hand – für Wertungstests. */
function runWith(state: SorterState, change: Partial<RunState>): RunState {
  return { ...state.runs[0]!, ...change };
}

describe('Kombis', () => {
  it('erkennt alle Kombis', () => {
    expect(detectHand([c(5, 'r')]).type).toBe('high');
    expect(detectHand([c(5, 'r'), c(5, 'b')]).type).toBe('pair');
    expect(detectHand([c(5, 'r'), c(5, 'b'), c(7, 'g'), c(7, 'y')]).type).toBe('twoPair');
    expect(detectHand([c(5, 'r'), c(5, 'b'), c(5, 'g')]).type).toBe('three');
    expect(detectHand([c(1, 'r'), c(2, 'b'), c(3, 'g'), c(4, 'y'), c(5, 'r')]).type).toBe('straight');
    expect(detectHand([c(1, 'r'), c(3, 'r'), c(6, 'r'), c(8, 'r'), c(12, 'r')]).type).toBe('flush');
    expect(detectHand([c(5, 'r'), c(5, 'b'), c(5, 'g'), c(8, 'y'), c(8, 'r')]).type).toBe('fullHouse');
    expect(detectHand([c(5, 'r'), c(5, 'b'), c(5, 'g'), c(5, 'y')]).type).toBe('four');
    expect(detectHand([c(4, 'g'), c(5, 'g'), c(6, 'g'), c(7, 'g'), c(8, 'g')]).type).toBe('straightFlush');
    expect(detectHand([c(5, 'r'), c(5, 'b'), c(5, 'g'), c(5, 'y'), c(5, 'r', { id: 99 })]).type).toBe('five');
    expect(detectHand([c(5, 'r'), c(5, 'r', { id: 1 }), c(5, 'r', { id: 2 }), c(8, 'r'), c(8, 'r', { id: 3 })]).type).toBe('flushHouse');
  });

  it('Santa ist der höchste Rang: 9 bis Santa in einer Farbe ist FarbenLauf Deluxe', () => {
    const cards = [c(9, 'b'), c(10, 'b'), c(11, 'b'), c(12, 'b'), c(13, 'b')];
    const { type } = detectHand(cards);
    expect(type).toBe('straightFlush');
    expect(handLabel(type, cards)).toBe('FarbenLauf Deluxe');
    // Kein Herumlaufen: Junge, Santa, 1, 2, 3 ist kein Lauf.
    expect(detectHand([c(12, 'r'), c(13, 'b'), c(1, 'g'), c(2, 'y'), c(3, 'r')]).type).toBe('high');
  });

  it('wertet nur die Karten der Kombi, Granit immer', () => {
    const played = [c(5, 'r'), c(5, 'b'), c(9, 'g'), c(2, 'y', { enh: 'granite' })];
    expect(detectHand(played).scoring).toEqual([0, 1, 3]);
    expect(detectHand([c(3, 'r'), c(9, 'b')]).scoring).toEqual([1]);
  });

  it('Ombré zählt als jede Farbe', () => {
    expect(detectHand([c(1, 'r'), c(3, 'r'), c(6, 'b', { enh: 'ombre' }), c(8, 'r'), c(12, 'r')]).type).toBe('flush');
  });
});

describe('Wertung', () => {
  const state = start();
  const rng = () => new Rng([1, 2, 3, 4]);

  it('Chips × Mult: Duo aus zwei 5ern ist (10 + 5 + 5) × 2', () => {
    const result = scoreHand(runWith(state, {}), [c(5, 'r'), c(5, 'b')], [], rng());
    expect(result.score).toBe(40);
  });

  it('Bildkarten zählen 10, Santa 11', () => {
    expect(scoreHand(runWith(state, {}), [c(13, 'r')], [], rng()).score).toBe((5 + 11) * 1);
    expect(scoreHand(runWith(state, {}), [c(11, 'r')], [], rng()).score).toBe((5 + 10) * 1);
  });

  it('Veredelungen, Folien und Abzeichen', () => {
    const run = runWith(state, {});
    expect(scoreHand(run, [c(5, 'r', { enh: 'volume' })], [], rng()).score).toBe(5 + 5 + 30);
    expect(scoreHand(run, [c(5, 'r', { enh: 'gloss' })], [], rng()).score).toBe((5 + 5) * 5);
    expect(scoreHand(run, [c(5, 'r', { foil: 'iris' })], [], rng()).score).toBe(15);
    expect(scoreHand(run, [c(5, 'r', { seal: 'red' })], [], rng()).score).toBe(5 + 5 + 5);
    expect(scoreHand(run, [c(5, 'r')], [c(9, 'b', { enh: 'keratin' })], rng()).score).toBe(15);
  });

  it('Mods wirken von links nach rechts: erst +Mult, dann ×Mult ist mehr', () => {
    const pair = [c(5, 'r'), c(5, 'b')];
    const plusThenTimes = runWith(state, {
      mods: [
        { uid: 1, key: 'jolly' },
        { uid: 2, key: 'twins' },
      ],
    });
    const timesThenPlus = runWith(state, {
      mods: [
        { uid: 2, key: 'twins' },
        { uid: 1, key: 'jolly' },
      ],
    });
    expect(scoreHand(plusThenTimes, pair, [], rng()).score).toBe(20 * (2 + 8) * 2);
    expect(scoreHand(timesThenPlus, pair, [], rng()).score).toBe(20 * (2 * 2 + 8));
  });

  it('Farb-Mods zählen gewertete Karten der Farbe', () => {
    const run = runWith(state, { mods: [{ uid: 1, key: 'inLove' }] });
    expect(scoreHand(run, [c(5, 'r'), c(5, 'b')], [], rng()).score).toBe(20 * (2 + 3));
  });

  it('Boss-Farbe zählt nicht', () => {
    const run = runWith(state, {
      current: {
        target: 1,
        score: 0,
        handsLeft: 1,
        discardsLeft: 0,
        boss: 'minotaur',
        duel: false,
        playedTypes: [],
        firstDone: false,
        silenced: false,
        faceDown: [],
      },
    });
    expect(scoreHand(run, [c(5, 'r'), c(5, 'b')], [], rng()).score).toBe((10 + 5) * 2);
  });
});

describe('Ablauf', () => {
  it('Solo beginnt mit 4 T, 8 Karten, 4 Händen, 3-mal Verwerfen', () => {
    let state = start();
    expect(state.mode).toBe('solo');
    expect(state.runs[0]!.tokens).toBe(4);
    state = play(state, 0, { type: 'start' });
    const run = state.runs[0]!;
    expect(run.hand).toHaveLength(8);
    expect(run.current).toMatchObject({
      target: 300,
      handsLeft: 4,
      discardsLeft: 3,
    });
  });

  it('Überspringen gibt einen Sticker, den Boss kann man nicht überspringen', () => {
    let state = start();
    state = play(state, 0, { type: 'skip' });
    state = play(state, 0, state.runs[0]!.phase === 'pack' ? { type: 'skipPack' } : { type: 'skip' });
    if (state.runs[0]!.phase === 'pack') state = play(state, 0, { type: 'skipPack' });
    expect(state.runs[0]!.round).toBe(2);
    expect(gameModule.legalMoves(state, 0).some((m) => m.type === 'skip')).toBe(false);
  });

  it('gleicher Seed: Alle Plätze ziehen dieselben Karten', () => {
    let state = start(3);
    for (const seat of [0, 1, 2]) state = play(state, seat, { type: 'start' });
    const hands = state.runs.map((r) => r.hand.map((card) => `${card.rank}${card.color}`).join());
    expect(new Set(hands).size).toBe(1);
  });

  it('die Sicht verrät weder Stapelreihenfolge noch fremde Hände', () => {
    let state = start(2);
    state = play(state, 0, { type: 'start' });
    const view = gameModule.playerView(state, 1);
    expect(view.runs[0]!.hand.every((card) => 'hidden' in card)).toBe(true);
    expect(view.runs[0]!.pile).toEqual([]);
    const own = gameModule.playerView(state, 0).runs[0]!;
    expect(own.pileCount).toBe(44);
    expect(own.rng.deal).toEqual([0, 0, 0, 0]);
    const ranks = own.pile.map((card) => card.rank + 100 * 'rybg'.indexOf(card.color));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });

  it('Duell: Wer weniger Punkte holt, verliert ein Leben', () => {
    let state = start(2, { mode: 'duel', lives: '4' });
    // Beide spielen bis zum Treffpunkt in Level 2 mit dem Bot.
    for (let step = 0; step < 400 && !state.duel && !state.lastDuel; step++) {
      for (const seat of gameModule.currentPlayers(state) as number[]) {
        const move = computeBotMove(gameModule, {
          gameId: 'color-sorter',
          botId: 'color-sorter',
          level: seat === 0 ? 'hard' : 'medium',
          seat,
          view: gameModule.playerView(state, seat),
          seed: `d/${step}/${seat}`,
          timeBudgetMs: 10,
        }) as SorterMove;
        state = play(state, seat, move);
        if (state.duel || state.lastDuel) break;
      }
    }
    expect(state.duel).not.toBeNull();
    expect(state.runs.every((r) => r.phase === 'play' && r.current?.duel)).toBe(true);
    for (let step = 0; step < 100 && !state.lastDuel; step++) {
      for (const seat of gameModule.currentPlayers(state) as number[]) {
        const move = computeBotMove(gameModule, {
          gameId: 'color-sorter',
          botId: 'color-sorter',
          level: seat === 0 ? 'hard' : 'medium',
          seat,
          view: gameModule.playerView(state, seat),
          seed: `e/${step}/${seat}`,
          timeBudgetMs: 10,
        }) as SorterMove;
        state = play(state, seat, move);
      }
    }
    const duel = state.lastDuel!;
    expect(duel.level).toBe(2);
    const [a, b] = duel.scores as number[];
    if (a !== b) expect(duel.losers).toEqual([a! < b! ? 0 : 1]);
  });
});

describe('Bot', () => {
  it('der schwere Bot schafft meist mehr Level als der leichte', () => {
    const levels = (level: 'easy' | 'hard') => {
      let total = 0;
      for (let g = 0; g < 6; g++) {
        let state = start(1, {}, `bot/${g}`);
        for (let step = 0; step < 1500 && !gameModule.result(state); step++) {
          const move = computeBotMove(gameModule, {
            gameId: 'color-sorter',
            botId: 'color-sorter',
            level,
            seat: 0,
            view: gameModule.playerView(state, 0),
            seed: `${g}/${step}`,
            timeBudgetMs: 10,
          }) as SorterMove;
          state = play(state, 0, move);
        }
        total += state.runs[0]!.level;
      }
      return total;
    };
    expect(levels('hard')).toBeGreaterThan(levels('easy'));
  });
});

describe('Vertrag für Spielmodule', () => {
  for (const check of gameContractChecks(gameModule, {
    randomGames: 24,
    seatCounts: [1, 3],
    maxMoves: 6000,
  }))
    test(check.name, check.run, 120_000);
});
