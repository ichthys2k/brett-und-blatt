import { LocalSession, computeBotMove, inlineBotRunner, resolveOptions, type BotLevel, type Options, type SeatId } from '@brett-und-blatt/engine';
import { gameContractChecks } from '@brett-und-blatt/engine/testing';
import { describe, expect, it, test } from 'vitest';
import { CALLER, PACKS, callOf, columnOf, drawnIds, faceOf, gameModule, missing, type BingoMove, type BingoState } from '../src';

function start(seats = 2, options: Options = {}, seed = 'test'): BingoState {
  return gameModule.setup(seats, resolveOptions(gameModule, options), seed);
}

const apply = (state: BingoState, seat: SeatId, move: BingoMove) => gameModule.applyMove(state, seat, move);

/** Legt fest, was als Nächstes gezogen wird, und zieht es. */
function drawIds(state: BingoState, ids: number[]): BingoState {
  const rest = state.order.slice(state.drawn).filter((id) => !ids.includes(id));
  let next: BingoState = { ...state, order: [...state.order.slice(0, state.drawn), ...ids, ...rest] };
  for (let i = 0; i < ids.length; i++) next = apply(next, CALLER, { type: 'draw' }).state;
  return next;
}

/** Zieht die Einträge der Felder `cells` von Platz `seat` und markiert sie dort. */
function fill(state: BingoState, seat: SeatId, cells: number[]): BingoState {
  const card = state.cards[seat]!;
  let next = drawIds(state, cells.map((i) => card[i]).filter((id): id is number => id !== null));
  for (const cell of cells) if (card[cell] !== null) next = apply(next, seat, { type: 'mark', cell }).state;
  return next;
}

describe('Karten und Ziehung', () => {
  it('Zahlenkarten: Spalten im richtigen Bereich, keine doppelten Zahlen, freies Mittelfeld', () => {
    const state = start(30);
    for (const card of state.cards) {
      expect(card).toHaveLength(25);
      expect(card[12]).toBeNull();
      const numbers = card.filter((n): n is number => n !== null);
      expect(new Set(numbers).size).toBe(24);
      card.forEach((n, i) => n !== null && expect(columnOf(n)).toBe(i % 5));
    }
    expect(new Set(state.cards.map((c) => c.join())).size).toBe(30);
  });

  it('zieht ohne Wiederholung; nach 75 Ziehungen ist alles gezogen', () => {
    let state = start(1);
    for (let i = 0; i < 75; i++) state = apply(state, CALLER, { type: 'draw' }).state;
    expect(new Set(drawnIds(state)).size).toBe(75);
    expect(gameModule.legalMoves(state, CALLER).some((m) => m.type === 'draw')).toBe(false);
  });

  it('nur die Spielleitung (Platz 1) zieht', () => {
    const state = start(3);
    expect(gameModule.legalMoves(state, 0)).toEqual([{ type: 'draw' }]);
    expect(gameModule.legalMoves(state, 1)).toEqual([]);
    expect(() => apply(state, 1, { type: 'draw' })).toThrow();
  });

  it('eine Spielleitung, die nur zieht, hat keine Karte und kann nicht gewinnen', () => {
    const state = start(3, { caller: 'leads' });
    expect(state.cards[0]).toEqual([]);
    expect(state.cards[1]).toHaveLength(25);
    // Allein muss sie mitspielen.
    expect(start(1, { caller: 'leads' }).cards[0]).toHaveLength(25);
  });

  it('Sicht verrät keine ungezogenen Einträge', () => {
    const state = drawIds(start(2), [5, 17]);
    const view = gameModule.playerView(state, 1);
    expect(view.order).toEqual([5, 17]);
    expect(gameModule.playerView(state, 'spectator').order).toEqual([5, 17]);
  });
});

