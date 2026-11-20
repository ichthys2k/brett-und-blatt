import { gameContractChecks } from '@brett-und-blatt/engine/testing';
import { describe, expect, it, test } from 'vitest';
import {
  gameModule,
  isCorner,
  isFixed,
  maskOf,
  pathTo,
  reachable,
  tileAt,
  tileMask,
  turnMask,
  type Kind,
  type MoleMove,
  type MoleState,
  type Pos,
  type Rot,
  type Tile,
} from '../src';

const { applyMove, legalMoves, setup, result, playerView, describeMove } = gameModule as Required<typeof gameModule>;

const opts = (o: Record<string, string> = {}) => o;
const push = (side: 'top' | 'bottom' | 'left' | 'right', index: number, rot: Rot = 0): MoleMove => ({ type: 'push', side, index, rot });
const walk = (row: number, col: number): MoleMove => ({ type: 'walk', to: [row, col] });

function step(state: MoleState, move: MoleMove): MoleState {
  return applyMove(state, state.turn, move).state;
}

const count = (state: MoleState, pred: (t: Tile) => boolean) => [...state.cells, state.spare].filter(pred).length;

/** Handgebautes Brett: lauter senkrechte Geraden (mask 5), ids nach Lage. */
function blank(size: 5 | 7 = 5, seats = 2): MoleState {
  const cells: Tile[] = Array.from({ length: size * size }, (_, id) => ({ id, kind: 'I' as Kind, rot: 0 as Rot, turnip: false, mole: false }));
  const hares: Pos[] = [[0, 0], [size - 1, size - 1], [0, size - 1], [size - 1, 0]].slice(0, seats) as Pos[];
  return {
    size,
    cells,
    spare: { id: 900, kind: 'I', rot: 0, turnip: false, mole: false },
    lastPush: null,
    hares,
    harvested: Array(seats).fill(0),
    phase: 'push',
    turn: 0,
    moves: 0,
    options: { goal: 5, turnips: 6, mole: true },
    rng: [1, 2, 3, 4],
  };
}

function withTile(state: MoleState, row: number, col: number, patch: Partial<Tile>): MoleState {
  const cells = [...state.cells];
  cells[row * state.size + col] = { ...cells[row * state.size + col]!, ...patch };
  return { ...state, cells };
}

describe('Öffnungen und Drehung', () => {
  it('Bitmasken aller Teilarten in allen Drehungen', () => {
    const table: Record<Kind, number[]> = {
      I: [5, 10, 5, 10],
      L: [3, 6, 12, 9],
      T: [11, 7, 14, 13],
    };
    for (const kind of ['I', 'L', 'T'] as const) {
      for (let rot = 0; rot < 4; rot++) expect(maskOf(kind, rot), `${kind} ${rot}`).toBe(table[kind][rot]);
    }
    expect(turnMask(1)).toBe(2);
    expect(turnMask(8)).toBe(1);
  });
});

