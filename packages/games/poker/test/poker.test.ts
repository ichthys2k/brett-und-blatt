import { inlineBotRunner, LocalSession, type CardId } from '@brett-und-blatt/engine';
import { gameContractChecks } from '@brett-und-blatt/engine/testing';
import { soundCatalog, soundsForEvents } from '@brett-und-blatt/ui';
import { describe, expect, test } from 'vitest';
import {
  bestFive,
  buildPots,
  categoryOf,
  currentPots,
  describeValue,
  evaluateHand,
  FLUSH,
  FULL_HOUSE,
  gameModule,
  HIGH_CARD,
  isLegal,
  PAIR,
  QUADS,
  raiseBounds,
  settlePots,
  STRAIGHT,
  STRAIGHT_FLUSH,
  TRIPS,
  TWO_PAIR,
  type PokerState,
  type PokerView,
} from '../src';
import { gameUi } from '../src/ui';

describe('Poker – Vertrag', () => {
  const checks = gameContractChecks(gameModule, {
    seatCounts: [2, 4, 6],
    randomGames: 24,
    checkView(state, view, seat) {
      const s = state as PokerState;
      const v = view as PokerView;
      if (v.deck.length > 0) return 'Stapel darf in playerView nicht sichtbar sein';
      for (const ps of v.seats) {
        if (ps.seat !== seat && !s.seats[ps.seat]?.revealed && ps.holeCards.length > 0) {
          return `Handkarten von Platz ${ps.seat} dürfen für Platz ${seat} nicht sichtbar sein`;
        }
      }
      return null;
    },
  });

  for (const check of checks) {
    test(check.name, check.run);
  }
});

describe('Poker – Handbewertung (eval)', () => {
  test('erkennt und ordnet alle 9 Kategorien sowie Wheel-Straßen und Kicker korrekt', () => {
    const royal = evaluateHand(['S1.1', 'S13.1', 'S12.1', 'S11.1', 'S10.1', 'D2.1', 'C3.1'] as CardId[]);
    const sfWheel = evaluateHand(['S1.1', 'S2.1', 'S3.1', 'S4.1', 'S5.1', 'D13.1', 'C12.1'] as CardId[]);
    const quads = evaluateHand(['S9.1', 'H9.1', 'D9.1', 'C9.1', 'S1.1', 'D2.1', 'C3.1'] as CardId[]);
    const fullHouseFromTwoTrips = evaluateHand(['S13.1', 'H13.1', 'D13.1', 'S12.1', 'H12.1', 'D12.1', 'C2.1'] as CardId[]);
    const flush = evaluateHand(['H1.1', 'H11.1', 'H9.1', 'H6.1', 'H2.1', 'S13.1', 'D12.1'] as CardId[]);
    const straight = evaluateHand(['S10.1', 'H9.1', 'D8.1', 'C7.1', 'S6.1', 'D2.1', 'C2.1'] as CardId[]);
    const wheel = evaluateHand(['S1.1', 'H2.1', 'D3.1', 'C4.1', 'S5.1', 'D13.1', 'C12.1'] as CardId[]);
    const trips = evaluateHand(['S8.1', 'H8.1', 'D8.1', 'S1.1', 'C13.1', 'D2.1', 'H3.1'] as CardId[]);
    const twoPair = evaluateHand(['S1.1', 'H1.1', 'S13.1', 'H13.1', 'S12.1', 'D12.1', 'C2.1'] as CardId[]);
    const pairHighKicker = evaluateHand(['S10.1', 'H10.1', 'S1.1', 'D13.1', 'C12.1', 'S2.1', 'D3.1'] as CardId[]);
    const pairLowKicker = evaluateHand(['D10.1', 'C10.1', 'S1.1', 'D13.1', 'C11.1', 'H2.1', 'C3.1'] as CardId[]);
    const highCard = evaluateHand(['S1.1', 'H13.1', 'D12.1', 'C11.1', 'S9.1', 'D4.1', 'C2.1'] as CardId[]);

    expect(categoryOf(royal)).toBe(STRAIGHT_FLUSH);
    expect(describeValue(royal)).toBe('Royal Flush');
    expect(categoryOf(sfWheel)).toBe(STRAIGHT_FLUSH);
    expect(describeValue(sfWheel)).toBe('Straight Flush bis zur Fünf');
    expect(royal).toBeGreaterThan(sfWheel);

    expect(categoryOf(quads)).toBe(QUADS);
    expect(categoryOf(fullHouseFromTwoTrips)).toBe(FULL_HOUSE);
    expect(describeValue(fullHouseFromTwoTrips)).toBe('Full House, Könige und Damen');
    expect(categoryOf(flush)).toBe(FLUSH);
    expect(categoryOf(straight)).toBe(STRAIGHT);
    expect(categoryOf(wheel)).toBe(STRAIGHT);
    expect(straight).toBeGreaterThan(wheel);
    expect(categoryOf(trips)).toBe(TRIPS);
    expect(categoryOf(twoPair)).toBe(TWO_PAIR);
    expect(describeValue(twoPair)).toBe('Zwei Paare, Asse und Könige');
    expect(categoryOf(pairHighKicker)).toBe(PAIR);
    expect(pairHighKicker).toBeGreaterThan(pairLowKicker);
    expect(categoryOf(highCard)).toBe(HIGH_CARD);

    const best = bestFive(['S1.1', 'S13.1', 'S12.1', 'S11.1', 'S10.1', 'D2.1', 'C3.1'] as CardId[]);
    expect(best.cards).toHaveLength(5);
    expect(best.value).toBe(royal);
  });
});

