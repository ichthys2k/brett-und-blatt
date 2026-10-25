import { computeBotMove, resolveOptions, type BotLevel, type Options } from '@brett-und-blatt/engine';
import { gameContractChecks } from '@brett-und-blatt/engine/testing';
import { describe, expect, it, test } from 'vitest';
import { gameModule, PAIR_SETS, type PairsMove, type PairsState } from '../src';

const flip = (card: number): PairsMove => ({ type: 'flip', card });

function start(seats = 2, options: Options = {}, seed = 'test'): PairsState {
  return gameModule.setup(seats, resolveOptions(gameModule, options), seed);
}

function partnerOf(state: PairsState, card: number): number {
  return state.faces.findIndex((f, i) => i !== card && f?.pair === state.faces[card]?.pair);
}

function otherThan(state: PairsState, card: number): number {
  return state.faces.findIndex((f, i) => i !== card && f?.pair !== state.faces[card]?.pair);
}

describe('Kartensets', () => {
  it('haben genug eindeutige Paare für 36 Karten', () => {
    for (const set of Object.values(PAIR_SETS)) {
      expect(set.pairs.length).toBeGreaterThanOrEqual(18);
      expect(new Set(set.pairs.map((p) => p.a)).size).toBe(set.pairs.length);
      expect(new Set(set.pairs.map((p) => p.b)).size).toBe(set.pairs.length);
    }
  });
});

describe('Regeln', () => {
  it('jedes Paar liegt genau zweimal, wiederholbar aus dem Seed', () => {
    const state = start(2, { size: '36' });
    expect(state.faces).toHaveLength(36);
    const counts = new Map<number, number>();
    for (const f of state.faces) counts.set(f!.pair, (counts.get(f!.pair) ?? 0) + 1);
    expect([...counts.values()].every((c) => c === 2)).toBe(true);
    expect(start(2, { size: '36' })).toEqual(state);
  });

  it('ein Paar bringt einen Punkt und man ist noch einmal dran', () => {
    let state = start();
    const a = 0;
    state = gameModule.applyMove(state, 0, flip(a)).state;
    state = gameModule.applyMove(state, 0, flip(partnerOf(state, a))).state;
    expect(state.scores).toEqual([1, 0]);
    expect(state.turn).toBe(0);
  });

  it('mit der Option „Nächster ist dran“ wechselt der Zug auch nach einem Paar', () => {
    let state = start(2, { continueOnPair: 'off' });
    state = gameModule.applyMove(state, 0, flip(0)).state;
    state = gameModule.applyMove(state, 0, flip(partnerOf(state, 0))).state;
    expect(state.turn).toBe(1);
  });

  it('ein Fehlgriff bleibt offen liegen, bis der Nächste aufdeckt', () => {
    let state = start();
    state = gameModule.applyMove(state, 0, flip(0)).state;
    const other = otherThan(state, 0);
    state = gameModule.applyMove(state, 0, flip(other)).state;
    expect(state.turn).toBe(1);
    expect(state.open).toEqual([0, other]);
    const third = state.status.findIndex((s, i) => s === 'down' && i !== 0 && i !== other);
    state = gameModule.applyMove(state, 1, flip(third)).state;
    expect(state.status[0]).toBe('down');
    expect(state.open).toEqual([third]);
  });

  it('die Sicht verrät keine verdeckten Karten', () => {
    let state = start();
    state = gameModule.applyMove(state, 0, flip(3)).state;
    const view = gameModule.playerView(state, 1);
    expect(view.faces.filter((f) => f !== null)).toHaveLength(1);
    expect(view.faces[3]).toEqual(state.faces[3]);
  });

  it('Einzelspiel: alle Paare finden heißt gewinnen', () => {
    let state = start(1, { size: '12' });
    for (let card = 0; card < 12; card++) {
      if (typeof state.status[card] === 'object') continue;
      state = gameModule.applyMove(state, 0, flip(card)).state;
      state = gameModule.applyMove(state, 0, flip(partnerOf(state, card))).state;
    }
    expect(gameModule.result(state)).toEqual({ kind: 'win', winners: [0] });
    expect(state.turns).toBe(6);
  });
});

describe('Bot', () => {
  function botGame(levels: BotLevel[], seed: string): PairsState {
    let state = start(levels.length, { size: '24' }, seed);
    while (!gameModule.result(state)) {
      const seat = state.turn;
      const move = computeBotMove(gameModule, { gameId: 'pairs', botId: 'pairs', level: levels[seat]!, seat, view: gameModule.playerView(state, seat), seed: `${seed}/${state.step}`, timeBudgetMs: 10 }) as PairsMove;
      state = gameModule.applyMove(state, seat, move).state;
    }
    return state;
  }

  it('deckt ein bekanntes Paar auf', () => {
    let state = start();
    const other = otherThan(state, 0);
    state = gameModule.applyMove(state, 0, flip(0)).state;
    state = gameModule.applyMove(state, 0, flip(other)).state;
    // Jetzt ist Platz 1 dran und hat Karte 0 gesehen. Er deckt deren Partner auf – oder, falls er ihn kennt, das Paar.
    const partner = partnerOf(state, 0);
    state = gameModule.applyMove(state, 1, flip(partner)).state;
    const move = computeBotMove(gameModule, { gameId: 'pairs', botId: 'pairs', level: 'hard', seat: 1, view: gameModule.playerView(state, 1), seed: 'x', timeBudgetMs: 10 }) as PairsMove;
    expect(move.card).toBe(0);
  });

  it('der schwere Bot braucht im Schnitt weniger Züge als der leichte', () => {
    let easy = 0;
    let hard = 0;
    for (let g = 0; g < 8; g++) {
      easy += botGame(['easy'], `einzel${g}`).turns;
      hard += botGame(['hard'], `einzel${g}`).turns;
    }
    expect(hard).toBeLessThan(easy);
  });
});

describe('Vertrag für Spielmodule', () => {
  for (const check of gameContractChecks(gameModule, { randomGames: 10, seatCounts: [1, 2, 6] })) test(check.name, check.run);
});
