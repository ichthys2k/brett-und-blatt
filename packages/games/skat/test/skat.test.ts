import { cardId, computeBotMove, resolveOptions, Rng } from '@brett-und-blatt/engine';
import { gameContractChecks } from '@brett-und-blatt/engine/testing';
import { describe, expect, it, test } from 'vitest';
import { gameModule } from '../src/index.js';
import {
  ALL_BID_VALUES,
  calculateGameValue,
  countSpitzen,
  nextPossibleBid,
  type SkatMove,
} from '../src/rules.js';

describe('Vertrag für Spielmodule', () => {
  for (const check of gameContractChecks(gameModule)) {
    test(check.name, check.run);
  }
});

describe('Skat-Reizwerte und Spitzen', () => {
  it('enthält alle gültigen Reizwerte nach ISkO in aufsteigender Reihenfolge', () => {
    expect(ALL_BID_VALUES[0]).toBe(18); // 2 * 9 (Karo)
    expect(ALL_BID_VALUES[1]).toBe(20); // 2 * 10 (Herz)
    expect(ALL_BID_VALUES[2]).toBe(22); // 2 * 11 (Pik)
    expect(ALL_BID_VALUES[3]).toBe(23); // Null
    expect(ALL_BID_VALUES[4]).toBe(24); // 2 * 12 (Kreuz) / 1 * 24 (Grand mit 1)
    expect(ALL_BID_VALUES[5]).toBe(27); // 3 * 9
    expect(ALL_BID_VALUES.includes(35)).toBe(true); // Null Hand
    expect(ALL_BID_VALUES.includes(46)).toBe(true); // Null ouvert
    expect(ALL_BID_VALUES.includes(59)).toBe(true); // Null ouvert Hand
  });

  it('ermittelt den nächsten Reizwert korrekt', () => {
    expect(nextPossibleBid(18)).toBe(20);
    expect(nextPossibleBid(22)).toBe(23);
    expect(nextPossibleBid(23)).toBe(24);
    expect(nextPossibleBid(24)).toBe(27);
  });

  it('zählt Spitzen korrekt für Buben und Farbtrümpfe', () => {
    const cardsMit2 = [cardId('C', 11), cardId('S', 11), cardId('D', 1)];
    expect(countSpitzen(cardsMit2, 'grand')).toEqual({ mit: true, count: 2 });

    const cardsOhne1 = [cardId('S', 11), cardId('H', 11)];
    expect(countSpitzen(cardsOhne1, 'grand')).toEqual({ mit: false, count: 1 });

    const cardsMit5 = [
      cardId('C', 11),
      cardId('S', 11),
      cardId('H', 11),
      cardId('D', 11),
      cardId('H', 1),
    ];
    expect(countSpitzen(cardsMit5, 'H')).toEqual({ mit: true, count: 5 });
  });

  it('berechnet Spielwerte nach ISkO', () => {
    const grandMit2 = [cardId('C', 11), cardId('S', 11)];
    expect(calculateGameValue({ gameType: 'grand' }, grandMit2)).toBe(72);

    const herzMit1Hand = [cardId('C', 11)];
    expect(calculateGameValue({ gameType: 'H', hand: true }, herzMit1Hand)).toBe(30);

    expect(calculateGameValue({ gameType: 'null' }, [])).toBe(23);
    expect(calculateGameValue({ gameType: 'null', hand: true }, [])).toBe(35);
    expect(calculateGameValue({ gameType: 'null', ouvert: true }, [])).toBe(46);
    expect(calculateGameValue({ gameType: 'null', hand: true, ouvert: true }, [])).toBe(59);
  });
});

/** Spielt mit Zufallszügen bis zum Beginn des zweiten Spiels der Serie. */
function secondDeal(seats: number, seed: string): any {
  const rng = Rng.fromSeed(seed, 'test');
  let state: any = gameModule.setup(seats, resolveOptions(gameModule), seed);
  for (let i = 0; i < 2_000 && state.gameNumber < 2; i++) {
    const actor = rng.pick(gameModule.currentPlayers(state));
    const moves = gameModule.legalMoves(state, actor);
    state = gameModule.applyMove(state, actor, actor === 'system' ? moves[0] : rng.pick(moves)).state;
  }
  expect(state.gameNumber).toBe(2);
  return state;
}

