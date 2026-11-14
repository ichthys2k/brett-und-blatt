import { describe, expect, it, test } from 'vitest';
import { computeBotMove, createDeck, type BotLevel, type Options } from '@brett-und-blatt/engine';
import { gameContractChecks } from '@brett-und-blatt/engine/testing';
import { gameModule } from '../src';
import { applyMove, currentPlayers, fits, legalMoves, playerView, setup, type SpeedMove, type SpeedState } from '../src/rules';

describe('speed: allgemeine Prüfungen', () => {
  for (const check of gameContractChecks(gameModule, { randomGames: 12, maxMoves: 20_000, secretMoves: 600 })) test(check.name, check.run, 240_000);
});

/** Ein Tisch mit festgelegten Händen und Stapeln; der Rest bleibt wie ausgeteilt. */
function table(patch: {
  hands?: string[][];
  draws?: string[][];
  spitDown?: string[][][];
  piles?: string[][];
  sides?: [string[], string[]];
  options?: Options;
}): SpeedState {
  const state = setup(2, patch.options ?? {}, 'test');
  return {
    ...state,
    players: state.players.map((p, i) => ({
      ...p,
      hand: (patch.hands?.[i] as any) ?? p.hand,
      draw: (patch.draws?.[i] as any) ?? p.draw,
      spitDown: (patch.spitDown?.[i] as any) ?? p.spitDown,
    })),
    piles: (patch.piles as any) ?? state.piles,
    sides: (patch.sides as any) ?? state.sides,
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

  it('unterstützt manuelles Nachziehen von Hand', () => {
    let state = setup(2, { drawMode: 'manual' }, 'man');
    expect(state.drawMode).toBe('manual');
    // Beim Start hat jeder 5 Handkarten und 15 im Nachziehstapel
    expect(state.players[0]!.hand).toHaveLength(5);
    expect(legalMoves(state, 0).some((m) => m.type === 'draw')).toBe(false);

    // Wenn eine Karte gelegt wird, füllt sich die Hand nicht automatisch auf
    state = table({
      hands: [['H5.1', 'C9.1', 'D2.1', 'S8.1', 'C13.1'], ['D2.1']],
      draws: [['C3.1', 'C4.1'], ['D3.1']],
      piles: [['S4.1'], ['S10.1']],
      options: { drawMode: 'manual' },
    });
    const afterPlay = applyMove(state, 0, { type: 'play', card: 'H5.1', pile: 0 }).state;
    expect(afterPlay.players[0]!.hand).toHaveLength(4);
    expect(afterPlay.players[0]!.draw).toHaveLength(2);

    // Nun ist ein draw-Zug legal
    const moves = legalMoves(afterPlay, 0);
    expect(moves).toContainEqual({ type: 'draw' });

    const { state: afterDraw, events } = applyMove(afterPlay, 0, { type: 'draw' });
    expect(afterDraw.players[0]!.hand).toHaveLength(5);
    expect(afterDraw.players[0]!.hand[4]).toBe('C3.1');
    expect(afterDraw.players[0]!.draw).toHaveLength(1);
    expect(events).toContainEqual({ type: 'drew', seat: 0, card: 'C3.1' });
  });

  it('unterstützt die Variante Spit mit 5 Tableau-Spalten', () => {
    const state = setup(2, { variant: 'spit' }, 'spit1');
    expect(state.variant).toBe('spit');
    // Jeder Spieler hat 5 offene Karten in hand
    expect(state.players[0]!.hand).toHaveLength(5);
    expect(state.players[1]!.hand).toHaveLength(5);
    // Und die verdeckten Karten darunter in spitDown: [0, 1, 2, 3, 4]
    expect(state.players[0]!.spitDown.map((col) => col.length)).toEqual([0, 1, 2, 3, 4]);
    // Der Rest von 52 - 2 Mittelkarten - 30 Tableau = 20 Karten liegt je zur Hälfte (10) im Spit-Vorrat (draw)
    expect(state.players[0]!.draw).toHaveLength(10);

    // In playerView sind spitDownCounts enthalten
    const view = playerView(state, 0);
    expect(view.players[0]!.spitDownCounts).toEqual([0, 1, 2, 3, 4]);

    // Wenn die Karte aus Spalte 4 gelegt wird, deckt die oberste verdeckte Karte automatisch auf
    const fixed = table({
      hands: [['H5.1', 'C9.1', 'D2.1', 'S8.1', 'C6.1'], ['D2.1']],
      spitDown: [
        [[], ['S3.1'], ['S4.1', 'S5.1'], ['H7.1'], ['D7.1', 'D8.1']],
        [[], [], [], [], []],
      ],
      piles: [['S5.1'], ['S10.1']],
      options: { variant: 'spit' },
    });
    const { state: afterPlay } = applyMove(fixed, 0, { type: 'play', card: 'C6.1', pile: 0 });
    // D7.1 rückte an Stelle von C6.1 auf
    expect(afterPlay.players[0]!.hand[4]).toBe('D7.1');
    expect(afterPlay.players[0]!.spitDown[4]).toEqual(['D8.1']);
  });

  it('unterstützt 3 und 4 Spieler mit 4 Ablagestapeln und 2 Decks', () => {
    const state4 = setup(4, {}, 'quad');
    expect(state4.players).toHaveLength(4);
    expect(state4.piles).toHaveLength(4);
    // Gesamt 104 Karten
    const all = [
      ...state4.players.flatMap((p) => [...p.hand, ...p.draw, ...p.spitDown.flat()]),
      ...state4.sides.flat(),
      ...state4.piles.flat(),
    ];
    expect(all).toHaveLength(104);
    expect(new Set(all).size).toBe(104);
  });
});

/** Bots spielen eine Runde; gleichzeitige Züge werden hier einfach reihum ausgeführt. */
function botRound(levels: BotLevel[], seed: string, options?: Options): number {
  let state = setup(levels.length, { goal: 'r1', ...(options ?? {}) }, seed);
  for (let step = 0; step < 5_000 && !gameModule.result(state); step++) {
    const actors = currentPlayers(state) as number[];
    const seat = actors[step % actors.length]!;
    const move = computeBotMove(gameModule, {
      gameId: 'speed',
      botId: 'flinker-finger',
      level: levels[seat]!,
      seat,
      view: playerView(state, seat),
      seed: `${seed}/${step}`,
      timeBudgetMs: 50,
    }) as SpeedMove;
    state = applyMove(state, seat, move).state;
  }
  const res = gameModule.result(state);
  expect(res?.kind).toBe('win');
  return res?.kind === 'win' ? res.winners[0]! : -1;
}

describe('speed: Bot', () => {
  it('spielt Runden zu Ende (2 Spieler)', () => {
    for (let g = 0; g < 6; g++) expect([0, 1]).toContain(botRound(['hard', 'easy'], `bot${g}`));
  });

  it('spielt Runden mit manuellem Nachziehen und Spit zu Ende', () => {
    expect([0, 1]).toContain(botRound(['hard', 'medium'], 'bot-man', { drawMode: 'manual' }));
    expect([0, 1]).toContain(botRound(['medium', 'easy'], 'bot-spit', { variant: 'spit' }));
  });

  it('spielt 4-Spieler-Runden zu Ende', () => {
    expect([0, 1, 2, 3]).toContain(botRound(['hard', 'medium', 'easy', 'medium'], 'bot4p'));
  });
});