describe('Poker – Pots & Side-Pots', () => {
  test('zerlegt gestaffelte All-ins in Hauptpot und Side-Pots und verteilt ungerade Chips ab links vom Dealer', () => {
    // Platz 0: All-in 50, Platz 1: All-in 120, Platz 2: 200, Platz 3: nach 30 gepasst.
    const committed = [50, 120, 200, 30];
    const eligible = [true, true, true, false];
    const pots = buildPots(committed, eligible);

    // Gesamt = 400
    // Hauptpot (Level 50): 50 + 50 + 50 + 30 = 180 (Plätze 0, 1, 2)
    // Side-Pot 1 (Level 120): 70 + 70 = 140 (Plätze 1, 2)
    // Side-Pot 2 (Level 200): 80 (nur Platz 2)
    expect(pots).toEqual([
      { amount: 180, eligible: [0, 1, 2] },
      { amount: 140, eligible: [1, 2] },
      { amount: 80, eligible: [2] },
    ]);

    // Gleichstand im ungeraden Pot (amount 101) zwischen Platz 0 und Platz 2 bei Dealer = Platz 1 -> Platz 2 sitzt direkt links vom Dealer.
    const oddPot = [{ amount: 101, eligible: [0, 2] }];
    const settled = settlePots(oddPot, [500, 100, 500, null], 1, 4);
    expect(settled.winnings[2]).toBe(51);
    expect(settled.winnings[0]).toBe(50);
  });
});

