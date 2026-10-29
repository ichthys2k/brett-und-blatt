import { describe, expect, it, test } from 'vitest';
import { Rng, computeBotMove, type CardId } from '@brett-und-blatt/engine';
import { gameContractChecks } from '@brett-und-blatt/engine/testing';
import { gameModule } from '../src';
import { applyMove, currentPlayers, isLegal, legalMoves, placeTitle, playerView, sampleHidden, setup, type PresidentMove, type PresidentState } from '../src/rules';

describe('president: allgemeine Prüfungen', () => {
  for (const check of gameContractChecks(gameModule)) test(check.name, check.run, 120_000);
});

/** Ein Tisch mit festgelegten Händen; `turn` ist am Zug. */
function table(hands: CardId[][], options: Record<string, string> = {}, turn = 0): PresidentState {
  const state = setup(hands.length, options, 'test');
  return { ...state, hands, turn, passed: hands.map(() => false) };
}

function run(state: PresidentState, ...moves: [number, PresidentMove][]): PresidentState {
  for (const [seat, move] of moves) state = applyMove(state, seat, move).state;
  return state;
}

const pass: PresidentMove = { type: 'pass' };
const play = (...cards: CardId[]): PresidentMove => ({ type: 'play', cards });

describe('president: Regeln', () => {
  it('verteilt alle 32 Karten bis fünf Spieler, 52 ab sechs', () => {
    const four = setup(4, {}, 'a');
    expect(four.hands.flat()).toHaveLength(32);
    expect(new Set(four.hands.flat()).size).toBe(32);
    expect(four.hands.map((h) => h.length)).toEqual([8, 8, 8, 8]);
    expect(setup(6, {}, 'a').hands.flat()).toHaveLength(52);
    expect(setup(3, { deck: '52' }, 'a').hands.flat()).toHaveLength(52);
  });

  it('lässt den Besitzer der Kreuz 7 beginnen', () => {
    const state = setup(4, {}, 'b');
    expect(state.hands[state.turn]).toContain('C7.1');
  });

  it('verlangt gleich viele Karten mit höherem Rang', () => {
    const state = table([['H9.1', 'S9.1', 'H13.1'], ['C10.1', 'D10.1', 'C8.1'], ['H1.1', 'C12.1', 'D7.1']]);
    const s1 = run(state, [0, play('H9.1', 'S9.1')]);
    const moves = legalMoves(s1, 1);
    expect(moves).toContainEqual(play('C10.1', 'D10.1'));
    expect(moves.some((m) => m.type === 'play' && m.cards.length === 1)).toBe(false);
    expect(isLegal(s1, 1, play('C8.1'))).toBe(false);
    // Ass ist am höchsten
    const s2 = run(state, [0, play('H13.1')], [1, pass]);
    expect(isLegal(s2, 2, play('H1.1'))).toBe(true);
    expect(isLegal(s2, 2, play('C12.1'))).toBe(false);
  });

  it('räumt den Stich ab, wenn alle anderen passen – der Leger beginnt neu', () => {
    const state = table([['H9.1', 'H7.1'], ['C10.1', 'C8.1'], ['H1.1', 'D7.1']]);
    const s = run(state, [0, play('H9.1')], [1, play('C10.1')], [2, pass], [0, pass]);
    expect(s.trick).toEqual([]);
    expect(s.turn).toBe(1);
  });

  it('lässt Passende wieder einsteigen – oder mit Option nicht', () => {
    const hands = [['H8.1', 'H7.1', 'S7.1'], ['C9.1', 'C11.1', 'S8.1'], ['H10.1', 'H12.1', 'D8.1']];
    const s = run(table(hands), [0, play('H8.1')], [1, pass], [2, play('H10.1')], [0, pass]);
    expect(s.turn).toBe(1);
    expect(legalMoves(s, 1)).toContainEqual(play('C11.1'));
    const strict = run(table(hands, { passing: 'out' }), [0, play('H8.1')], [1, pass], [2, play('H10.1')], [0, pass]);
    expect(strict.trick).toEqual([]);
    expect(strict.turn).toBe(2);
  });

  it('vergibt Plätze und Punkte, wenn nur noch einer Karten hat', () => {
    const state = table([['H1.1'], ['C7.1', 'C8.1'], ['D7.1', 'D9.1']]);
    const s = run(state, [0, play('H1.1')], [1, pass], [2, pass], [1, play('C8.1')], [2, play('D9.1')], [1, pass]);
    // Platz 0 ist raus, Platz 2 legt seine letzte Karte, nachdem 1 gepasst hat
    const end = run(s, [2, play('D7.1')]);
    expect(end.phase).toBe('roundEnd');
    expect(end.lastRound!.order).toEqual([0, 2, 1]);
    expect(end.scores).toEqual([2, -2, 0]);
    expect(placeTitle(0, 3, 'president')).toBe('Präsident');
    expect(placeTitle(2, 3, 'court')).toBe('Bettler');
  });

  it('beginnt nach dem Ausgehen mit dem Nachfolger', () => {
    const state = table([['H1.1'], ['C7.1', 'C8.1'], ['D7.1', 'D9.1']]);
    const s = run(state, [0, play('H1.1')], [1, pass], [2, pass]);
    expect(s.trick).toEqual([]);
    expect(s.turn).toBe(1);
  });

  it('tauscht: Bettler gibt die zwei besten, Präsident wählt zwei, Bettler beginnt', () => {
    let s = setup(4, { rounds: '3' }, 'c');
    for (let guard = 0; s.phase === 'play' && guard < 500; guard++) {
      const seat = currentPlayers(s)[0] as number;
      s = applyMove(s, seat, legalMoves(s, seat)[0]!).state;
    }
    expect(s.phase).toBe('roundEnd');
    for (let seat = 0; seat < 4; seat++) s = applyMove(s, seat, { type: 'ready' }).state;
    expect(s.phase).toBe('exchange');
    const order = s.lastRound!.order;
    const [president, vice, viceLow, beggar] = order as [number, number, number, number];
    expect(s.swaps.map((x) => [x.low, x.high, x.count])).toEqual([[beggar, president, 2], [viceLow, vice, 1]]);
    expect(s.hands[president]).toHaveLength(10);
    expect(currentPlayers(s)).toEqual([president]);
    const give = s.hands[president]!.slice(0, 2);
    s = applyMove(s, president, { type: 'give', cards: give }).state;
    expect(s.hands[beggar]).toEqual(expect.arrayContaining(give));
    expect(currentPlayers(s)).toEqual([vice]);
    s = applyMove(s, vice, { type: 'give', cards: s.hands[vice]!.slice(0, 1) }).state;
    expect(s.phase).toBe('play');
    expect(s.turn).toBe(beggar);
    expect(s.hands.map((h) => h.length)).toEqual([8, 8, 8, 8]);
    // Getauschte Karten sieht nur, wer beteiligt war
    const outsider = order.find((p) => p !== beggar && p !== president)!;
    expect(playerView(s, outsider).swaps[0]!.down).toEqual([]);
    expect(playerView(s, beggar).swaps[0]!.down).toEqual(give);
  });

  it('sampleHidden legt die selbst abgegebenen Karten zum Empfänger', () => {
    const s = setup(4, {}, 'd');
    const withSwap: PresidentState = { ...s, phase: 'play', swaps: [{ low: 1, high: 0, count: 2, up: [], down: [s.hands[1]![0]!, s.hands[1]![1]!], done: true }] };
    const world = sampleHidden(playerView(withSwap, 0), 0, new Rng([1, 2, 3, 4]));
    expect(world.hands[1]).toEqual(expect.arrayContaining(withSwap.swaps[0]!.down));
  });

  it('Gleich legen lässt den Nächsten aussetzen', () => {
    const state = table([['H9.1', 'H7.1'], ['C9.1', 'C8.1'], ['H1.1', 'D7.1'], ['S12.1', 'S7.1']], { sameSkips: 'on' });
    const s = run(state, [0, play('H9.1')], [1, play('C9.1')]);
    expect(s.turn).toBe(3);
  });

  it('Achter räumt den Stich', () => {
    const state = table([['H7.1', 'H9.1'], ['C8.1', 'C10.1'], ['H1.1', 'D7.1']], { eightClears: 'on' });
    const s = run(state, [0, play('H7.1')], [1, play('C8.1')]);
    expect(s.trick).toEqual([]);
    expect(s.turn).toBe(1);
  });

  it('Revolution kehrt die Rangfolge um', () => {
    const state = table([['H9.1', 'C9.1', 'D9.1', 'S9.1', 'H7.1'], ['C8.1', 'C10.1'], ['H1.1', 'D7.1']], { revolution: 'on' });
    const s = run(state, [0, play('H9.1', 'C9.1', 'D9.1', 'S9.1')], [1, pass], [2, pass]);
    expect(s.reversed).toBe(true);
    const s2 = run(s, [0, play('H7.1')]);
    expect(isLegal(s2, 1, play('C8.1'))).toBe(false);
  });

  it('2 hoch nur mit 52 Karten', () => {
    const state = table([['H2.1', 'H5.1'], ['C1.1', 'C3.1'], ['H13.1', 'D4.1']], { deck: '52', twoHigh: 'on' });
    const s = run(state, [0, play('H5.1')], [1, play('C1.1')]);
    expect(isLegal(s, 2, play('H13.1'))).toBe(false);
    const s2 = run(s, [2, pass]);
    expect(isLegal(s2, 0, play('H2.1'))).toBe(true);
  });
});

describe('president: Bot', () => {
  for (const level of ['easy', 'medium', 'hard'] as const) {
    it(`spielt auf „${level}“ eine ganze Partie`, () => {
      let s = gameModule.setup(4, { rounds: '3' }, `bot-${level}`);
      for (let guard = 0; !gameModule.result(s) && guard < 2000; guard++) {
        const seat = currentPlayers(s)[0] as number;
        const move = computeBotMove(gameModule, { gameId: 'president', botId: 'kartenkanzler', level, seat, view: playerView(s, seat), seed: `${level}/${guard}`, timeBudgetMs: 200 }) as PresidentMove;
        s = applyMove(s, seat, move).state;
      }
      expect(gameModule.result(s)).not.toBeNull();
    }, 60_000);
  }
});
