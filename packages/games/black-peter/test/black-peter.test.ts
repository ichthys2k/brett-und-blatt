import { resolveOptions, type Options } from '@brett-und-blatt/engine';
import { gameContractChecks } from '@brett-und-blatt/engine/testing';
import { describe, expect, it, test } from 'vitest';
import { gameModule, PETER, sourceOf, type BlackPeterState, type Card } from '../src';

function start(seats = 3, options: Options = {}, seed = 'test'): BlackPeterState {
  return gameModule.setup(seats, resolveOptions(gameModule, options), seed);
}

const hasPair = (hand: (Card | null)[]) => {
  const seen = new Set<number>();
  for (const card of hand) {
    if (!card || card.pair === PETER) continue;
    if (seen.has(card.pair)) return true;
    seen.add(card.pair);
  }
  return false;
};

describe('Regeln', () => {
  it('teilt alle Karten aus und legt Paare sofort ab', () => {
    const state = start(3, { pairs: '12' });
    const inHands = state.hands.flat().length;
    expect(inHands + state.discarded.length * 2).toBe(25);
    expect(state.hands.flat().filter((c) => c?.pair === PETER)).toHaveLength(1);
    for (const hand of state.hands) expect(hasPair(hand)).toBe(false);
  });

  it('gezogen wird beim nächsten Spieler mit Karten', () => {
    const state = start(3);
    const custom: BlackPeterState = { ...state, turn: 0, hands: [state.hands[0]!, [], state.hands[2]!.length ? state.hands[2]! : [{ pair: 0, side: 'a' }]] };
    expect(sourceOf(custom)).toBe(2);
  });

  it('nur einmal pro Zug mischen', () => {
    let state = start(2);
    if ((state.hands[state.turn]?.length ?? 0) < 2) return;
    state = gameModule.applyMove(state, state.turn, { type: 'shuffle' }).state;
    expect(gameModule.legalMoves(state, state.turn).some((m) => m.type === 'shuffle')).toBe(false);
  });

  it('wer am Ende den Peter hat, verliert', () => {
    // Zwei Spieler: A hat den Peter, B eine Karte, deren Partnerin A hat. B zieht den Partner … dann bleibt der Peter bei A.
    const state: BlackPeterState = {
      ...start(2),
      hands: [
        [{ pair: PETER, side: 'a' }, { pair: 3, side: 'a' }],
        [{ pair: 3, side: 'b' }],
      ],
      discarded: [],
      turn: 1,
    };
    const drawPartner = state.hands[0]!.findIndex((c) => c?.pair === 3);
    const { state: end } = gameModule.applyMove(state, 1, { type: 'draw', index: drawPartner });
    expect(end.loser).toBe(0);
    expect(gameModule.result(end)).toEqual({ kind: 'win', winners: [1], reason: 'peter' });
  });

  it('die Sicht zeigt nur die eigene Hand', () => {
    const state = start(3);
    const view = gameModule.playerView(state, 1);
    expect(view.hands[1]).toEqual(state.hands[1]);
    expect(view.hands[0]!.every((c) => c === null)).toBe(true);
    expect(view.hands[0]).toHaveLength(state.hands[0]!.length);
  });
});

describe('Vertrag für Spielmodule', () => {
  for (const check of gameContractChecks(gameModule, { randomGames: 12, seatCounts: [2, 4, 6] })) test(check.name, check.run);
});