describe('Poker – Setzrunden & Varianten-Strukturen', () => {
  test('Laufende Einsätze ohne All-in ergeben keinen Nebenpot', () => {
    const state = gameModule.setup(4, {}, 'pots-test');
    // Blinds sind gesetzt, die anderen haben noch nicht gehandelt: ein einziger Pot.
    const pots = currentPots(state);
    expect(pots).toHaveLength(1);
    expect(pots[0]!.amount).toBe(state.seats.reduce((sum, s) => sum + s.totalCommitted, 0));
    expect(pots[0]!.eligible).toHaveLength(4);
  });

  test('Heads-up: Dealer ist Small Blind und handelt vor dem Flop zuerst, ab dem Flop zuletzt', () => {
    const state = gameModule.setup(2, {}, 'headsup-test');
    expect(state.smallBlindSeat).toBe(state.button);
    expect(state.bigBlindSeat).toBe((state.button + 1) % 2);
    expect(state.actor).toBe(state.button);

    // SB/Dealer geht mit -> BB darf vor dem Flop noch schieben (Option).
    const afterCall = gameModule.applyMove(state, state.button, { type: 'call' }).state;
    expect(afterCall.street).toBe('preflop');
    expect(afterCall.actor).toBe(state.bigBlindSeat);

    // BB schiebt -> Flop wird aufgedeckt, BB handelt ab dem Flop zuerst!
    const afterCheck = gameModule.applyMove(afterCall, state.bigBlindSeat, { type: 'check' }).state;
    expect(afterCheck.street).toBe('flop');
    expect(afterCheck.board).toHaveLength(3);
    expect(afterCheck.actor).toBe(state.bigBlindSeat);
  });

  test('Pot Limit begrenzt die maximale Erhöhung auf die Potgröße', () => {
    const state = gameModule.setup(2, { structure: 'pl' }, 'potlimit-test');
    const actor = state.actor!;
    const bounds = raiseBounds(state, actor);
    // SB = 10, BB = 20 -> Pot = 30, toCall = 10 -> Pot nach Call = 40 -> Max Erhöhung auf 20 + 40 = 60.
    expect(bounds.minTo).toBe(40);
    expect(bounds.maxTo).toBe(60);
    expect(isLegal(state, actor, { type: 'raise', to: 60 })).toBe(true);
    expect(isLegal(state, actor, { type: 'raise', to: 80 })).toBe(false);
  });
});

describe('Poker – Im laufenden Betrieb hinzukommen und verlassen (ab nächster Hand)', () => {
  test('Spieler kann während einer laufenden Hand Platz nehmen, wartet bis zum Handende und wird in der nächsten Hand mitgedealt', () => {
    const session = new LocalSession(
      gameModule,
      {
        gameId: 'poker',
        seats: [
          { kind: 'human', name: 'Anna' },
          { kind: 'human', name: 'Ben' },
          { kind: 'human', name: 'Frei' },
          { kind: 'human', name: 'Frei' },
        ],
        options: { emptySeats: '2,3' },
        seed: 'midgame-join-seed',
        time: { kind: 'none' },
      },
      { botRunner: inlineBotRunner([gameModule]) },
    );

    expect(session.state.handNumber).toBe(1);
    expect(session.state.seats[2]?.status).toBe('empty');
    expect(session.canJoinSeat(2)).toBe(true);

    // Clara setzt sich mitten in Hand 1 auf Platz 2.
    expect(session.joinSeat(2, 'human', 'Clara')).toBe(true);
    expect(session.state.seats[2]?.status).toBe('waiting');
    expect(session.state.seats[2]?.inHand).toBe(false);
    expect(session.state.seats[2]?.chips).toBe(session.state.startChips);

    // Auch ein zusätzlicher 5. Stuhl (Index 4) kann im laufenden Betrieb geöffnet werden.
    expect(session.canJoinSeat(4)).toBe(true);
    expect(session.joinSeat(4, 'human', 'David')).toBe(true);
    expect(session.state.seats[4]?.status).toBe('waiting');

    // Schnappschuss + Wiederherstellung (Replay) behält die beigetretenen Plätze exakt bei.
    const restored = LocalSession.restore(gameModule, session.snapshot(), { botRunner: inlineBotRunner([gameModule]) });
    expect(restored.state.seats[2]?.status).toBe('waiting');
    expect(restored.state.seats[4]?.status).toBe('waiting');
    restored.dispose();

    // Aktueller Spieler passt -> Hand 1 endet sofort, Hand 2 beginnt automatisch!
    const current = session.currentSeats()[0]!;
    expect(session.submit(current, { type: 'fold' })).toBe(true);

    // In Hand 2 sind Clara (Platz 2) und David (Platz 4) aktiv und haben 2 Handkarten erhalten!
    expect(session.state.handNumber).toBe(2);
    expect(session.state.seats[2]?.status).toBe('active');
    expect(session.state.seats[2]?.inHand).toBe(true);
    expect(session.state.seats[2]?.holeCards).toHaveLength(2);
    expect(session.state.seats[4]?.status).toBe('active');
    expect(session.state.seats[4]?.inHand).toBe(true);
    expect(session.state.seats[4]?.holeCards).toHaveLength(2);

    // Jetzt verlässt Platz 2 (Clara) mitten in Hand 2 den Tisch -> ihre Hand wird gepasst, Platz 2 ist wieder frei.
    expect(session.canLeaveSeat(2)).toBe(true);
    expect(session.leaveSeat(2)).toBe(true);
    expect(session.state.seats[2]?.status).toBe('empty');
    expect(session.state.seats[2]?.folded).toBe(true);
    expect(session.canJoinSeat(2)).toBe(true);

    session.dispose();
  });
});