describe('Aufbau', () => {
  it.each([
    [7, 34, { I: 13, L: 15, T: 6 }, 16],
    [5, 17, { I: 7, L: 7, T: 3 }, 9],
  ] as const)('Brett %i × %i: bewegliche Teile und feste Teile', (size, movable, kinds, fixed) => {
    const state = setup(3, opts({ size: String(size) }), 'aufbau');
    expect(state.cells).toHaveLength(size * size);
    const fixedTiles = state.cells.filter((_, i) => isFixed(Math.floor(i / size), i % size));
    expect(fixedTiles).toHaveLength(fixed);
    const movableTiles = [...state.cells.filter((_, i) => !isFixed(Math.floor(i / size), i % size)), state.spare];
    expect(movableTiles).toHaveLength(movable);
    for (const kind of ['I', 'L', 'T'] as const) expect(movableTiles.filter((t) => t.kind === kind)).toHaveLength(kinds[kind]);
    // Feste Teile: Ecken sind nach innen offene Kurven, Randabzweige zeigen nach innen.
    const last = size - 1;
    expect(tileMask(tileAt(state, 0, 0))).toBe(2 | 4);
    expect(tileMask(tileAt(state, 0, last))).toBe(4 | 8);
    expect(tileMask(tileAt(state, last, last))).toBe(1 | 8);
    expect(tileMask(tileAt(state, last, 0))).toBe(1 | 2);
    expect(tileMask(tileAt(state, 0, 2))).toBe(2 | 4 | 8);
    expect(tileMask(tileAt(state, last, 2))).toBe(1 | 2 | 8);
    expect(tileMask(tileAt(state, 2, 0))).toBe(1 | 2 | 4);
    expect(tileMask(tileAt(state, 2, last))).toBe(1 | 4 | 8);
    expect(fixedTiles.filter((t) => t.kind === 'T')).toHaveLength(fixed - 4);
    // Teil-ids sind eindeutig.
    expect(new Set([...state.cells, state.spare].map((t) => t.id)).size).toBe(size * size + 1);
  });

  it('Rüben und Maulwurf: richtige Zahl, nie in einer Startecke, Maulwurf auf beweglichem Teil ohne Rübe', () => {
    for (let g = 0; g < 30; g++) {
      for (const [size, turnips] of [['7', '8'], ['7', '4'], ['5', '8']] as const) {
        const state = setup(4, opts({ size, turnips }), `rueben${g}`);
        const expected = size === '5' ? Math.min(6, Number(turnips)) : Number(turnips);
        expect(count(state, (t) => t.turnip)).toBe(expected);
        expect(count(state, (t) => t.mole)).toBe(1);
        state.cells.forEach((tile, i) => {
          const row = Math.floor(i / state.size);
          const col = i % state.size;
          if (isCorner(state.size, row, col)) expect(tile.turnip || tile.mole).toBe(false);
          if (tile.mole) {
            expect(isFixed(row, col)).toBe(false);
            expect(tile.turnip).toBe(false);
          }
        });
      }
    }
    expect(count(setup(2, opts({ mole: 'off' }), 'x'), (t) => t.mole)).toBe(0);
  });

  it('Hasen starten in den Ecken: 0 oben links, 1 unten rechts, 2 oben rechts, 3 unten links', () => {
    expect(setup(4, opts(), 'ecken').hares).toEqual([[0, 0], [6, 6], [0, 6], [6, 0]]);
    expect(setup(2, opts({ size: '5' }), 'ecken').hares).toEqual([[0, 0], [4, 4]]);
  });
});