describe('Geben und Geheimnisse', () => {
  it('jede Serie gibt ab dem zweiten Spiel andere Karten', () => {
    const a = secondDeal(3, 'serie-a');
    const b = secondDeal(3, 'serie-b');
    expect(a.hands).not.toEqual(b.hands);
  });

  it('die Sicht verrät den Zufallsstrom fürs Geben nicht', () => {
    const state = secondDeal(3, 'serie-c');
    expect(gameModule.playerView(state, 0).dealRng).toEqual([0, 0, 0, 0]);
    expect(gameModule.playerView(state, 'spectator').dealRng).toEqual([0, 0, 0, 0]);
  });
});

describe('Skat-Bot', () => {
  it('überreizt nicht und gewinnt einen guten Teil seiner Spiele', () => {
    let won = 0;
    let played = 0;
    for (const seed of ['bot-a', 'bot-b', 'bot-c']) {
      let state: any = gameModule.setup(3, resolveOptions(gameModule), seed);
      for (let i = 0; i < 6_000 && !gameModule.result(state); i++) {
        const seat = gameModule.currentPlayers(state)[0] as number;
        const move = computeBotMove(gameModule, { gameId: 'skat', botId: 'skat', level: 'hard', seat, view: gameModule.playerView(state, seat), seed: `${seed}/${i}`, timeBudgetMs: 50 }) as SkatMove;
        state = gameModule.applyMove(state, seat, move).state;
      }
      for (const game of state.history) {
        if (!game.declaration) continue;
        expect(game.overbid).toBe(false);
        played++;
        if (game.won) won++;
      }
    }
    expect(played).toBeGreaterThan(5);
    // Der alte Bot sagte fast immer Grand an und verlor fast alles.
    expect(won / played).toBeGreaterThan(0.35);
  }, 120_000);
});

describe('Skat-Bot: Hand und Schneider', () => {
  /** Stellt dem Bot auf Platz `seat` ein bestimmtes Blatt hin, er hat das Reizen mit 18 gewonnen. */
  function decision(hand: string[], level: 'medium' | 'hard' = 'hard') {
    let state: any = gameModule.setup(3, resolveOptions(gameModule), 'hand-test');
    const seat = 1;
    state = { ...state, phase: 'skatDecision', declarerSeat: seat, highestBid: 18, currentBidValue: 18, hands: { ...state.hands, [seat]: hand } };
    const ask = (s: any) => computeBotMove(gameModule, { gameId: 'skat', botId: 'skat', level, seat, view: gameModule.playerView(s, seat), seed: 'h', timeBudgetMs: 50 }) as SkatMove;
    return { state, seat, ask };
  }
  const c = (s: 'C' | 'S' | 'H' | 'D', r: number) => cardId(s, r as never);

  it('spielt ein Traumblatt Hand und sagt Schneider an', () => {
    const dream = [c('C', 11), c('S', 11), c('H', 11), c('D', 11), c('C', 1), c('C', 10), c('C', 13), c('C', 12), c('S', 1), c('H', 1)];
    const { state, seat, ask } = decision(dream);
    const first = ask(state);
    expect(first).toEqual({ type: 'playHand' });
    const declaring = gameModule.applyMove(state, seat, first).state;
    const declare = ask(declaring);
    expect(declare).toMatchObject({ type: 'declare', declaration: { gameType: 'C', hand: true, schneider: true } });
  });

  it('nimmt mit einem gewöhnlichen Blatt den Skat auf', () => {
    const plain = [c('C', 11), c('H', 11), c('C', 1), c('C', 10), c('C', 9), c('C', 8), c('S', 7), c('H', 8), c('D', 7), c('D', 9)];
    const { state, ask } = decision(plain);
    expect(ask(state)).toEqual({ type: 'takeSkat' });
  });
});
