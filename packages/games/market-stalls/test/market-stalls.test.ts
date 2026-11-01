import { gameContractChecks } from '@brett-und-blatt/engine/testing';
import { describe, expect, it, test } from 'vitest';
import {
  HIDDEN,
  bestWareStars,
  buildDeck,
  fits,
  gameModule,
  handSize,
  legalMoves,
  placeCard,
  scores,
  standOptions,
  starsOf,
  tally,
  wareOf,
  type MarketStallsState,
} from '../src';

/** Karten einer Ware, aufsteigend. */
const ofWare = (ware: number) => buildDeck().filter((card) => wareOf(card) === ware);
/** So viele Karten einer Ware mit der gewünschten Sternzahl. */
const withStars = (ware: number, stars: number, count: number) => ofWare(ware).filter((card) => starsOf(card) === stars).slice(0, count);

describe('Marktstände – Regeln', () => {
  it('hat 60 Karten, je Ware 15 mit gleich vielen Sternen', () => {
    expect(buildDeck()).toHaveLength(60);
    for (const ware of [0, 1, 2, 3]) {
      expect(ofWare(ware)).toHaveLength(15);
      for (const stars of [0, 1, 2]) expect(ofWare(ware).filter((card) => starsOf(card) === stars)).toHaveLength(5);
    }
  });

  it('teilt je Tischgröße aus, ohne dass Karten fehlen', () => {
    for (const [seats, size] of [[2, 10], [5, 10], [6, 9], [8, 7], [10, 5]] as const) {
      const state = gameModule.setup(seats, {}, `deal-${seats}`);
      expect(handSize(seats)).toBe(size);
      expect(state.hands.every((hand) => hand.length === size)).toBe(true);
      const all = [...state.hands.flat(), ...state.stands.flat(), ...state.stock];
      expect(new Set(all).size).toBe(60);
    }
  });

  it('erlaubt leere Stände, kleinere oberste Karten und dieselbe Ware', () => {
    const low = ofWare(0)[0]!;
    const high = ofWare(0)[14]!;
    const otherHigh = ofWare(1).find((card) => card > low)!;
    expect(fits([], low)).toBe(true);
    expect(fits([low], otherHigh)).toBe(true);
    expect(fits([high], low)).toBe(true);
    const foreignLow = ofWare(1).find((card) => card < high)!;
    expect(fits([high], foreignLow)).toBe(false);
  });

  it('die fünfte Karte nimmt alle fünf und leert den Stand', () => {
    const pile = ofWare(0).slice(0, 4);
    const card = ofWare(0)[4]!;
    const placed = placeCard([pile, [], [], []], 0, card);
    expect(placed.taken).toEqual([...pile, card]);
    expect(placed.stands[0]).toEqual([]);
  });

  it('passt die Karte nirgends, wird ein Stand genommen und die Karte eröffnet ihn', () => {
    const card = 1;
    const foreign = buildDeck().filter((c) => wareOf(c) !== wareOf(card) && c > card);
    const stands = [[foreign[0]!], [foreign[1]!], [foreign[2]!], [foreign[3]!]];
    expect(standOptions(stands, card)).toEqual([0, 1, 2, 3]);
    const placed = placeCard(stands, 2, card);
    expect(placed.forced).toBe(true);
    expect(placed.taken).toEqual([foreign[2]]);
    expect(placed.stands[2]).toEqual([card]);
  });

  it('nur die stärkste Ware zählt plus, und nur mit den meisten Karten', () => {
    const star = withStars(0, 2, 3);
    const side = withStars(1, 2, 1);
    expect(scores([[...star, ...side], []])).toEqual([star.length * 2 - 2, 0]);
    // Platz 1 hat bei Käse mehr Karten, Platz 0 zählt dort also ohnehin minus.
    const rival = withStars(0, 2, 4);
    const [first, second] = tally([star, rival]);
    expect(first![0]!.leads).toBe(false);
    expect(first![0]!.points).toBe(-6);
    expect(second![0]!.points).toBe(8);
  });

  it('Gleichstand an der Spitze zählt für alle plus', () => {
    const cards = withStars(2, 2, 2);
    expect(scores([cards, cards])).toEqual([4, 4]);
  });

  it('bei gleichen Punkten entscheiden die Sterne der stärksten Ware', () => {
    const state = gameModule.setup(2, { days: '1' }, 'gleich');
    const a = [...withStars(0, 2, 4), ...withStars(1, 2, 2)];
    const b = [...withStars(2, 1, 4)];
    expect(scores([a, b])).toEqual([4, 4]);
    expect(bestWareStars([a, b])).toEqual([8, 4]);
    expect(gameModule.result({ ...state, phase: 'over', pantries: [a, b] })).toEqual({ kind: 'win', winners: [0] });
  });

  it('wer gewählt hat, ist fertig; aufgedeckt wird, wenn alle gewählt haben', () => {
    let state = gameModule.setup(3, {}, 'wahl');
    state = gameModule.applyMove(state, 0, { type: 'choose', card: state.hands[0]![0]! }).state;
    expect(legalMoves(state, 0)).toEqual([]);
    expect(gameModule.currentPlayers(state)).toEqual([1, 2]);
    expect(gameModule.playerView(state, 1).chosen[0]).toBe(HIDDEN);
    state = gameModule.applyMove(state, 1, { type: 'choose', card: state.hands[1]![0]! }).state;
    const { state: next, events } = gameModule.applyMove(state, 2, { type: 'choose', card: state.hands[2]![0]! });
    expect(events.some((event) => event.type === 'revealed')).toBe(true);
    expect(next.chosen).toEqual([null, null, null]);
  });

  it('der neue Markttag bringt alle Karten neu, die Kammern bleiben', () => {
    let state: MarketStallsState = gameModule.setup(2, {}, 'tage');
    let guard = 0;
    while (state.day === 1 && guard++ < 200) {
      const seat = gameModule.currentPlayers(state)[0] as number;
      state = gameModule.applyMove(state, seat, legalMoves(state, seat)[0]!).state;
    }
    expect(state.day).toBe(2);
    expect(state.hands.every((hand) => hand.length === 10)).toBe(true);
    expect(new Set([...state.hands.flat(), ...state.stands.flat(), ...state.stock]).size).toBe(60);
    expect(state.pantries.flat().length).toBeGreaterThan(0);
  });
});

describe('Marktstände – Plattform-Vertragstests', () => {
  for (const check of gameContractChecks(gameModule)) {
    test(check.name, check.run, 60_000);
  }
});
