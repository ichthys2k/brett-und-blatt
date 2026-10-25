import { Rng, computeBotMove, hashSeed, resolveOptions, type BotLevel, type Options } from '@brett-und-blatt/engine';
import { gameContractChecks } from '@brett-und-blatt/engine/testing';
import { describe, expect, it, test } from 'vitest';
import { fleetProblem, gameModule, knownWater, openCells, randomFleet, shipCells, type BattleshipMove, type BattleshipState } from '../src';

function start(options: Options = {}, seed = 'test'): BattleshipState {
  return gameModule.setup(2, resolveOptions(gameModule, options), seed);
}

/** Feste Flotte für Platz 1: Schiffe in den Reihen 0, 2, 4 … mit Abstand. */
const FIXED: number[][] = [
  shipCells(0, 5, false)!,
  shipCells(20, 4, false)!,
  shipCells(26, 4, false)!,
  shipCells(40, 3, false)!,
  shipCells(44, 3, false)!,
  shipCells(48, 2, true)!,
  shipCells(60, 3, false)!,
  shipCells(80, 2, false)!,
  shipCells(83, 2, false)!,
  shipCells(86, 2, false)!,
];

function placed(options: Options = {}): BattleshipState {
  let state = start(options);
  const kind = state.fleetKind;
  state = gameModule.applyMove(state, 0, { type: 'placeFleet', ships: randomFleet(kind, state.noTouch, new Rng([1, 2, 3, 4])) }).state;
  const own = kind === 'classic' ? FIXED : [shipCells(0, 5, false)!, shipCells(10, 4, false)!, shipCells(20, 3, false)!, shipCells(30, 3, false)!, shipCells(40, 2, false)!];
  return gameModule.applyMove(state, 1, { type: 'placeFleet', ships: own }).state;
}

const shoot = (state: BattleshipState, cell: number) => gameModule.applyMove(state, state.turn, { type: 'shoot', cell }).state;

describe('Aufstellen', () => {
  it('prüft Grenzen, Anzahl, Überlappen und Berühren', () => {
    expect(fleetProblem(FIXED, 'classic', true)).toBeNull();
    expect(fleetProblem(FIXED.slice(1), 'classic', true)).toMatch(/richtigen/);
    expect(fleetProblem([[8, 9, 10, 11, 12], ...FIXED.slice(1)], 'classic', true)).toMatch(/gerade/);
    expect(fleetProblem([[0, 2, 4, 6, 8], ...FIXED.slice(1)], 'classic', true)).toMatch(/gerade/);
    // Über Eck: Das U-Boot bei 48/58 und ein Schiff bei 37–39 berühren sich.
    const touching = FIXED.map((s, i) => (i === 3 ? shipCells(37, 3, false)! : s));
    expect(fleetProblem(touching, 'classic', true)).toMatch(/berühren/);
    const overlap = FIXED.map((s, i) => (i === 9 ? [80, 81] : s));
    expect(fleetProblem(overlap, 'classic', true)).toMatch(/überlappen/);
  });

  it('kleine Flotte: Berühren erlaubt', () => {
    const ships = [shipCells(0, 5, false)!, shipCells(10, 4, false)!, shipCells(20, 3, false)!, shipCells(30, 3, false)!, shipCells(40, 2, false)!];
    expect(fleetProblem(ships, 'small', false)).toBeNull();
    expect(fleetProblem(ships, 'classic', true)).not.toBeNull();
  });

  it('zufällige Aufstellungen sind immer gültig', () => {
    const rng = new Rng([5, 6, 7, 8]);
    for (let i = 0; i < 200; i++) expect(fleetProblem(randomFleet('classic', true, rng), 'classic', true)).toBeNull();
  });

  it('beide stellen gleichzeitig auf, dann beginnt Platz 1', () => {
    let state = start();
    expect(gameModule.currentPlayers(state)).toEqual([0, 1]);
    state = gameModule.applyMove(state, 1, { type: 'placeFleet', ships: FIXED }).state;
    expect(gameModule.currentPlayers(state)).toEqual([0]);
    expect(gameModule.isLegal!(state, 0, { type: 'placeFleet', ships: FIXED })).toBe(true);
    expect(gameModule.isLegal!(state, 0, { type: 'placeFleet', ships: FIXED.slice(2) })).toBe(false);
    state = gameModule.applyMove(state, 0, { type: 'placeFleet', ships: FIXED }).state;
    expect(state.phase).toBe('shoot');
    expect(gameModule.currentPlayers(state)).toEqual([0]);
  });
});

