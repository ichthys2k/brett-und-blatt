import { computeBotMove, isLegalMove, type BotLevel } from '@brett-und-blatt/engine';
import { gameContractChecks } from '@brett-und-blatt/engine/testing';
import { describe, expect, it } from 'vitest';
import {
  checkQuestCondition,
  gameModule,
  hexKey,
  type GrafschaftMove,
  type GrafschaftState,
  type PlacedTile,
} from '../src';

describe('Grafschaft – Regeln und Spielmechanik', () => {
  it('initialisiert das Spiel korrekt', () => {
    const state = gameModule.setup(2, {}, 'test-seed');
    expect(state.seats).toBe(2);
    expect(state.turn).toBe(0);
    expect(Object.keys(state.board)).toHaveLength(1);
    expect(state.board['0,0']).toBeDefined();
    expect(state.board['0,0']!.type).toBe('wald');
    expect(state.market).toHaveLength(5);
    expect(state.playerQuests[0]).toHaveLength(3);
    expect(state.playerQuests[1]).toHaveLength(3);
    expect(state.scores).toEqual([0, 0]);
    expect(gameModule.result(state)).toBeNull();
  });

  it('erlaubt zu Beginn genau die 6 Nachbarfelder um das Startplättchen', () => {
    const state = gameModule.setup(2, {}, 'test-seed');
    const moves = gameModule.legalMoves(state, 0);
    // 5 Markt-Plättchen * 6 freie Nachbarfelder = 30 legale Züge
    expect(moves).toHaveLength(30);

    for (const move of moves) {
      expect(gameModule.isLegal!(state, 0, move)).toBe(true);
      expect(move.marketIndex).toBeGreaterThanOrEqual(0);
      expect(move.marketIndex).toBeLessThan(5);
    }
    // Spieler 1 ist nicht am Zug
    expect(gameModule.legalMoves(state, 1)).toHaveLength(0);
  });

  it('wertet Dorf-Vielfalt korrekt aus', () => {
    const state = gameModule.setup(2, {}, 'dorf-test');
    // Wir manipulieren den Jahrmarkt, sodass an Index 0 ein Dorf liegt
    state.market[0] = { id: 999, type: 'dorf' };
    // Startplättchen bei (0,0) ist 'wald'
    // Platziere das Dorf bei (1, 0) -> 1 verschiedener Nachbar ('wald')
    const move: GrafschaftMove = { type: 'place', marketIndex: 0, q: 1, r: 0 };
    const { state: nextState, events } = gameModule.applyMove(state, 0, move);

    expect(nextState.scores[0]).toBe(1);
    expect(nextState.villageScores[0]).toBe(1);
    expect(nextState.board['1,0']).toBeDefined();
    expect(nextState.board['1,0']!.type).toBe('dorf');
    expect(events.some((e) => e.type === 'villageScored')).toBe(true);
  });

  it('prüft Hofauftrag-Bedingungen zuverlässig', () => {
    const dummyBoard: Record<string, PlacedTile> = {
      [hexKey(0, 0)]: { id: 1, type: 'teich', q: 0, r: 0, owner: 0 },
      [hexKey(1, 0)]: { id: 2, type: 'teich', q: 1, r: 0, owner: 0 },
      [hexKey(2, 0)]: { id: 3, type: 'teich', q: 2, r: 0, owner: 0 },
    };
    // q1: mind. 3 Teiche zusammenhängend
    expect(checkQuestCondition('q1', dummyBoard)).toBe(true);

    // q18: Zwei Dörfer direkt benachbart
    expect(checkQuestCondition('q18', dummyBoard)).toBe(false);
    dummyBoard[hexKey(0, 1)] = { id: 4, type: 'dorf', q: 0, r: 1, owner: 0 };
    dummyBoard[hexKey(0, 2)] = { id: 5, type: 'dorf', q: 0, r: 2, owner: 0 };
    expect(checkQuestCondition('q18', dummyBoard)).toBe(true);

    // q2: Mühle am Fluss oder Teich
    dummyBoard[hexKey(-1, 0)] = { id: 6, type: 'feld', mill: true, q: -1, r: 0, owner: 0 };
    expect(checkQuestCondition('q2', dummyBoard)).toBe(true);
  });

  it('verhindert ungültige Züge', () => {
    const state = gameModule.setup(2, {}, 'illegal-test');
    // Feld bereits belegt
    expect(gameModule.isLegal!(state, 0, { type: 'place', marketIndex: 0, q: 0, r: 0 })).toBe(false);
    // Feld ohne Nachbarn
    expect(gameModule.isLegal!(state, 0, { type: 'place', marketIndex: 0, q: 5, r: 5 })).toBe(false);
    // Ungültiger Markt-Index
    expect(gameModule.isLegal!(state, 0, { type: 'place', marketIndex: 9, q: 1, r: 0 })).toBe(false);

    expect(() =>
      gameModule.applyMove(state, 0, { type: 'place', marketIndex: 9, q: 1, r: 0 }),
    ).toThrow();
  });

  it('wechselt die Spielerzüge ab', () => {
    let state = gameModule.setup(2, {}, 'turn-test');
    expect(state.turn).toBe(0);

    state = gameModule.applyMove(state, 0, { type: 'place', marketIndex: 0, q: 1, r: 0 }).state;
    expect(state.turn).toBe(1);

    state = gameModule.applyMove(state, 1, { type: 'place', marketIndex: 0, q: -1, r: 0 }).state;
    expect(state.turn).toBe(0);
  });
});

describe('Grafschaft – Bot „Landvogt“', () => {
  const playBotMatch = (level: BotLevel, seed: string) => {
    // Kurze Partie mit 40 Plättchen
    let state = gameModule.setup(2, { deckSize: '40' }, seed);
    let steps = 0;
    while (!gameModule.result(state) && steps < 60) {
      const seat = state.turn;
      const move = computeBotMove(gameModule, {
        gameId: 'grafschaft',
        botId: 'grafschaft',
        level,
        seat,
        view: gameModule.playerView(state, seat),
        seed: `${seed}/${steps}`,
        timeBudgetMs: 50,
      }) as GrafschaftMove;

      expect(isLegalMove(gameModule, state, seat, move)).toBe(true);
      state = gameModule.applyMove(state, seat, move).state;
      steps++;
    }
    return state;
  };

  it('spielt auf Stufe „easy“ fehlerfrei', () => {
    const finalState = playBotMatch('easy', 'bot-easy-seed');
    expect(finalState.moveCount).toBeGreaterThan(5);
  });

  it('spielt auf Stufe „medium“ fehlerfrei und sammelt Punkte', () => {
    const finalState = playBotMatch('medium', 'bot-medium-seed');
    expect(finalState.scores[0]! + finalState.scores[1]!).toBeGreaterThan(0);
  });

  it('spielt auf Stufe „hard“ fehlerfrei und erzielt solide Wertungen', () => {
    const finalState = playBotMatch('hard', 'bot-hard-seed');
    expect(finalState.scores[0]! + finalState.scores[1]!).toBeGreaterThan(0);
  });
});

describe('Vertrag für Spielmodule', () => {
  for (const check of gameContractChecks(gameModule)) {
    it(check.name, check.run);
  }
});
