import { describe, expect, it, test } from 'vitest';
import { Rng, computeBotMove } from '@brett-und-blatt/engine';
import { gameContractChecks } from '@brett-und-blatt/engine/testing';
import { gameModule } from '../src';
import { applyMove, fullDeck, legalMoves, playerView, rowSize, sampleHidden, setup, totals, type Card, type LigrettoState } from '../src/rules';

describe('ligretto: allgemeine Prüfungen', () => {
  // Lange Echtzeitpartien mit bis zu acht Plätzen: Die Geheimnis-Prüfung prüft nur die ersten
  // 600 Züge (secretMoves) und bekommt trotzdem mehr Zeit als der allgemeine Grenzwert.
  for (const check of gameContractChecks(gameModule, { randomGames: 12, maxMoves: 20_000, secretMoves: 600 })) test(check.name, check.run, 240_000);
});

function card(owner: number, suit: Card['suit'], value: number): Card {
  return { id: `${owner}-${suit}-${value}`, suit, value, owner };
}

/** Ein Tisch mit festgelegten Karten für Platz 0; Platz 1 bekommt sein normales Blatt. */
function table(p0: Partial<LigrettoState['players'][number]>): LigrettoState {
  const state = setup(2, {}, 'test');
  return { ...state, players: [{ ...state.players[0]!, ...p0 }, state.players[1]!] };
}

