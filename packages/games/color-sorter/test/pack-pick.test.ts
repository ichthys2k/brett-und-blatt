import { resolveOptions, Rng } from '@brett-und-blatt/engine';
import { describe, expect, it } from 'vitest';
import { gameModule, type PackKind, type SorterState } from '../src';
import { pickedHandCards } from '../src/ui/picks';

/** Spielt mit dem Bot bis zum Jahrmarkt und öffnet dort ein Bündel der gewünschten Art. */
function openPackOf(kind: PackKind): SorterState {
  let state = gameModule.setup(1, resolveOptions(gameModule, {}), 'buendel');
  const rng = Rng.fromSeed('bot');
  for (let i = 0; i < 3000; i++) {
    const run = state.runs[0]!;
    if (run.phase === 'pack' && run.pack?.kind === kind) return state;
    if (run.phase === 'shop') {
      run.tokens = 99;
      const moves = gameModule.legalMoves(state, 0);
      const buy = moves.find((m) => m.type === 'buyPack' && run.shop?.packs[m.index]?.kind === kind);
      const reroll = moves.find((m) => m.type === 'reroll');
      const move = buy ?? reroll;
      if (move) {
        state = gameModule.applyMove(state, 0, move).state;
        continue;
      }
    }
    const view = gameModule.playerView(state, 0);
    const move = gameModule.bots[0]!.chooseMove({ module: gameModule, view, seat: 0, level: 'medium', rng, timeBudgetMs: 50, now: () => Date.now() });
    state = gameModule.applyMove(state, 0, move).state;
  }
  throw new Error(`Kein Bündel „${kind}“ erreicht`);
}

describe('Auswahl beim Auspacken (#71)', () => {
  for (const kind of ['spells', 'dreams'] as const) {
    it(`Karte im Bündel „${kind}“ antippen stürzt nicht ab`, () => {
      const run = gameModule.playerView(openPackOf(kind), 0).runs[0]!;
      // Die Karten zum Anwenden liegen im Bündel, die Audienz-Hand ist leer.
      expect(run.pack!.hand.length).toBeGreaterThan(0);
      expect(run.hand).toHaveLength(0);
      expect(() => pickedHandCards(run, [0, 1])).not.toThrow();
      expect(pickedHandCards(run, [0, 1])).toEqual([]);
    });
  }

  it('liefert in der Audienz die ausgewählten Handkarten', () => {
    let state = gameModule.setup(1, resolveOptions(gameModule, {}), 'audienz');
    state = gameModule.applyMove(state, 0, { type: 'start' }).state;
    const run = state.runs[0]!;
    expect(run.phase).toBe('play');
    expect(pickedHandCards(run, [2, 0])).toEqual([run.hand[2], run.hand[0]]);
  });
});
