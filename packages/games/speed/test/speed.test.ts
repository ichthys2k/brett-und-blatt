import { describe, expect, it, test } from 'vitest';
import { computeBotMove, createDeck, type BotLevel } from '@brett-und-blatt/engine';
import { gameContractChecks } from '@brett-und-blatt/engine/testing';
import { gameModule } from '../src';
import { applyMove, currentPlayers, fits, legalMoves, playerView, setup, type SpeedMove, type SpeedState } from '../src/rules';

describe('speed: allgemeine Prüfungen', () => {
  for (const check of gameContractChecks(gameModule, { randomGames: 12, maxMoves: 20_000, secretMoves: 600 })) test(check.name, check.run, 240_000);
});

/** Ein Tisch mit festgelegten Händen und Stapeln; der Rest bleibt wie ausgeteilt. */
function table(patch: { hands?: string[][]; draws?: string[][]; piles?: [string[], string[]]; sides?: [string[], string[]] }): SpeedState {
  const state = setup(2, {}, 'test');
  return {
    ...state,
    players: state.players.map((p, i) => ({ ...p, hand: patch.hands?.[i] ?? p.hand, draw: patch.draws?.[i] ?? p.draw })),
    piles: patch.piles ?? state.piles,
    sides: patch.sides ?? state.sides,
  };
}