describe('Schieben', () => {
  it('aus allen vier Richtungen: Teil fällt heraus, Freiteil kommt hinein, Rüben und Maulwurf wandern mit', () => {
    let state = blank(5, 2);
    // Eindeutige Teile in Zeile 1 und Spalte 1 markieren.
    state = withTile(state, 1, 1, { turnip: true });
    state = withTile(state, 1, 3, { mole: true });
    const cases: [ 'top' | 'bottom' | 'left' | 'right', number, Pos, Pos][] = [
      ['top', 1, [0, 1], [4, 1]],
      ['bottom', 1, [4, 1], [0, 1]],
      ['left', 1, [1, 0], [1, 4]],
      ['right', 1, [1, 4], [1, 0]],
    ];
    for (const [side, index, entry, exit] of cases) {
      const fallingId = tileAt(state, exit[0], exit[1]).id;
      const next = step(state, push(side, index));
      expect(tileAt(next, entry[0], entry[1]).id).toBe(900);
      expect(next.spare.id).toBe(fallingId);
      expect(next.phase).toBe('walk');
      expect(next.lastPush).toEqual({ side, index });
      expect(new Set([...next.cells, next.spare].map((t) => t.id)).size).toBe(26);
    }
    // Rübe auf (1,1) rutscht mit: von links in Zeile 1 wandert sie nach (1,2).
    const left = step(state, push('left', 1));
    expect(tileAt(left, 1, 2).turnip).toBe(true);
    expect(tileAt(left, 1, 4).mole).toBe(true); // Maulwurf von (1,3) nach (1,4)
    // Von rechts in Zeile 1: Maulwurf (1,3) -> (1,2), Rübe (1,1) -> (1,0).
    const right = step(state, push('right', 1));
    expect(tileAt(right, 1, 0).turnip).toBe(true);
    expect(tileAt(right, 1, 2).mole).toBe(true);
    // Fällt das Maulwurfsteil hinaus, wird es zum Freiteil und bleibt ein Maulwurfsteil.
    const edge = step(withTile(withTile(blank(5, 2), 1, 4, { mole: true }), 1, 1, { turnip: false }), push('left', 1));
    expect(edge.spare.mole).toBe(true);
    expect(count(edge, (t) => t.mole)).toBe(1);
  });

  it('ein Hase auf dem herausfallenden Teil erscheint auf dem neu eingeschobenen', () => {
    let state = blank(5, 2);
    state = { ...state, hares: [[4, 1], [4, 4]] };
    const next = step(state, push('top', 1));
    expect(next.hares[0]).toEqual([0, 1]);
    // Hase mitten in der Reihe rutscht mit.
    const mid = step({ ...state, hares: [[2, 1], [4, 4]] }, push('top', 1));
    expect(mid.hares[0]).toEqual([3, 1]);
    // Andere Reihen bleiben unberührt.
    expect(mid.hares[1]).toEqual([4, 4]);
  });

  it('Rückschub-Verbot: Gegenseite derselben Reihe gesperrt, anderes erlaubt', () => {
    let state = step(blank(5, 2), push('top', 1));
    state = step(state, walk(...state.hares[0]!));
    const moves = legalMoves(state, 1);
    expect(moves.some((m) => m.type === 'push' && m.side === 'bottom' && m.index === 1)).toBe(false);
    expect(moves.some((m) => m.type === 'push' && m.side === 'top' && m.index === 1)).toBe(true);
    expect(moves.some((m) => m.type === 'push' && m.side === 'bottom' && m.index === 3)).toBe(true);
    expect(() => applyMove(state, 1, push('bottom', 1))).toThrow();
  });

  it('Zahl der Schübe: 12 Stellen (7 × 7) bzw. 8 (5 × 5), Geraden nur 2 Drehungen', () => {
    const big = setup(2, opts(), 'schuebe');
    const kinds = big.spare.kind === 'I' ? 2 : 4;
    expect(legalMoves(big, 0)).toHaveLength(12 * kinds);
    const small = setup(2, opts({ size: '5' }), 'schuebe');
    expect(legalMoves(small, 0)).toHaveLength(8 * (small.spare.kind === 'I' ? 2 : 4));
  });

  it('ungültige Schübe werfen', () => {
    const state = blank(5, 2);
    expect(() => applyMove(state, 0, push('top', 0))).toThrow();
    expect(() => applyMove(state, 0, push('top', 2))).toThrow();
    expect(() => applyMove(state, 0, push('top', 1, 2))).toThrow(); // Gerade hat nur Drehung 0–1
    expect(() => applyMove(state, 1, push('top', 1))).toThrow();
    expect(() => applyMove(state, 0, walk(0, 0))).toThrow();
  });
});