describe('Markieren und Bingo', () => {
  it('markieren geht nur bei gezogenen Einträgen; am Zug ist nur, wer etwas zu tun hat', () => {
    let state = start(2);
    const card = state.cards[1]!;
    expect(gameModule.currentPlayers(state)).toEqual([0]);
    expect(() => apply(state, 1, { type: 'mark', cell: 0 })).toThrow();
    state = drawIds(state, [card[0]!]);
    expect(gameModule.currentPlayers(state)).toContain(1);
    expect(gameModule.legalMoves(state, 1)).toEqual([{ type: 'mark', cell: 0 }, { type: 'bingo' }]);
    const marked = apply(state, 1, { type: 'mark', cell: 0 });
    expect(marked.events).toEqual([{ type: 'marked', seat: 1, cell: 0 }]);
    state = marked.state;
    expect(gameModule.currentPlayers(state)).not.toContain(1);
  });

  it('eventView: Markierungen erfährt nur der jeweilige Spieler', () => {
    const event = { type: 'marked', seat: 1, cell: 4 };
    expect(gameModule.eventView!(event, 1)).toEqual(event);
    expect(gameModule.eventView!(event, 2)).toBeNull();
    expect(gameModule.eventView!(event, 'spectator')).toBeNull();
    const drawn = { type: 'drawn', id: 5, count: 1 };
    expect(gameModule.eventView!(drawn, 2)).toEqual(drawn);
  });

  it('erkennt jede Reihe: waagrecht, senkrecht und beide Diagonalen', () => {
    const lines = [
      [0, 1, 2, 3, 4],
      [10, 11, 12, 13, 14],
      [2, 7, 12, 17, 22],
      [0, 6, 12, 18, 24],
      [4, 8, 12, 16, 20],
    ];
    for (const line of lines) {
      const state = fill(start(2), 1, line);
      expect(missing(state, 1)).toBe(0);
      const after = apply(state, 1, { type: 'bingo' });
      expect(after.events[0]).toMatchObject({ type: 'bingo', valid: true, winners: [1] });
      expect(gameModule.result(after.state)).toEqual({ kind: 'win', winners: [1], reason: 'bingo' });
    }
  });

  it('zwei Reihen, vier Ecken und volle Karte', () => {
    let state = fill(start(2, { goal: 'twoLines' }), 1, [0, 1, 2, 3, 4]);
    // Die Diagonale durch das freie Mittelfeld braucht nur noch drei.
    expect(missing(state, 1)).toBe(3);
    state = fill(state, 1, [6, 18, 24]);
    expect(missing(state, 1)).toBe(0);

    state = fill(start(2, { goal: 'corners' }), 1, [0, 4, 20]);
    expect(missing(state, 1)).toBe(1);
    expect(missing(fill(state, 1, [24]), 1)).toBe(0);

    state = fill(start(2, { goal: 'full' }), 1, [0, 1, 2, 3, 4]);
    expect(missing(state, 1)).toBe(19);
  });

  it('falsches Bingo: aussetzen bis zur nächsten Ziehung', () => {
    let state = fill(start(2), 1, [0, 1]);
    state = drawIds(state, [state.cards[1]![2]!]);
    const called = apply(state, 1, { type: 'bingo' });
    expect(called.events[0]).toMatchObject({ type: 'bingo', valid: false, penalty: 'pause' });
    state = called.state;
    expect(gameModule.legalMoves(state, 1)).toEqual([{ type: 'mark', cell: 2 }]);
    state = drawIds(state, [state.cards[1]![3]!]);
    expect(gameModule.legalMoves(state, 1)).toContainEqual({ type: 'bingo' });
  });

  it('falsches Bingo: ausscheiden oder ohne Folgen', () => {
    let state = fill(start(3, { falseCall: 'out' }), 1, [0]);
    state = drawIds(state, [state.cards[1]![1]!]);
    state = apply(state, 1, { type: 'bingo' }).state;
    expect(state.out[1]).toBe(true);
    expect(gameModule.legalMoves(state, 1)).toEqual([]);

    state = start(2, { falseCall: 'none' });
    state = drawIds(state, [state.cards[1]![0]!]);
    state = apply(state, 1, { type: 'bingo' }).state;
    expect(gameModule.legalMoves(state, 1)).toContainEqual({ type: 'bingo' });
  });

  it('scheiden alle aus, gewinnt niemand', () => {
    let state = start(2, { falseCall: 'out', caller: 'leads' });
    state = drawIds(state, [state.cards[1]![0]!]);
    state = apply(state, 1, { type: 'bingo' }).state;
    expect(gameModule.result(state)).toEqual({ kind: 'loss', reason: 'out' });
  });

  it('wer zur selben Ziehung ebenfalls fertig ist, gewinnt mit – auch ohne Markierung', () => {
    let state = start(3);
    const row1 = state.cards[1]!.slice(0, 5) as number[];
    const row2 = state.cards[2]!.slice(5, 10) as number[];
    state = drawIds(state, [...row1, ...row2]);
    for (let cell = 0; cell < 5; cell++) state = apply(state, 1, { type: 'mark', cell }).state;
    const after = apply(state, 1, { type: 'bingo' });
    expect(gameModule.result(after.state)).toMatchObject({ kind: 'win', winners: [1, 2] });
  });

  it('nur markierte Felder zählen für den eigenen Ruf', () => {
    let state = start(2);
    state = drawIds(state, state.cards[1]!.slice(0, 5) as number[]);
    // Vier: Die Diagonale durch das freie Mittelfeld ist am nächsten dran.
    expect(missing(state, 1)).toBe(4);
    expect(missing(state, 1, 'drawn')).toBe(0);
    expect(apply(state, 1, { type: 'bingo' }).events[0]).toMatchObject({ valid: false });
  });

  it('automatisch markieren: Die Karte markiert sich bei jeder Ziehung selbst', () => {
    let state = start(2, { marking: 'auto' });
    state = drawIds(state, state.cards[1]!.slice(0, 4) as number[]);
    expect(state.marks[1]!.slice(0, 4)).toEqual([true, true, true, true]);
    expect(gameModule.currentPlayers(state)).toEqual([0]);
    state = drawIds(state, [state.cards[1]![4]!]);
    expect(gameModule.legalMoves(state, 1)).toEqual([{ type: 'bingo' }]);
  });
});

