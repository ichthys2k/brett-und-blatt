import { computeBotMove, type BotLevel } from '@brett-und-blatt/engine';
import { gameContractChecks } from '@brett-und-blatt/engine/testing';
import { describe, expect, it, test } from 'vitest';
import {
  MEADOW,
  MOLE_ROUTE,
  TURNIP,
  fenceBehind,
  fullDeck,
  gameModule,
  hillField,
  targetOf,
  type Card,
  type TurnipMove,
  type TurnipState,
} from '../src';

function withDeck(state: TurnipState, deck: Card[]): TurnipState {
  return { ...state, deck };
}

export function botGame(levels: BotLevel[], seed: string, botIds?: string[], options = {}) {
  let state = gameModule.setup(levels.length, options, seed);
  let step = 0;
  for (; !gameModule.result(state); step++) {
    const seat = state.turn;
    const move = computeBotMove(gameModule, {
      gameId: 'turnip-patch',
      botId: botIds?.[seat] ?? 'turnip-patch',
      level: levels[seat]!,
      seat,
      view: gameModule.playerView(state, seat),
      seed: `${seed}/${step}`,
      timeBudgetMs: 50,
    }) as TurnipMove;
    state = gameModule.applyMove(state, seat, move).state;
  }
  return { result: gameModule.result(state), moves: step };
}

describe('Regeln', () => {
  it('Kartensatz mit 28 Karten, Hasen auf der Wiese', () => {
    expect(fullDeck()).toHaveLength(28);
    const state = gameModule.setup(4, {}, 'x');
    expect(state.hares).toEqual([[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]]);
    expect(gameModule.setup(2, { hares: '1' }, 'x').hares).toEqual([[0], [0]]);
  });

  it('Zahlenkarte: Hase wählen, besetzte Felder zählen nicht mit', () => {
    let state = withDeck(gameModule.setup(2, {}, 'x'), [2, 1]);
    state = { ...state, hares: [[0, 0, 0], [1, 0, 0]] };
    state = gameModule.applyMove(state, 0, { type: 'draw' }).state;
    expect(state.card).toBe(2);
    expect(gameModule.legalMoves(state, 0)).toHaveLength(3);
    // Feld 1 ist besetzt und wird übersprungen: 2 Schritte führen auf Feld 3.
    expect(targetOf(state, 0, 2)).toBe(3);
    state = gameModule.applyMove(state, 0, { type: 'hop', hare: 0 }).state;
    expect(state.hares[0]).toEqual([3, 0, 0]);
    expect(state.turn).toBe(1);
  });

  it('über das letzte Feld hinaus geht es an die Rübe und gewinnt', () => {
    let state = withDeck(gameModule.setup(2, {}, 'x'), [3]);
    state = { ...state, hares: [[23, 0, 0], [0, 0, 0]] };
    state = gameModule.applyMove(state, 0, { type: 'draw' }).state;
    state = gameModule.applyMove(state, 0, { type: 'hop', hare: 0 }).state;
    expect(state.hares[0]![0]).toBe(TURNIP);
    expect(gameModule.result(state)).toEqual({ kind: 'win', winners: [0] });
  });

  it('Maulwurf: Hase am Hügel fällt zum Zaunpfahl, der Hügel wandert weiter', () => {
    let state = withDeck(gameModule.setup(2, {}, 'x'), ['mole']);
    const hole = hillField(state);
    expect(hole).toBe(MOLE_ROUTE[0]);
    state = { ...state, hares: [[hole, 2, 0], [hole + 1, 0, 0]] };
    const { state: after, events } = gameModule.applyMove(state, 0, { type: 'draw' });
    expect(after.hares[0]).toEqual([fenceBehind(hole), 2, 0]);
    expect(after.hares[1]).toEqual([hole + 1, 0, 0]);
    expect(hillField(after)).toBe(MOLE_ROUTE[1]);
    expect(after.turn).toBe(1);
    expect(events.some((e) => e.type === 'mole')).toBe(true);
  });

  it('streng: zurück auf die Wiese', () => {
    let state = withDeck(gameModule.setup(2, { fall: 'start' }, 'x'), ['mole']);
    state = { ...state, hares: [[hillField(state), 0, 0], [0, 0, 0]] };
    expect(gameModule.applyMove(state, 0, { type: 'draw' }).state.hares[0]![0]).toBe(MEADOW);
  });

  it('leerer Stapel wird aus den gezogenen Karten neu gemischt', () => {
    let state = gameModule.setup(2, {}, 'x');
    state = { ...state, deck: [], discard: fullDeck() };
    state = gameModule.applyMove(state, 0, { type: 'draw' }).state;
    expect(state.deck).toHaveLength(27);
    expect(state.discard).toHaveLength(1);
  });

  it('alle Hasen ins Ziel als Option', () => {
    let state = withDeck(gameModule.setup(2, { goal: 'all' }, 'x'), [3]);
    state = { ...state, hares: [[23, TURNIP, 2], [0, 0, 0]] };
    state = gameModule.applyMove(state, 0, { type: 'draw' }).state;
    expect(gameModule.legalMoves(state, 0)).toHaveLength(2);
    state = gameModule.applyMove(state, 0, { type: 'hop', hare: 0 }).state;
    expect(gameModule.result(state)).toBeNull();
  });
});

describe('Bot', () => {
  it('„schwer“ schlägt Zufall und „leicht“ deutlich', () => {
    let vsRandom = 0;
    let vsEasy = 0;
    const games = 40;
    for (let g = 0; g < games; g++) {
      const first = g % 2 === 0;
      const a = botGame(first ? ['hard', 'easy'] : ['easy', 'hard'], `z${g}`, first ? ['turnip-patch', 'random'] : ['random', 'turnip-patch']);
      if (a.result?.kind === 'win' && a.result.winners[0] === (first ? 0 : 1)) vsRandom++;
      const b = botGame(first ? ['hard', 'easy'] : ['easy', 'hard'], `e${g}`);
      if (b.result?.kind === 'win' && b.result.winners[0] === (first ? 0 : 1)) vsEasy++;
    }
    expect(vsRandom).toBeGreaterThan(games * 0.6);
    expect(vsEasy).toBeGreaterThan(games * 0.6);
  });
});

describe('Vertrag für Spielmodule', () => {
  for (const check of gameContractChecks(gameModule, { seatCounts: [2, 6] })) test(check.name, check.run);
});