describe('Laufen', () => {
  /** Zeile 0 komplett waagerechte Geraden (mask 10), Rest senkrecht. */
  function corridor(): MoleState {
    let state = blank(5, 2);
    for (let col = 0; col < 5; col++) state = withTile(state, 0, col, { rot: 1 });
    return { ...state, phase: 'walk' };
  }

  it('Breitensuche auf einem handgebauten Brett', () => {
    const state = corridor();
    const cells = reachable(state, [0, 0]).map(([r, c]) => `${r},${c}`);
    expect(cells).toEqual(['0,0', '0,1', '0,2', '0,3', '0,4']);
    // Senkrechte Geraden berühren sich nicht seitlich: (1,1) ist von (1,0) nicht erreichbar.
    expect(reachable(state, [1, 0]).map(([r, c]) => `${r},${c}`)).toEqual(['1,0', '2,0', '3,0', '4,0']);
    expect(pathTo(state, [0, 0], [0, 3])).toEqual([[0, 0], [0, 1], [0, 2], [0, 3]]);
    expect(pathTo(state, [0, 0], [2, 2])).toBeNull();
  });

  it('Öffnungen müssen zueinander zeigen', () => {
    let state = corridor();
    state = withTile(state, 0, 2, { kind: 'L', rot: 0 }); // N+E: nach links geschlossen
    expect(reachable(state, [0, 0]).map(([, c]) => c)).toEqual([0, 1]);
  });

  it('Maulwurf sperrt Durchgang und Ziel; Hase auf dem Maulwurfsteil darf hinaus', () => {
    let state = withTile(corridor(), 0, 2, { mole: true });
    expect(reachable(state, [0, 0]).map(([, c]) => c)).toEqual([0, 1]);
    expect(legalMoves(state, 0).some((m) => m.type === 'walk' && m.to[1] === 2)).toBe(false);
    // Hase steht auf dem Maulwurfsteil: darf es normal verlassen.
    expect(reachable(state, [0, 2]).map(([, c]) => c)).toEqual([0, 1, 2, 3, 4]);
  });

  it('stehen bleiben ist immer erlaubt', () => {
    for (let g = 0; g < 10; g++) {
      let state = setup(4, opts(), `bleiben${g}`);
      state = step(state, legalMoves(state, 0)[0]!);
      expect(legalMoves(state, 0).some((m) => m.type === 'walk' && m.to[0] === state.hares[0]![0] && m.to[1] === state.hares[0]![1])).toBe(true);
    }
  });

  it('nicht erreichbare Felder und falsche Phase sind verboten', () => {
    const state = corridor();
    expect(() => applyMove(state, 0, walk(2, 2))).toThrow();
    expect(() => applyMove(state, 0, push('top', 1))).toThrow();
  });
});

describe('Ernte und Nachwachsen', () => {
  function harvestState(): MoleState {
    let state = blank(5, 2);
    for (let col = 0; col < 5; col++) state = withTile(state, 0, col, { rot: 1 });
    state = withTile(state, 0, 3, { turnip: true });
    state = withTile(state, 2, 2, { turnip: true });
    state = withTile(state, 2, 3, { mole: true });
    return { ...state, phase: 'walk' };
  }

  it('Zähler steigt, gleich viele Rüben liegen aus, neue nie in Ecke oder unter dem Maulwurf', () => {
    const before = harvestState();
    const total = count(before, (t) => t.turnip);
    for (let g = 0; g < 40; g++) {
      const next = step({ ...before, rng: [g, 7, 11, 13] }, walk(0, 3));
      expect(next.harvested).toEqual([1, 0]);
      expect(count(next, (t) => t.turnip)).toBe(total);
      expect(tileAt(next, 0, 3).turnip).toBe(false);
      next.cells.forEach((tile, i) => {
        if (tile.turnip) expect(isCorner(5, Math.floor(i / 5), i % 5)).toBe(false);
        if (tile.turnip && tile.mole) throw new Error('Rübe unter dem Maulwurf');
      });
      expect(next.turn).toBe(1);
      expect(next.phase).toBe('push');
    }
  });

  it('Rübe unter dem Maulwurf lässt sich nicht ernten', () => {
    const state = withTile(harvestState(), 2, 3, { turnip: true });
    expect(legalMoves(state, 0).some((m) => m.type === 'walk' && m.to[0] === 2 && m.to[1] === 3)).toBe(false);
  });

  it('Rübe auf dem eigenen Feld wird beim Stehenbleiben geerntet', () => {
    const state = withTile({ ...harvestState(), hares: [[0, 3], [4, 4]] }, 0, 3, { turnip: true });
    const next = step(state, walk(0, 3));
    expect(next.harvested[0]).toBe(1);
    expect(describeMove(state, walk(0, 3))).toBe('Stehen bleiben und Rübe ernten');
  });

  it('gleiche Seed-Züge ergeben denselben Spielstand', () => {
    const play = () => {
      let state = setup(3, opts(), 'wiederholung');
      for (let i = 0; i < 30 && !result(state); i++) {
        const moves = legalMoves(state, state.turn);
        state = step(state, moves[(i * 7) % moves.length]!);
      }
      return state;
    };
    expect(play()).toEqual(play());
  });
});

