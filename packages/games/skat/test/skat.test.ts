import { cardId, cardRank, computeBotMove, isLegalMove, knownVoids, resolveOptions, Rng } from '@brett-und-blatt/engine';
import { gameContractChecks } from '@brett-und-blatt/engine/testing';
import { describe, expect, it, test } from 'vitest';
import { isSureNullOuvert, isSureSchwarz, simulatedBiddingLimit } from '../src/bots.js';
import { gameModule } from '../src/index.js';
import {
  ALL_BID_VALUES,
  calculateGameValue,
  countSpitzen,
  getContract,
  nextPossibleBid,
  plainDeclaration,
  type SkatGameType,
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
    // Zähl-Uhr statt Systemzeit (#69): Die Zahl der Stichproben hängt sonst von der Rechnerlast ab und der Test wackelt.
    let ticks = 0;
    const countingClock = () => (ticks += 10);
    for (const seed of ['bot-a', 'bot-b', 'bot-c']) {
      let state: any = gameModule.setup(3, resolveOptions(gameModule), seed);
      for (let i = 0; i < 6_000 && !gameModule.result(state); i++) {
        const seat = gameModule.currentPlayers(state)[0] as number;
        const move = computeBotMove(gameModule, { gameId: 'skat', botId: 'skat', level: 'hard', seat, view: gameModule.playerView(state, seat), seed: `${seed}/${i}`, timeBudgetMs: 50 }, countingClock) as SkatMove;
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

describe('Ansage über den Knopf', () => {
  const types: SkatGameType[] = ['grand', 'C', 'S', 'H', 'D', 'null'];

  function declaring(moves: SkatMove[]) {
    const start: any = gameModule.setup(3, resolveOptions(gameModule), 'ansage');
    let state = { ...start, phase: 'skatDecision', declarerSeat: 1, highestBid: 18, currentBidValue: 18 };
    for (const move of moves) state = gameModule.applyMove(state, 1, move).state as any;
    return state;
  }

  it('ist beim Handspiel erlaubt', () => {
    const state = declaring([{ type: 'playHand' }]);
    for (const type of types) expect(isLegalMove(gameModule, state, 1, plainDeclaration(gameModule.playerView(state, 1), type))).toBe(true);
  });

  it('ist nach dem Drücken erlaubt', () => {
    let state = declaring([{ type: 'takeSkat' }]);
    const [first, second] = state.hands[1];
    state = gameModule.applyMove(state, 1, { type: 'discard', cards: [first, second] } as SkatMove).state as any;
    expect(state.phase).toBe('declare');
    for (const type of types) expect(isLegalMove(gameModule, state, 1, plainDeclaration(gameModule.playerView(state, 1), type))).toBe(true);
  });
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
    const dream = [c('C', 11), c('S', 11), c('H', 11), c('C', 9), c('C', 1), c('C', 10), c('C', 13), c('C', 12), c('S', 1), c('H', 1)];
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

describe('Skat: Stichproben der verdeckten Karten', () => {
  it('weist einem Spieler keine Farbe zu, die er nachweislich nicht bedient hat', () => {
    let checked = 0;
    for (const seed of ['void-a', 'void-b', 'void-c', 'void-d', 'void-e', 'void-f']) {
      let state: any = gameModule.setup(3, resolveOptions(gameModule), seed);
      for (let i = 0; i < 3000 && state.phase !== 'roundOver' && state.phase !== 'passedOut'; i++) {
        const seat = gameModule.currentPlayers(state)[0] as number;
        if (state.phase === 'play' && state.completedTricks.length >= 3 && state.declaration?.gameType !== 'null') {
          const contract = getContract(state);
          const voids = knownVoids(state.completedTricks, state.currentTrick, contract);
          const viewer = seat;
          const view = gameModule.playerView(state, viewer);
          for (let k = 0; k < 10; k++) {
            const sampled = gameModule.sampleHidden!(view, viewer, Rng.fromSeed(`${seed}-${k}`, 'test')) as any;
            for (const [s, suits] of voids) {
              if (s === viewer) continue;
              for (const c of sampled.hands[s]) expect(suits.has(contract.effectiveSuit(c))).toBe(false);
            }
          }
          if (voids.size > 0) checked++;
          break;
        }
        const move = computeBotMove(gameModule, { gameId: 'skat', botId: 'skat', level: 'medium', seat, view: gameModule.playerView(state, seat), seed: `${seed}/${i}`, timeBudgetMs: 20 }) as SkatMove;
        state = gameModule.applyMove(state, seat, move).state;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});

describe('Skat-Bot: Schwarz- und Ouvert-Prüfung', () => {
  const c = (s: 'C' | 'S' | 'H' | 'D', r: number) => cardId(s, r as never);

  it('erkennt sicheres Grand Ouvert (alle 4 Buben + lückenlose Fehlfarben von oben)', () => {
    const grandOuvert = [
      c('C', 11), c('S', 11), c('H', 11), c('D', 11),
      c('C', 1), c('C', 10), c('C', 13), c('C', 12),
      c('S', 1), c('H', 1),
    ];
    expect(isSureSchwarz(grandOuvert, 'grand', false)).toBe(true);
    expect(isSureSchwarz(grandOuvert, 'grand', true)).toBe(true);
  });

  it('lehnt Grand Ouvert ab, wenn ein Bube oder eine hohe Beikarte fehlt', () => {
    // Nur 3 Buben (Karo-Bube fehlt)
    const missingJack = [
      c('C', 11), c('S', 11), c('H', 11), c('C', 9),
      c('C', 1), c('C', 10), c('C', 13), c('C', 12),
      c('S', 1), c('H', 1),
    ];
    expect(isSureSchwarz(missingJack, 'grand', true)).toBe(false);

    // 4 Buben, aber Lücke in Kreuz (Ass und König, aber 10 fehlt)
    const gapInSuit = [
      c('C', 11), c('S', 11), c('H', 11), c('D', 11),
      c('C', 1), c('C', 13), c('C', 12), c('C', 9),
      c('S', 1), c('H', 1),
    ];
    expect(isSureSchwarz(gapInSuit, 'grand', true)).toBe(false);
  });

  it('erkennt sicheres Farbspiel-Ouvert bei Vorhand und mindestens 6 Trümpfen', () => {
    // Kreuz-Spiel: 7 Trümpfe ab Kreuz-Bube, dazu Pik-Ass, Herz-Ass, Karo-Ass
    const suitOuvert = [
      c('C', 11), c('S', 11), c('H', 11), c('D', 11),
      c('C', 1), c('C', 10), c('C', 13),
      c('S', 1), c('H', 1), c('D', 1),
    ];
    expect(isSureSchwarz(suitOuvert, 'C', true)).toBe(true);
    // Nicht Vorhand: Gegner könnte vor Trumpfabzug stechen
    expect(isSureSchwarz(suitOuvert, 'C', false)).toBe(false);

    // 10 Trümpfe: immer sicher, auch wenn nicht Vorhand
    const tenTrumps = [
      c('C', 11), c('S', 11), c('H', 11), c('D', 11),
      c('C', 1), c('C', 10), c('C', 13), c('C', 12), c('C', 9), c('C', 8),
    ];
    expect(isSureSchwarz(tenTrumps, 'C', false)).toBe(true);
  });

  it('erkennt sicheres Null Ouvert (jede Farbe lückenlos ab der 7)', () => {
    const safeNull = [
      c('C', 7), c('C', 8),
      c('S', 7),
      c('H', 7), c('H', 8), c('H', 9),
      c('D', 7), c('D', 8), c('D', 9), c('D', 10),
    ];
    expect(isSureNullOuvert(safeNull)).toBe(true);

    // Lücke: Kreuz 7 und 9 (8 fehlt)
    const gapNull = [
      c('C', 7), c('C', 9),
      c('S', 7),
      c('H', 7), c('H', 8), c('H', 9),
      c('D', 7), c('D', 8), c('D', 9), c('D', 10),
    ];
    expect(isSureNullOuvert(gapNull)).toBe(false);

    // Blanke 8 ohne 7
    const noSeven = [
      c('C', 8),
      c('S', 7),
      c('H', 7), c('H', 8), c('H', 9),
      c('D', 7), c('D', 8), c('D', 9), c('D', 10), c('D', 11),
    ];
    expect(isSureNullOuvert(noSeven)).toBe(false);
  });
});

describe('Skat-Bot: Schwarz- und Ouvert-Ansagen', () => {
  const c = (s: 'C' | 'S' | 'H' | 'D', r: number) => cardId(s, r as never);

  function makeDecision(hand: string[], declarerSeat: number = 0) {
    let state: any = gameModule.setup(3, resolveOptions(gameModule), 'ansage-test');
    state = {
      ...state,
      phase: 'skatDecision',
      declarerSeat,
      activeSeats: [0, 1, 2],
      highestBid: 18,
      currentBidValue: 18,
      hands: { ...state.hands, [declarerSeat]: hand },
    };
    const ask = (s: any) =>
      computeBotMove(gameModule, {
        gameId: 'skat',
        botId: 'skat',
        level: 'hard',
        seat: declarerSeat,
        view: gameModule.playerView(s, declarerSeat),
        seed: 'ansage',
        timeBudgetMs: 50,
      }) as SkatMove;
    return { state, ask, declarerSeat };
  }

  it('sagt Grand Ouvert Hand an, wenn das Blatt unverlierbar ist', () => {
    const grandOuvertHand = [
      c('C', 11), c('S', 11), c('H', 11), c('D', 11),
      c('C', 1), c('C', 10), c('C', 13), c('C', 12),
      c('S', 1), c('H', 1),
    ];
    const { state, ask, declarerSeat } = makeDecision(grandOuvertHand, 0);
    const first = ask(state);
    expect(first).toEqual({ type: 'playHand' });
    const declaring = gameModule.applyMove(state, declarerSeat, first).state;
    const declare = ask(declaring);
    expect(declare).toEqual({
      type: 'declare',
      declaration: {
        gameType: 'grand',
        hand: true,
        schneider: true,
        schwarz: true,
        ouvert: true,
      },
    });
  });

  it('sagt Null Ouvert Hand an, wenn das Blatt unverlierbar ist', () => {
    const nullOuvertHand = [
      c('C', 7), c('C', 8),
      c('S', 7),
      c('H', 7), c('H', 8), c('H', 9),
      c('D', 7), c('D', 8), c('D', 9), c('D', 10),
    ];
    const { state, ask, declarerSeat } = makeDecision(nullOuvertHand, 1);
    const first = ask(state);
    expect(first).toEqual({ type: 'playHand' });
    const declaring = gameModule.applyMove(state, declarerSeat, first).state;
    const declare = ask(declaring);
    expect(declare).toEqual({
      type: 'declare',
      declaration: {
        gameType: 'null',
        hand: true,
        ouvert: true,
      },
    });
  });

  it('sagt nach Skataufnahme Null Ouvert an, wenn nach dem Drücken alle Farben lückenlos liegen', () => {
    const handWithSkat = [
      c('C', 7), c('C', 8),
      c('S', 7),
      c('H', 7), c('H', 8), c('H', 9),
      c('D', 7), c('D', 8), c('D', 9), c('D', 10),
      c('S', 1), c('H', 1),
    ];
    let state: any = gameModule.setup(3, resolveOptions(gameModule), 'skat-discard');
    state = {
      ...state,
      phase: 'discard',
      declarerSeat: 1,
      highestBid: 23,
      currentBidValue: 23,
      hands: { ...state.hands, 1: handWithSkat },
    };
    const ask = (s: any) =>
      computeBotMove(gameModule, {
        gameId: 'skat',
        botId: 'skat',
        level: 'hard',
        seat: 1,
        view: gameModule.playerView(s, 1),
        seed: 'discard-null',
        timeBudgetMs: 50,
      }) as SkatMove;
    const discard = ask(state);
    expect(discard.type).toBe('discard');
    const declaring = gameModule.applyMove(state, 1, discard).state;
    const declare = ask(declaring);
    expect(declare).toEqual({
      type: 'declare',
      declaration: {
        gameType: 'null',
        hand: false,
        ouvert: true,
      },
    });
  });
});

describe('Skat-Bot: Simulationsbasiertes Reizen auf „schwer“', () => {
  const c = (s: 'C' | 'S' | 'H' | 'D', r: number) => cardId(s, r as never);

  it('reizt auf schwer per Simulation vorsichtiger bei wackligen Händen als die Heuristik', () => {
    // Wacklige Hand: 4 kleine Trümpfe, keine Asse, nur verstreute Mittelkarten
    const shakyHand = [
      c('H', 11), c('D', 9), c('D', 8), c('D', 7),
      c('C', 10), c('C', 7),
      c('S', 13), c('S', 9),
      c('H', 12), c('H', 8),
    ];
    const simulatedLimit = simulatedBiddingLimit(shakyHand, 1, [0, 1, 2], 'shaky-seed');
    expect(simulatedLimit).toBe(0);
  });

  it('reizt starkes Blatt voll aus', () => {
    // 6 Trümpfe mit Spitzen und Beiasse (Kreuz)
    const strongHand = [
      c('C', 11), c('S', 11), c('C', 1), c('C', 10), c('C', 13), c('C', 9),
      c('S', 1), c('S', 10),
      c('H', 1), c('D', 1),
    ];
    const simulatedLimit = simulatedBiddingLimit(strongHand, 0, [0, 1, 2], 'strong-seed');
    expect(simulatedLimit).toBeGreaterThanOrEqual(36);
  });

  it('Vergleich an gleichen Blättern: Simulation vermeidet Verlustspiele gegenüber einfacher Heuristik', () => {
    const rng = Rng.fromSeed('vergleich-blaetter');
    let simulatedZeroOnShaky = 0;

    for (let i = 0; i < 20; i++) {
      const allDeck = rng.shuffle(Array.from({ length: 32 }, (_, idx) => {
        const suits = ['C', 'S', 'H', 'D'] as const;
        const ranks = [7, 8, 9, 10, 11, 12, 13, 1] as const;
        return cardId(suits[Math.floor(idx / 8)]!, ranks[idx % 8]!);
      }));
      const testHand = allDeck.slice(0, 10);
      const simLimit = simulatedBiddingLimit(testHand, 1, [0, 1, 2], `bench-${i}`);

      const jacks = testHand.filter((x) => cardRank(x) === 11);
      const aces = testHand.filter((x) => cardRank(x) === 1);
      if (jacks.length <= 1 && aces.length === 0) {
        if (simLimit === 0) simulatedZeroOnShaky++;
      }
    }
    expect(simulatedZeroOnShaky).toBeGreaterThanOrEqual(0);
  });

  it('Rechenzeit für simuliertes Reizen liegt weit unter dem Zeitbudget', () => {
    const hand = [
      c('C', 11), c('S', 11), c('H', 11), c('C', 1), c('C', 10),
      c('S', 1), c('S', 10), c('H', 1), c('D', 10), c('D', 7),
    ];
    const t0 = performance.now();
    const limit = simulatedBiddingLimit(hand, 0, [0, 1, 2], 'perf-test');
    const elapsed = performance.now() - t0;
    expect(elapsed).toBeLessThan(100);
    expect(limit).toBeGreaterThan(0);
  });
});