describe('speed: Regeln', () => {
  it('teilt 5 + 15 je Spieler, 2 × 5 Seitenkarten und 2 Startkarten aus', () => {
    const state = setup(2, {}, 'a');
    for (const p of state.players) {
      expect(p.hand).toHaveLength(5);
      expect(p.draw).toHaveLength(15);
    }
    expect(state.sides.map((s) => s.length)).toEqual([5, 5]);
    expect(state.piles.map((s) => s.length)).toEqual([1, 1]);
    const all = [...state.players.flatMap((p) => [...p.hand, ...p.draw]), ...state.sides.flat(), ...state.piles.flat()];
    expect(new Set(all)).toEqual(new Set(createDeck()));
    expect(setup(2, {}, 'b').players[0]!.hand).not.toEqual(state.players[0]!.hand);
  });

  it('erlaubt nur einen Rang Abstand, Ass rund nur mit Option', () => {
    expect(fits('H5.1', 'S4.1', true)).toBe(true);
    expect(fits('H5.1', 'S6.1', true)).toBe(true);
    expect(fits('H5.1', 'S5.1', true)).toBe(false);
    expect(fits('H5.1', 'S7.1', true)).toBe(false);
    expect(fits('H1.1', 'S13.1', true)).toBe(true);
    expect(fits('H1.1', 'S13.1', false)).toBe(false);
    expect(fits('H13.1', 'S1.1', true)).toBe(true);
  });

  it('legt, füllt die Hand auf und löst „Festgefahren“ beim Gegner', () => {
    let state = table({ hands: [['H5.1', 'C9.1'], ['D2.1']], draws: [['C3.1', 'C4.1', 'C11.1', 'C12.1'], ['D3.1']], piles: [['S4.1'], ['S10.1']] });
    state = applyMove(state, 1, { type: 'stuck' }).state;
    expect(currentPlayers(state)).toEqual([0]);
    const plays = legalMoves(state, 0).filter((m) => m.type === 'play');
    expect(plays).toEqual([
      { type: 'play', card: 'H5.1', pile: 0 },
      { type: 'play', card: 'C9.1', pile: 1 },
    ]);
    const { state: next, events } = applyMove(state, 0, { type: 'play', card: 'H5.1', pile: 0 });
    expect(next.piles[0]).toEqual(['S4.1', 'H5.1']);
    expect(next.players[0]!.hand).toEqual(['C9.1', 'C3.1', 'C4.1', 'C11.1', 'C12.1']);
    expect(next.players[0]!.draw).toEqual([]);
    expect(next.players[1]!.stuck).toBe(false);
    expect(events).toContainEqual({ type: 'played', seat: 0, card: 'H5.1', pile: 0 });
    expect(() => applyMove(next, 0, { type: 'play', card: 'C12.1', pile: 0 })).toThrow();
  });

  it('weicht auf den anderen Stapel aus, wenn der gewünschte inzwischen nicht mehr passt', () => {
    const state = table({ hands: [['H5.1'], ['D3.1']], piles: [['S4.1'], ['S6.1']] });
    const after = applyMove(state, 1, { type: 'play', card: 'D3.1', pile: 0 }).state;
    // Platz 0 wollte auf Stapel 0 (jetzt 3), die 5 passt aber noch auf die 6.
    const { state: next } = applyMove(after, 0, { type: 'play', card: 'H5.1', pile: 0 });
    expect(next.piles[1]).toEqual(['S6.1', 'H5.1']);
  });

  it('deckt Seitenkarten auf, wenn beide festhängen, und mischt neu, wenn sie leer sind', () => {
    let state = table({ hands: [['H9.1'], ['D9.1']], piles: [['S2.1'], ['S3.1']], sides: [['C5.1'], ['C6.1']] });
    state = applyMove(state, 0, { type: 'stuck' }).state;
    const { state: flipped, events } = applyMove(state, 1, { type: 'stuck' });
    expect(flipped.piles).toEqual([['S2.1', 'C5.1'], ['S3.1', 'C6.1']]);
    expect(flipped.sides).toEqual([[], []]);
    expect(flipped.players.every((p) => !p.stuck)).toBe(true);
    expect(events.map((e) => e.type)).toContain('flipped');

    state = applyMove(flipped, 0, { type: 'stuck' }).state;
    const { state: reshuffled, events: ev2 } = applyMove(state, 1, { type: 'stuck' });
    expect(ev2.map((e) => e.type)).toEqual(['stuck', 'reshuffled', 'flipped']);
    // Unter den obersten Karten lagen nur S2 und S3 – je eine davon ist jetzt aufgedeckt.
    expect(reshuffled.piles.map((p) => p[0])).toEqual(['C5.1', 'C6.1']);
    expect([...reshuffled.piles[0].slice(1), ...reshuffled.piles[1].slice(1)].sort()).toEqual(['S2.1', 'S3.1']);
  });

  it('beendet die Runde, wenn Hand und Nachziehstapel leer sind, und startet die nächste', () => {
    let state = table({ hands: [['H5.1'], ['D9.1']], draws: [[], ['D10.1']], piles: [['S4.1'], ['S2.1']] });
    state = applyMove(state, 0, { type: 'play', card: 'H5.1', pile: 0 }).state;
    expect(state.phase).toBe('roundEnd');
    expect(state.players[0]!.wins).toBe(1);
    expect(state.lastRound).toEqual({ round: 1, winner: 0, left: [0, 2] });
    expect(gameModule.result(state)).toBeNull();
    state = applyMove(state, 0, { type: 'ready' }).state;
    expect(currentPlayers(state)).toEqual([1]);
    state = applyMove(state, 1, { type: 'ready' }).state;
    expect(state.phase).toBe('play');
    expect(state.round).toBe(2);
    expect(state.players[0]!.hand).toHaveLength(5);
  });

  it('eine Runde reicht bei „Eine Runde“', () => {
    const base = setup(2, { goal: 'r1' }, 'x');
    const state: SpeedState = { ...base, players: [{ ...base.players[0]!, hand: ['H5.1'], draw: [] }, base.players[1]!], piles: [['S4.1'], ['S2.1']] };
    const done = applyMove(state, 0, { type: 'play', card: 'H5.1', pile: 0 }).state;
    expect(gameModule.result(done)).toEqual({ kind: 'win', winners: [0] });
  });

  it('zeigt die Hände, verbirgt aber Nachzieh- und Seitenstapel', () => {
    const state = setup(2, {}, 'v');
    const view = playerView(state, 0);
    expect(view.players[1]!.hand).toEqual(state.players[1]!.hand);
    expect(view.players[1]!.drawCount).toBe(15);
    expect(view.sideCounts).toEqual([5, 5]);
    const json = JSON.stringify(view);
    for (const card of [...state.players[1]!.draw, ...state.sides[0]]) expect(json).not.toContain(`"${card}"`);
  });
});

/** Zwei Bots spielen eine Runde; gleichzeitige Züge werden hier einfach reihum ausgeführt. */
function botRound(levels: [BotLevel, BotLevel], seed: string): number {
  let state = setup(2, { goal: 'r1' }, seed);
  for (let step = 0; step < 5_000 && !gameModule.result(state); step++) {
    const actors = currentPlayers(state) as number[];
    const seat = actors[step % actors.length]!;
    const move = computeBotMove(gameModule, { gameId: 'speed', botId: 'flinker-finger', level: levels[seat]!, seat, view: playerView(state, seat), seed: `${seed}/${step}`, timeBudgetMs: 50 }) as SpeedMove;
    state = applyMove(state, seat, move).state;
  }
  const res = gameModule.result(state);
  expect(res?.kind).toBe('win');
  return res?.kind === 'win' ? res.winners[0]! : -1;
}

describe('speed: Bot', () => {
  it('spielt Runden zu Ende', () => {
    for (let g = 0; g < 10; g++) expect([0, 1]).toContain(botRound(['hard', 'easy'], `bot${g}`));
  });
});