describe('Sieg und Zuglimit', () => {
  it('Zielzahl gewinnt sofort', () => {
    let state = blank(5, 2);
    for (let col = 0; col < 5; col++) state = withTile(state, 0, col, { rot: 1 });
    state = withTile(state, 0, 1, { turnip: true });
    state = { ...state, phase: 'walk', harvested: [4, 2], options: { ...state.options, goal: 5 } };
    const next = step(state, walk(0, 1));
    expect(result(next)).toEqual({ kind: 'win', winners: [0] });
    expect(gameModule.currentPlayers(next)).toEqual([]);
    expect(legalMoves(next, next.turn)).toEqual([]);
  });

  it('Zuglimit: meiste Rüben gewinnen, Gleichstand der Spitze teilt den Sieg', () => {
    const base = { ...blank(5, 3), moves: 120 };
    expect(result({ ...base, harvested: [2, 3, 1] })).toEqual({ kind: 'win', winners: [1], reason: 'limit' });
    expect(result({ ...base, harvested: [3, 3, 1] })).toEqual({ kind: 'win', winners: [0, 1], reason: 'limit' });
    expect(result({ ...base, harvested: [1, 1, 1] })).toEqual({ kind: 'draw', reason: 'limit' });
    expect(result({ ...base, moves: 119, harvested: [2, 3, 1] })).toBeNull();
  });

  it('Zeitablauf: Schub ohne Drehung, dann stehen bleiben', () => {
    const state = setup(2, opts(), 'zeit');
    const first = gameModule.timeoutMove!(state, 0);
    expect(first).toMatchObject({ type: 'push', rot: 0 });
    expect(legalMoves(state, 0)).toContainEqual(first);
    const walking = step(state, first);
    expect(gameModule.timeoutMove!(walking, 0)).toEqual({ type: 'walk', to: walking.hares[0] });
  });
});

describe('Zugtexte und Sicht', () => {
  it('Zugtexte sind je Zugliste eindeutig', () => {
    let state = setup(2, opts(), 'texte');
    for (let i = 0; i < 6; i++) {
      const moves = legalMoves(state, state.turn);
      const texts = moves.map((m) => describeMove(state, m));
      expect(new Set(texts).size).toBe(texts.length);
      expect(texts.every((t) => t.length > 0)).toBe(true);
      state = step(state, moves[i % moves.length]!);
    }
    expect(describeMove(setup(2, opts(), 'a'), push('top', 3, 1))).toMatch(/von oben in Spalte 4 einschieben, 1× gedreht/);
  });

  it('playerView enthält keinen Zufallszustand', () => {
    const state = setup(2, opts(), 'sicht');
    expect(state.rng).not.toEqual([0, 0, 0, 0]);
    expect(playerView(state, 0).rng).toEqual([0, 0, 0, 0]);
  });
});

describe('Vertrag für Spielmodule', () => {
  for (const check of gameContractChecks(gameModule)) test(check.name, check.run);
});