describe('Schießen', () => {
  it('Wasser gibt ab, Treffer schießt weiter, versenkt zeigt das Schiff', () => {
    let state = placed();
    state = shoot(state, 99);
    expect(state.shots[0]).toEqual([{ cell: 99, result: 'water' }]);
    expect(state.turn).toBe(1);
    state = shoot(state, 99);
    state = shoot(state, 80);
    expect(state.shots[0]!.at(-1)).toEqual({ cell: 80, result: 'hit' });
    expect(state.turn).toBe(0);
    state = shoot(state, 81);
    expect(state.shots[0]!.at(-1)).toEqual({ cell: 81, result: 'sunk' });
    expect(gameModule.playerView(state, 0).fleets[1]).toEqual([{ cells: [80, 81], sunk: true }]);
  });

  it('ohne „Nach Treffer weiter“ wechselt der Zug immer', () => {
    let state = placed({ again: 'off' });
    state = shoot(state, 99);
    state = shoot(state, 0);
    expect(state.turn).toBe(0);
    state = shoot(state, 80);
    expect(state.turn).toBe(1);
  });

  it('Komfort-Markierung: Rand versenkter Schiffe ist gesperrt – nur mit Berührverbot', () => {
    let state = placed();
    state = shoot(state, 99);
    state = shoot(state, 99);
    state = shoot(state, 80);
    state = shoot(state, 81);
    const water = knownWater(state, 1);
    expect([...water].sort((a, b) => a - b)).toEqual([70, 71, 72, 82, 90, 91, 92]);
    expect(openCells(state, 0)).not.toContain(82);
    const off = placed({ autoWater: 'off' });
    expect(off.autoWater).toBe(false);
    expect(placed({ fleet: 'small' }).autoWater).toBe(false);
  });

  it('Salvenmodus: so viele Schüsse wie eigene Schiffe, Auflösung am Ende', () => {
    let state = placed({ salvo: 'on' });
    for (let i = 0; i < 9; i++) state = shoot(state, 90 + i);
    expect(state.aim).toHaveLength(9);
    expect(state.shots[0]).toHaveLength(0);
    state = shoot(state, 99);
    expect(state.shots[0]).toHaveLength(10);
    expect(state.aim).toHaveLength(0);
    expect(state.turn).toBe(1);
  });

  it('Sieg beim letzten Schiff', () => {
    let state = placed({ again: 'on' });
    state = shoot(state, 99);
    state = shoot(state, 99);
    for (const cell of FIXED.flat()) state = shoot(state, cell);
    expect(gameModule.result(state)).toEqual({ kind: 'win', winners: [0] });
  });

  it('die Sicht enthält nie gegnerische Schiffe, die noch schwimmen', () => {
    const state = placed();
    expect(gameModule.playerView(state, 0).fleets[1]).toEqual([]);
    expect(gameModule.playerView(state, 1).fleets[1]).toHaveLength(10);
    expect(gameModule.playerView(state, 'spectator').fleets.flat()).toEqual([]);
    expect(gameModule.playerView(state, 0).rng).toEqual([0, 0, 0, 0]);
  });
});

/** Wie viele Schüsse braucht ein Bot, um eine zufällige Flotte zu versenken? */
function shotsNeeded(level: BotLevel, seed: string): number {
  let state = placed({ again: 'off' });
  const fleet = randomFleet('classic', true, new Rng(hashSeed(seed)));
  state = { ...state, fleets: [state.fleets[0]!, fleet.map((cells) => ({ cells, sunk: false }))] };
  let shots = 0;
  for (let step = 0; !gameModule.result(state); step++) {
    if (state.turn === 1) {
      state = { ...state, turn: 0 };
      continue;
    }
    const move = computeBotMove(gameModule, { gameId: 'battleship', botId: 'battleship', level, seat: 0, view: gameModule.playerView(state, 0), seed: `${seed}/${step}`, timeBudgetMs: 10 }) as BattleshipMove;
    state = gameModule.applyMove(state, 0, move).state;
    shots++;
  }
  return shots;
}

describe('Bot', () => {
  it('der schwere Bot braucht deutlich weniger Schüsse als der mittlere, der mittlere weniger als der leichte', () => {
    const GAMES = 100;
    const average = (level: BotLevel) => {
      let sum = 0;
      for (let g = 0; g < GAMES; g++) sum += shotsNeeded(level, `flotte${g}`);
      return sum / GAMES;
    };
    const easy = average('easy');
    const medium = average('medium');
    const hard = average('hard');
    // Stand Oktober 2026: etwa 68, 52 und 47 Schüsse.
    expect(medium).toBeLessThan(easy - 10);
    expect(hard).toBeLessThan(medium - 3);
  });

  it('der schwere Bot stellt gültig auf', () => {
    const state = start();
    for (let i = 0; i < 10; i++) {
      const move = computeBotMove(gameModule, { gameId: 'battleship', botId: 'battleship', level: 'hard', seat: 0, view: gameModule.playerView(state, 0), seed: `auf${i}`, timeBudgetMs: 10 }) as BattleshipMove;
      expect(move.type === 'placeFleet' && fleetProblem(move.ships, 'classic', true)).toBeNull();
    }
  });
});

describe('Vertrag für Spielmodule', () => {
  for (const check of gameContractChecks(gameModule, { randomGames: 16 })) test(check.name, check.run);
});