describe('Lern-Bingo', () => {
  it('die Kartenseiten jedes Pakets sind eindeutig und reichen für 5 × 5', () => {
    for (const pack of Object.values(PACKS)) {
      expect(new Set(pack.pairs.map((p) => p.b)).size).toBe(pack.pairs.length);
      expect(pack.pairs.length).toBeGreaterThanOrEqual(24);
    }
  });

  it('Karten aus b-Seiten, Ansagen aus den passenden a-Seiten', () => {
    const state = start(4, { content: 'einmaleins', size: '3' });
    expect(state.size).toBe(3);
    expect(state.total).toBe(PACKS.einmaleins!.pairs.length);
    for (const card of state.cards) {
      expect(card).toHaveLength(9);
      expect(card[4]).toBeNull();
    }
    const id = state.cards[1]![0]!;
    expect(faceOf('einmaleins', id)).toBe(PACKS.einmaleins!.pairs[id]!.b);
    expect(callOf('einmaleins', id)).toBe(PACKS.einmaleins!.pairs[id]!.a);
    expect(callOf('zahlen', 7)).toBe('B 7');
    expect(callOf('zahlen', 75)).toBe('O 75');
  });

  it('4 × 4 hat kein freies Feld', () => {
    const state = start(2, { content: 'tiere', size: '4' });
    expect(state.cards[0]!.every((id) => id !== null)).toBe(true);
  });
});

describe('Bot', () => {
  const choose = (state: BingoState, seat: SeatId, level: BotLevel = 'hard') =>
    computeBotMove(gameModule, { gameId: 'bingo', botId: 'bingo', level, seat, view: gameModule.playerView(state, seat), seed: 's', timeBudgetMs: 10 }) as BingoMove;

  it('„schwer“ ruft Bingo bei der ersten gültigen Ziehung und nie falsch', () => {
    for (const level of ['easy', 'medium', 'hard'] as const) {
      let state = start(2);
      for (let step = 0; !gameModule.result(state); step++) {
        expect(step).toBeLessThan(500);
        for (const seat of gameModule.currentPlayers(state)) {
          if (gameModule.result(state)) break;
          if (typeof seat !== 'number') continue;
          const move = choose(state, seat, level);
          if (move.type === 'bingo') expect(missing(state, seat)).toBe(0);
          if (seat === 1 && move.type !== 'bingo') expect(missing(state, 1)).toBeGreaterThan(0);
          state = apply(state, seat, move).state;
        }
      }
      expect(gameModule.result(state)?.kind).toBe('win');
    }
  });

  it('als Spielleitung zieht der Bot mit Pause – nicht alle Zahlen auf einmal', async () => {
    let time = 0;
    const session = new LocalSession(
      gameModule,
      {
        gameId: 'bingo',
        seats: [
          { kind: 'bot', name: 'Ansager', level: 'hard' },
          { kind: 'human', name: 'Anna' },
        ],
        options: resolveOptions(gameModule, { caller: 'leads' }),
        seed: 'pause',
        time: { kind: 'none' },
      },
      { botRunner: inlineBotRunner([gameModule]), now: () => time },
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(session.state.drawn).toBe(0);
    const due = session.nextDeadline()!;
    expect(due).toBeGreaterThanOrEqual(6_000);
    time = due;
    session.tick();
    expect(session.state.drawn).toBe(1);
    session.dispose();
  });
});

for (const check of gameContractChecks(gameModule, { seatCounts: [1, 2, 30], randomGames: 30, maxMoves: 5_000 })) test(check.name, check.run, 60_000);