describe('ligretto: Regeln', () => {
  it('teilt nach Spielerzahl aus und mischt mit dem Seed', () => {
    for (const seats of [2, 3, 4, 8]) {
      const state = setup(seats, {}, 'a');
      for (const p of state.players) {
        expect(p.ligretto).toHaveLength(10);
        expect(p.row).toHaveLength(rowSize(seats));
        expect(p.ligretto.length + p.row.length + p.hand.length).toBe(40);
      }
    }
    expect(rowSize(2)).toBe(5);
    expect(rowSize(3)).toBe(4);
    expect(rowSize(5)).toBe(3);
    expect(setup(2, {}, 'a').players[0]!.ligretto).not.toEqual(setup(2, {}, 'b').players[0]!.ligretto);
  });

  it('beginnt Stapel nur mit einer 1 und legt in gleicher Farbe weiter', () => {
    let state = table({ ligretto: [card(0, 'red', 2), card(0, 'blue', 7)], row: [card(0, 'red', 1), card(0, 'green', 5)], hand: [], talon: [] });
    expect(legalMoves(state, 0).filter((m) => m.type === 'play')).toEqual([{ type: 'play', source: { from: 'row', slot: 0 }, pile: null }]);
    state = applyMove(state, 0, { type: 'play', source: { from: 'row', slot: 0 }, pile: null }).state;
    // Die Lücke füllt der Ligretto-Stapel.
    expect(state.players[0]!.row[0]).toEqual(card(0, 'red', 2));
    expect(state.players[0]!.ligretto).toEqual([card(0, 'blue', 7)]);
    const pile = state.center[0]!.id;
    expect(legalMoves(state, 0)).toContainEqual({ type: 'play', source: { from: 'row', slot: 0 }, pile });
    expect(() => applyMove(state, 0, { type: 'play', source: { from: 'row', slot: 1 }, pile })).toThrow();
  });

  it('räumt volle Stapel ab', () => {
    let state = table({ ligretto: [card(0, 'red', 10), card(0, 'blue', 2), card(0, 'blue', 3)] });
    const reds = Array.from({ length: 9 }, (_, i) => card(1, 'red', i + 1));
    state = { ...state, center: [{ id: 4, suit: 'red', cards: reds }], nextPileId: 5 };
    const { state: next, events } = applyMove(state, 0, { type: 'play', source: { from: 'ligretto' }, pile: 4 });
    expect(next.center).toEqual([]);
    expect(next.cleared).toHaveLength(10);
    expect(events.map((e) => e.type)).toContain('pileCleared');
  });

  it('blättert in Dreierschritten um und dreht den Talon wieder um', () => {
    const hand = [card(0, 'red', 5), card(0, 'red', 6), card(0, 'red', 7), card(0, 'red', 8)];
    let state = table({ hand, talon: [] });
    state = applyMove(state, 0, { type: 'flip' }).state;
    expect(state.players[0]!.talon.map((c) => c.value)).toEqual([5, 6, 7]);
    state = applyMove(state, 0, { type: 'flip' }).state;
    expect(state.players[0]!.hand).toEqual([]);
    state = applyMove(state, 0, { type: 'flip' }).state;
    expect(state.players[0]!.talon.map((c) => c.value)).toEqual([5, 6, 7]);
    expect(state.players[0]!.hand.map((c) => c.value)).toEqual([8]);
  });

  it('löst einen Stillstand, wenn alle festhängen', () => {
    let state = setup(2, {}, 'stau');
    const top = state.players[0]!.ligretto[0];
    state = applyMove(state, 0, { type: 'stuck' }).state;
    expect(legalMoves(state, 0)).toEqual([]);
    expect(gameModule.currentPlayers(state)).toEqual([1]);
    const { state: next, events } = applyMove(state, 1, { type: 'stuck' });
    expect(events.map((e) => e.type)).toContain('unjammed');
    expect(next.players.every((p) => !p.stuck)).toBe(true);
    expect(next.players[0]!.ligretto.at(-1)).toEqual(top);
  });

  it('hat immer einen Zug, solange gespielt wird', () => {
    const state = table({ hand: [], talon: [], row: [card(0, 'red', 9)], ligretto: [card(0, 'red', 8)] });
    expect(legalMoves(state, 0)).toEqual([{ type: 'stuck' }]);
  });

  it('beendet die Runde mit leerem Ligretto-Stapel und wertet +1 / −2', () => {
    let state = table({ ligretto: [card(0, 'yellow', 1)], played: 6 });
    state = { ...state, players: [state.players[0]!, { ...state.players[1]!, played: 3 }] };
    const { state: next, events } = applyMove(state, 0, { type: 'play', source: { from: 'ligretto' }, pile: null });
    expect(events.map((e) => e.type)).toContain('ligretto');
    expect(next.phase).toBe('roundEnd');
    expect(next.lastRound?.points).toEqual([7, 3 - 2 * 10]);
    expect(totals(next.scores)).toEqual([7, -17]);
  });

  it('startet die nächste Runde, wenn alle bereit sind, und endet nach der Rundenzahl', () => {
    let state: LigrettoState = { ...setup(2, { goal: 'r3' }, 'runden'), phase: 'roundEnd' };
    state = applyMove(state, 0, { type: 'ready' }).state;
    expect(state.phase).toBe('roundEnd');
    state = applyMove(state, 1, { type: 'ready' }).state;
    expect(state.phase).toBe('play');
    expect(state.round).toBe(2);
    const last = { ...state, round: 3, players: [{ ...state.players[0]!, ligretto: [card(0, 'red', 1)] }, state.players[1]!] };
    const end = applyMove(last, 0, { type: 'play', source: { from: 'ligretto' }, pile: null }).state;
    expect(end.phase).toBe('gameEnd');
    expect(gameModule.result(end)).toEqual({ kind: 'win', winners: [0] });
  });

  it('weicht bei gleichzeitigen Zügen auf einen anderen passenden Stapel aus oder lehnt ab', () => {
    // Beide wollen eine rote 2 auf denselben Stapel legen – der zweite landet auf dem anderen roten Stapel.
    let state = setup(2, {}, 'wettlauf');
    state = {
      ...state,
      center: [
        { id: 0, suit: 'red', cards: [card(1, 'red', 1)] },
        { id: 1, suit: 'red', cards: [card(0, 'red', 1)] },
      ],
      nextPileId: 2,
      players: [
        { ...state.players[0]!, ligretto: [card(0, 'red', 2), card(0, 'blue', 4)] },
        { ...state.players[1]!, ligretto: [card(1, 'red', 2), card(1, 'blue', 4)] },
      ],
    };
    const move = { type: 'play', source: { from: 'ligretto' }, pile: 0 } as const;
    state = applyMove(state, 1, move).state;
    expect(gameModule.isLegal!(state, 0, move)).toBe(true);
    state = applyMove(state, 0, move).state;
    expect(state.center.find((p) => p.id === 1)!.cards.map((c) => c.id)).toEqual(['0-red-1', '0-red-2']);
    // Jetzt passt keine rote 2 mehr.
    const late = { ...state, players: [{ ...state.players[0]!, ligretto: [card(0, 'red', 2)] }, state.players[1]!] };
    expect(gameModule.isLegal!(late, 0, move)).toBe(false);
  });

  it('verrät in der Sicht keine Reihenfolge verdeckter Karten', () => {
    const state = setup(3, {}, 'sicht');
    const view = playerView(state, 1);
    expect(JSON.stringify(view)).not.toContain(state.players[0]!.hand[0]!.id);
    expect(JSON.stringify(view)).not.toContain(state.players[0]!.ligretto[1]!.id);
    expect('rng' in view).toBe(false);
    const sampled = sampleHidden(view, 1, Rng.fromSeed('x'));
    for (const [i, p] of sampled.players.entries()) {
      const ids = [...p.ligretto, ...p.row, ...p.hand, ...p.talon].map((c) => c!.id).sort();
      expect(ids).toEqual(fullDeck(i).map((c) => c.id).sort());
    }
  });

  it('der Bot legt lieber aus dem Ligretto-Stapel', () => {
    const state = table({ ligretto: [card(0, 'red', 1), card(0, 'blue', 3)], row: [card(0, 'green', 1)] });
    const move = computeBotMove(gameModule, {
      gameId: 'ligretto',
      botId: 'flinke-hand',
      level: 'hard',
      seat: 0,
      view: playerView(state, 0),
      seed: 'bot',
      timeBudgetMs: 10,
    });
    expect(move).toEqual({ type: 'play', source: { from: 'ligretto' }, pile: null });
  });
});
