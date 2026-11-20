import { resolveOptions } from '@brett-und-blatt/engine';
import { describe, expect, it } from 'vitest';
import { gameModule, type MillMove, type MillState } from '../src';
import { motionsOf } from '../src/ui/motion';

const fresh = (): MillState => gameModule.setup(2, resolveOptions(gameModule, {}), 'test');

function play(state: MillState, move: MillMove): MillState {
  return gameModule.applyMove(state, state.turn, move, undefined as never).state;
}

/** Zugphase mit gegebener Belegung. */
function position(white: number[], black: number[], turn = 0): MillState {
  const cells: MillState['cells'] = Array(24).fill(null);
  for (const p of white) cells[p] = 0;
  for (const p of black) cells[p] = 1;
  return { ...fresh(), cells, inHand: [0, 0], turn };
}

describe('Bewegung der Steine (#590)', () => {
  it('Setzen kommt vom Vorrat', () => {
    const before = fresh();
    const after = play(before, { type: 'place', to: 4, remove: [] });
    expect(motionsOf(before, after)).toEqual([{ kind: 'place', seat: 0, to: 4 }]);
  });

  it('Ziehen entlang einer Linie gleitet', () => {
    const before = position([0, 3, 5, 20], [10, 11, 12, 22]);
    const after = play(before, { type: 'move', from: 0, to: 1, remove: [] });
    expect(motionsOf(before, after)).toEqual([{ kind: 'slide', seat: 0, from: 0, to: 1 }]);
  });

  it('Springen mit drei Steinen fliegt', () => {
    const before = position([0, 3, 5], [10, 11, 12, 22]);
    const after = play(before, { type: 'move', from: 0, to: 14, remove: [] });
    expect(motionsOf(before, after)).toEqual([{ kind: 'fly', seat: 0, from: 0, to: 14 }]);
  });

  it('Schlagen: Stein kommt an, dann verschwindet der geschlagene', () => {
    const before = position([8, 9, 11, 20], [12, 13, 14, 22], 0);
    const after = play(before, { type: 'move', from: 11, to: 10, remove: [22] });
    expect(motionsOf(before, after)).toEqual([
      { kind: 'slide', seat: 0, from: 11, to: 10 },
      { kind: 'remove', seat: 1, point: 22 },
    ]);
  });

  it('Setzen mit Mühle: Stein vom Vorrat, dann Schlagen', () => {
    let state = fresh();
    for (const to of [0, 8, 1, 9]) state = play(state, { type: 'place', to, remove: [] });
    const after = play(state, { type: 'place', to: 2, remove: [8] });
    expect(motionsOf(state, after)).toEqual([
      { kind: 'place', seat: 0, to: 2 },
      { kind: 'remove', seat: 1, point: 8 },
    ]);
  });

  it('ohne echten Zug dazwischen (Erstes Rendern, Neuladen, gleicher Stand) bewegt sich nichts', () => {
    const state = play(fresh(), { type: 'place', to: 4, remove: [] });
    expect(motionsOf(null, state)).toEqual([]);
    expect(motionsOf(state, state)).toEqual([]);
    expect(motionsOf(fresh(), fresh())).toEqual([]);
  });

  it('Rückwärts und Sprünge über mehrere Züge werden nicht animiert', () => {
    const a = fresh();
    const b = play(a, { type: 'place', to: 4, remove: [] });
    const c = play(b, { type: 'place', to: 5, remove: [] });
    expect(motionsOf(c, b)).toEqual([]);
    expect(motionsOf(a, c)).toEqual([]);
  });
});
