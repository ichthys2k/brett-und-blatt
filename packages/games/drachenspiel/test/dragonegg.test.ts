import { describe, expect, it } from 'vitest';
import { CARDS_DB } from '../src/cards';
import { DRAGON_EGG_TOKENS } from '../src/grundset';
import { applyMove, dragonEggOn, legalMoves, setup } from '../src/rules';

describe('Option Drachenei (W-025, #261)', () => {
  it('alle Eier und Jungdrachen sind in CARDS_DB vorhanden und gültig definiert', () => {
    const houses = ['forest', 'sea', 'farm', 'wild', 'bugs'] as const;
    for (const h of houses) {
      const egg = CARDS_DB[`egg_${h}`];
      expect(egg).toBeDefined();
      expect(egg?.token).toBe(true);
      expect(egg?.dormant).toBe(3);
      expect(egg?.hatchesInto).toBe(`dragon_${h}`);

      const dragon = CARDS_DB[`dragon_${h}`];
      expect(dragon).toBeDefined();
      expect(dragon?.token).toBe(true);
      expect(dragon?.families).toContain('dragons');
      expect(dragon?.attack).toBeGreaterThan(0);
      expect(dragon?.health).toBeGreaterThan(0);
    }
    // Spezifische Fähigkeiten
    expect(CARDS_DB.dragon_forest?.keywords).toContain('bubble');
    expect(CARDS_DB.dragon_forest?.triggers).toHaveLength(1);
    expect(CARDS_DB.dragon_sea?.keywords).toContain('frostbite');
    expect(CARDS_DB.dragon_farm?.keywords).toContain('taunt');
    expect(CARDS_DB.dragon_wild?.keywords).toContain('rush');
    expect(CARDS_DB.dragon_bugs?.keywords).toContain('poisonous');
  });

  it('Standardmäßig (dragonEgg: off) liegen keine Eier auf dem Feld', () => {
    const state = setup(2, { deckSelection: 'forest', mulligan: 'off' }, 'egg-test-off');
    expect(dragonEggOn(state.options)).toBe(false);
    expect(state.players[0].board).toHaveLength(0);
    expect(state.players[1].board).toHaveLength(0);
  });

  it('Mit dragonEgg: on liegt für jeden Turnierherrn das passende Ei auf dem Feld', () => {
    const state = setup(2, { deckSelection: 'forest', mulligan: 'off', dragonEgg: 'on' }, 'egg-test-on');
    expect(dragonEggOn(state.options)).toBe(true);
    expect(state.players[0].board).toHaveLength(1);
    expect(state.players[1].board).toHaveLength(1);

    const egg0 = state.players[0].board[0]!;
    expect(egg0.cardId).toBe('egg_forest');
    // Nach erstem Zugstart von Platz 0 (startingSeat) hat es noch 2 Züge Winterschlaf
    expect(egg0.dormant).toBe(2);

    const egg1 = state.players[1].board[0]!;
    expect(egg1.cardId).toBe('egg_forest');
    // Platz 1 war noch nicht dran, daher 3
    expect(egg1.dormant).toBe(3);
  });

  it('Drachenei schlüpft in Runde 3 zum Jungdrachen', () => {
    let state = setup(2, { deckSelection: 'forest', mulligan: 'off', dragonEgg: 'on' }, 'egg-hatch-test');
    // Zug 1 (Platz 0): Ei hat dormant 2
    expect(state.players[0].board[0]?.cardId).toBe('egg_forest');
    expect(state.players[0].board[0]?.dormant).toBe(2);

    // Platz 0 beendet Zug -> Platz 1 Zug 1 beginnt (Ei 1 wird zu dormant 2)
    state = applyMove(state, state.activeSeat, { type: 'endTurn' }).state;
    expect(state.players[1].board[0]?.dormant).toBe(2);

    // Platz 1 beendet Zug -> Platz 0 Zug 2 beginnt (Ei 0 wird zu dormant 1)
    state = applyMove(state, state.activeSeat, { type: 'endTurn' }).state;
    expect(state.players[0].board[0]?.dormant).toBe(1);

    // Platz 0 beendet Zug -> Platz 1 Zug 2 beginnt (Ei 1 wird zu dormant 1)
    state = applyMove(state, state.activeSeat, { type: 'endTurn' }).state;
    expect(state.players[1].board[0]?.dormant).toBe(1);

    // Platz 1 beendet Zug -> Platz 0 Zug 3 beginnt (Ei 0 schlüpft!)
    state = applyMove(state, state.activeSeat, { type: 'endTurn' }).state;
    const hatched0 = state.players[0].board[0]!;
    expect(hatched0.cardId).toBe('dragon_forest');
    expect(hatched0.name).toBe('Grüner Jungdrache');
    expect(hatched0.dormant).toBeUndefined();
    expect(hatched0.canAttack).toBe(true);

    // Platz 0 beendet Zug -> Platz 1 Zug 3 beginnt (Ei 1 schlüpft!)
    state = applyMove(state, state.activeSeat, { type: 'endTurn' }).state;
    const hatched1 = state.players[1].board[0]!;
    expect(hatched1.cardId).toBe('dragon_forest');
    expect(hatched1.name).toBe('Grüner Jungdrache');
    expect(hatched1.dormant).toBeUndefined();
    expect(hatched1.canAttack).toBe(true);
  });

  it('verschiedene Wappenhäuser bringen die jeweils passenden Jungdrachen hervor', () => {
    // Platz 0 Wildnis, Platz 1 Krabbeltiere
    const state0 = setup(2, { deckSelection: 'wild', mulligan: 'off', dragonEgg: 'on' }, 'wild-seed');
    expect(state0.players[0].board[0]?.cardId).toBe('egg_wild');

    const state1 = setup(2, { deckSelection: 'bugs', mulligan: 'off', dragonEgg: 'on' }, 'bugs-seed');
    expect(state1.players[0].board[0]?.cardId).toBe('egg_bugs');

    const state2 = setup(2, { deckSelection: 'sea', mulligan: 'off', dragonEgg: 'on' }, 'sea-seed');
    expect(state2.players[0].board[0]?.cardId).toBe('egg_sea');

    const state3 = setup(2, { deckSelection: 'farm', mulligan: 'off', dragonEgg: 'on' }, 'farm-seed');
    expect(state3.players[0].board[0]?.cardId).toBe('egg_farm');
  });

  it('Drachenei funktioniert auch nach Mulligan-Phase', () => {
    let state = setup(2, { deckSelection: 'forest', mulligan: 'on', dragonEgg: 'on' }, 'mulligan-egg-test');
    expect(state.phase).toBe('mulligan');
    expect(state.players[0].board).toHaveLength(0);

    // Beide schließen Mulligan ab
    state = applyMove(state, 0, { type: 'mulligan', discardIndices: [] }).state;
    state = applyMove(state, 1, { type: 'mulligan', discardIndices: [] }).state;

    expect(state.phase).toBe('play');
    expect(state.players[0].board).toHaveLength(1);
    expect(state.players[1].board).toHaveLength(1);
    expect(state.players[0].board[0]?.cardId).toBe('egg_forest');
    expect(state.players[1].board[0]?.cardId).toBe('egg_forest');
  });
});