describe('Poker – Sound-Effekte & Ereignisse', () => {
  test('ordnet allen Poker-Ereignissen eigene, gültige Katalog-Klänge zu', () => {
    const map = gameUi.sounds!;
    expect(soundsForEvents([{ type: 'fold', seat: 0 }], map)).toEqual(['poker-fold']);
    expect(soundsForEvents([{ type: 'check', seat: 0 }], map)).toEqual(['poker-check']);
    expect(soundsForEvents([{ type: 'call', seat: 0, amount: 20 }], map)).toEqual(['poker-chips-call']);
    expect(soundsForEvents([{ type: 'bet', seat: 0, amount: 40 }], map)).toEqual(['poker-chips-bet']);
    expect(soundsForEvents([{ type: 'raise', seat: 0, to: 80 }], map)).toEqual(['poker-chips-bet']);
    expect(soundsForEvents([{ type: 'allIn', seat: 0, to: 1000 }], map)).toEqual(['poker-all-in', 'fs-auszahlung']);
    expect(soundsForEvents([{ type: 'street', street: 'flop' }], map)).toEqual(['drachen-karte-ziehen', 'karte-ziehen']);
    expect(soundsForEvents([{ type: 'street', street: 'turn' }], map)).toEqual(['drachen-karte-ziehen']);
    expect(soundsForEvents([{ type: 'handEnd', handNumber: 1, winners: [0], showdown: false }], map)).toEqual([
      'poker-pot',
      'paar',
    ]);
    expect(soundsForEvents([{ type: 'handEnd', handNumber: 1, winners: [0], showdown: true }], map)).toEqual([
      'aufdecken',
      'stapel-fertig',
      'poker-pot',
    ]);
    expect(soundsForEvents([{ type: 'eliminated', seats: [1] }], map)).toEqual(['leben-weg']);
    expect(soundsForEvents([{ type: 'blindLevelUp', level: 2, smallBlind: 15, bigBlind: 30 }], map)).toEqual(['schach']);
    expect(soundsForEvents([{ type: 'deal', handNumber: 2, button: 1 }], map)).toEqual(['fs-mischen']);
    expect(soundsForEvents([{ type: 'joined', seat: 2 }], map)).toEqual(['stein-heraus']);
    expect(soundsForEvents([{ type: 'left', seat: 2 }], map)).toEqual(['karte-legen']);

    // Bei einem All-in-Showdown mit Ausscheiden entsteht die vollständige Klangkette in der richtigen Reihenfolge.
    const showdownEvents = [
      { type: 'call', seat: 1, amount: 980 },
      { type: 'street', street: 'runout', count: 5 },
      { type: 'handEnd', handNumber: 1, winners: [0], showdown: true, eliminated: [1] },
      { type: 'eliminated', seats: [1] },
    ];
    const chain = soundsForEvents(showdownEvents, map);
    expect(chain).toEqual([
      'poker-chips-call',
      'drachen-karte-ziehen',
      'karte-ziehen',
      'aufdecken',
      'stapel-fertig',
      'poker-pot',
      'leben-weg',
    ]);
    for (const name of chain) {
      expect(soundCatalog[name]).toBeDefined();
    }
  });
});

