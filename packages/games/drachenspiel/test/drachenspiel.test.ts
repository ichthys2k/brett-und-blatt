import { Rng } from '@brett-und-blatt/engine';
import { gameContractChecks } from '@brett-und-blatt/engine/testing';
import { describe, expect, it, test } from 'vitest';
import { drachenspiel, gameModule } from '../src';
import type { DrachenspielState, Minion } from '../src/types';

function createTestMinion(overrides: Partial<Minion> & { id: string; cardId: string }): Minion {
  return {
    id: overrides.id,
    cardId: overrides.cardId,
    name: overrides.name ?? 'Tier',
    emoji: overrides.emoji ?? '🐾',
    cost: overrides.cost ?? 1,
    baseAttack: overrides.attack ?? 1,
    attack: overrides.attack ?? 1,
    baseHealth: overrides.health ?? 1,
    maxHealth: overrides.health ?? 1,
    health: overrides.health ?? 1,
    quote: overrides.quote ?? null,
    sound: overrides.sound ?? null,
    taunt: overrides.taunt ?? false,
    rush: overrides.rush ?? false,
    bubble: overrides.bubble ?? false,
    poisonous: overrides.poisonous ?? false,
    stealth: overrides.stealth ?? false,
    canAttack: overrides.canAttack ?? true,
    hasAttacked: overrides.hasAttacked ?? false,
    deathrattle: overrides.deathrattle ?? null,
  };
}

describe('Drachenspiel – Fähigkeiten und Regeln', () => {
  it('Taunt (Beschützer) zwingt zum Angriff auf den Beschützer', () => {
    let state = gameModule.setup(2, { deckSelection: 'forest', mulligan: 'off' }, 'taunt-test');
    // Set up a controlled board
    state.phase = 'play';
    state.activeSeat = 0;
    state.players[0].mana = 10;
    state.players[0].board = [
      createTestMinion({
        id: 'm_atk',
        cardId: 'c21',
        name: 'Hase',
        emoji: '🐇',
        cost: 3,
        attack: 3,
        health: 2,
        rush: true,
      }),
    ];

    // Enemy has a normal minion and a taunt minion
    state.players[1].board = [
      createTestMinion({
        id: 'm_normal',
        cardId: 'c7',
        name: 'Maus',
        emoji: '🐁',
        cost: 1,
        attack: 1,
        health: 2,
        canAttack: false,
      }),
      createTestMinion({
        id: 'm_taunt',
        cardId: 'c13',
        name: 'Schildkröte',
        emoji: '🐢',
        cost: 2,
        attack: 1,
        health: 5,
        taunt: true,
        canAttack: false,
      }),
    ];

    const moves = gameModule.legalMoves(state, 0);
    // Attacking hero or m_normal should NOT be legal
    expect(moves.some((m) => m.type === 'attack' && m.target.kind === 'hero')).toBe(false);
    expect(moves.some((m) => m.type === 'attack' && m.target.kind === 'minion' && m.target.id === 'm_normal')).toBe(false);
    // Attacking m_taunt MUST be legal
    expect(moves.some((m) => m.type === 'attack' && m.target.kind === 'minion' && m.target.id === 'm_taunt')).toBe(true);

    // Apply attack
    const res = gameModule.applyMove(state, 0, {
      type: 'attack',
      attackerId: 'm_atk',
      target: { kind: 'minion', id: 'm_taunt' },
    });
    // Taunt minion had 5 HP, took 3 damage -> 2 HP left
    expect(res.state.players[1].board.find((m) => m.id === 'm_taunt')?.health).toBe(2);
    // Attacker had 2 HP, took 1 damage from taunt minion -> 1 HP left
    expect(res.state.players[0].board.find((m) => m.id === 'm_atk')?.health).toBe(1);
  });

  it('Schutzblase (Bubble) absorbiert den ersten Schaden', () => {
    let state = gameModule.setup(2, { deckSelection: 'sea', mulligan: 'off' }, 'bubble-test');
    state.phase = 'play';
    state.activeSeat = 0;
    state.players[0].board = [
      createTestMinion({
        id: 'm_atk',
        cardId: 'c21',
        name: 'Hase',
        emoji: '🐇',
        cost: 3,
        attack: 5,
        health: 5,
        rush: true,
      }),
    ];
    state.players[1].board = [
      createTestMinion({
        id: 'm_def',
        cardId: 'c15',
        name: 'Krabbe',
        emoji: '🦀',
        cost: 2,
        attack: 2,
        health: 3,
        bubble: true,
        canAttack: false,
      }),
    ];

    const res = gameModule.applyMove(state, 0, {
      type: 'attack',
      attackerId: 'm_atk',
      target: { kind: 'minion', id: 'm_def' },
    });

    const def = res.state.players[1].board.find((m) => m.id === 'm_def');
    expect(def?.bubble).toBe(false);
    expect(def?.health).toBe(3); // no HP lost!
  });

  it('Giftig (Poisonous) vernichtet getroffene Tiere sofort', () => {
    let state = gameModule.setup(2, { deckSelection: 'bugs', mulligan: 'off' }, 'poison-test');
    state.phase = 'play';
    state.activeSeat = 0;
    state.players[0].board = [
      createTestMinion({
        id: 'm_poison',
        cardId: 'c11',
        name: 'Spinne',
        emoji: '🕸️',
        cost: 2,
        attack: 2,
        health: 2,
        poisonous: true,
        rush: true,
      }),
    ];
    state.players[1].board = [
      createTestMinion({
        id: 'm_giant',
        cardId: 'c48',
        name: 'Elefant',
        emoji: '🐘',
        cost: 7,
        attack: 6,
        health: 9,
        canAttack: false,
      }),
    ];

    const res = gameModule.applyMove(state, 0, {
      type: 'attack',
      attackerId: 'm_poison',
      target: { kind: 'minion', id: 'm_giant' },
    });

    // Both should be dead and removed from board
    expect(res.state.players[1].board.some((m) => m.id === 'm_giant')).toBe(false);
    expect(res.state.players[0].board.some((m) => m.id === 'm_poison')).toBe(false);
  });

  it('Raupe hinterlässt bei Abschied einen Schmetterling', () => {
    let state = gameModule.setup(2, { deckSelection: 'forest', mulligan: 'off' }, 'raupe-test');
    state.phase = 'play';
    state.activeSeat = 0;
    state.players[0].board = [
      createTestMinion({
        id: 'm_raupe',
        cardId: 'c51',
        name: 'Raupe',
        emoji: '🐛',
        cost: 1,
        attack: 1,
        health: 1,
        rush: true,
        deathrattle: 'butterfly',
      }),
    ];
    state.players[1].board = [
      createTestMinion({
        id: 'm_enemy',
        cardId: 'c7',
        name: 'Maus',
        emoji: '🐁',
        cost: 1,
        attack: 2,
        health: 2,
        canAttack: false,
      }),
    ];

    const res = gameModule.applyMove(state, 0, {
      type: 'attack',
      attackerId: 'm_raupe',
      target: { kind: 'minion', id: 'm_enemy' },
    });

    // Raupe is gone, but Schmetterling is summoned on player 0 board
    expect(res.state.players[0].board.some((m) => m.id === 'm_raupe')).toBe(false);
    const butterfly = res.state.players[0].board.find((m) => m.cardId === 'token_butterfly');
    expect(butterfly).toBeDefined();
    expect(butterfly?.bubble).toBe(true);
  });

  it('Müdigkeit (Fatigue) zieht bei leerem Deck ansteigenden Schaden ab', () => {
    let state = gameModule.setup(2, { deckSelection: 'forest', mulligan: 'off' }, 'fatigue-test');
    state.phase = 'play';
    state.activeSeat = 0;
    state.players[1].deck = []; // Empty opponent deck
    state.players[1].health = 30;

    // Player 0 ends turn -> Player 1 turn starts, draws from empty deck
    const res1 = gameModule.applyMove(state, 0, { type: 'endTurn' });
    expect(res1.state.players[1].fatigue).toBe(1);
    expect(res1.state.players[1].health).toBe(29); // 30 - 1

    // Player 1 ends turn -> Player 0 turn
    const res2 = gameModule.applyMove(res1.state, 1, { type: 'endTurn' });
    // Player 0 ends turn -> Player 1 turn, fatigue increases to 2
    const res3 = gameModule.applyMove(res2.state, 0, { type: 'endTurn' });
    expect(res3.state.players[1].fatigue).toBe(2);
    expect(res3.state.players[1].health).toBe(27); // 29 - 2
  });

  it('Sternschnuppe gewährt +1 Mana', () => {
    let state = gameModule.setup(2, { deckSelection: 'forest', mulligan: 'off' }, 'star-test');
    state.phase = 'play';
    state.activeSeat = 0;
    state.players[0].mana = 2;
    state.players[0].maxMana = 2;
    state.players[0].hand = [{ uid: 's1', defId: 'special_star' }];

    const res = gameModule.applyMove(state, 0, { type: 'playCard', handIndex: 0 });
    expect(res.state.players[0].mana).toBe(3);
    expect(res.state.players[0].hand).toHaveLength(0);
  });
});

describe('Bot-Duelle', () => {
  it('Bots spielen ganze Partien über alle Themen fehlerfrei zu Ende', () => {
    const duels: [any, any][] = [
      ['easy', 'easy'],
      ['medium', 'easy'],
      ['hard', 'medium'],
      ['hard', 'hard'],
    ];
    for (let i = 0; i < duels.length; i++) {
      const [l0, l1] = duels[i];
      let state = gameModule.setup(2, { deckSelection: 'inGame', mulligan: 'on' }, `bot-duel-${i}`);
      for (let step = 0; step < 300 && !gameModule.result(state); step++) {
        const actors = gameModule.currentPlayers(state);
        expect(actors.length).toBeGreaterThan(0);
        const seat = actors[0] as number;
        const level = seat === 0 ? l0 : l1;
        const move = gameModule.bots[0].chooseMove({
          module: gameModule,
          view: gameModule.playerView(state, seat),
          seat,
          level,
          rng: Rng.fromSeed(`bot-move-${i}-${step}`),
          timeBudgetMs: 10,
          now: () => Date.now(),
        });
        state = gameModule.applyMove(state, seat, move).state;
      }
      expect(gameModule.result(state)).not.toBeNull();
    }
  });
});

describe('Vertrag für Spielmodule', () => {
  for (const check of gameContractChecks(gameModule, { randomGames: 12, botGames: 1 })) {
    test(check.name, check.run);
  }
});

describe('Zauberkarten', () => {
  const base = () => {
    const s = drachenspiel.setup(2, { deckSelection: 'wild', mulligan: 'off' }, 'zauber');
    const me = s.activeSeat;
    s.players[me].mana = 10;
    s.players[me].maxMana = 10;
    return { s, me, opp: (1 - me) as 0 | 1 };
  };
  const give = (s: ReturnType<typeof base>['s'], seat: number, defId: string) => {
    s.players[seat as 0 | 1].hand = [{ uid: `x_${defId}`, defId }];
  };
  const minion = (id: string, attack: number, health: number) => ({
    id, cardId: 'c43', name: 'Zebra', emoji: '🦓', cost: 3, baseAttack: attack, attack, baseHealth: health, maxHealth: health, health,
    quote: null, sound: null, taunt: false, rush: false, bubble: false, poisonous: false, stealth: false, canAttack: false, hasAttacked: false, deathrattle: null,
  });

  it('jedes Themendeck hat mit Zaubern 30 Karten, davon 6 Zauber; ohne Zauber keine', () => {
    for (const theme of ['forest', 'sea', 'farm', 'wild', 'bugs'] as const) {
      const on = drachenspiel.setup(2, { deckSelection: theme, mulligan: 'off' }, `d-${theme}`);
      const all = [...on.players[0].deck, ...on.players[0].hand].filter((c) => !c.defId.startsWith('special_'));
      expect(all).toHaveLength(30);
      expect(all.filter((c) => c.defId.startsWith('s_'))).toHaveLength(6);
      const off = drachenspiel.setup(2, { deckSelection: theme, mulligan: 'off', spells: 'off' }, `d-${theme}`);
      expect([...off.players[0].deck, ...off.players[0].hand].some((c) => c.defId.startsWith('s_'))).toBe(false);
    }
  });

  it('Blitzschlag trifft Held oder Tier, aber kein verstecktes', () => {
    const { s, me, opp } = base();
    give(s, me, 's_lightning');
    s.players[opp].board = [minion('m_a', 2, 4), { ...minion('m_b', 1, 1), stealth: true }];
    const moves = drachenspiel.legalMoves(s, me).filter((m) => m.type === 'playCard');
    expect(moves).toHaveLength(2);
    const hp = s.players[opp].health;
    const hero = drachenspiel.applyMove(s, me, { type: 'playCard', handIndex: 0, target: { kind: 'hero' } }).state;
    expect(hero.players[opp].health).toBe(hp - 3);
    expect(hero.players[me].mana).toBe(8);
    const onMinion = drachenspiel.applyMove(s, me, { type: 'playCard', handIndex: 0, target: { kind: 'minion', id: 'm_a' } }).state;
    expect(onMinion.players[opp].board.find((m) => m.id === 'm_a')!.health).toBe(1);
    expect(() => drachenspiel.applyMove(s, me, { type: 'playCard', handIndex: 0, target: { kind: 'minion', id: 'm_b' } })).toThrow();
    expect(() => drachenspiel.applyMove(s, me, { type: 'playCard', handIndex: 0 })).toThrow();
  });

  it('Honigtopf, Rückenwind und Seifenblase stärken ein eigenes Tier', () => {
    const { s, me } = base();
    s.players[me].board = [minion('m_x', 1, 1)];
    for (const [spell, check] of [
      ['s_honey', (m: ReturnType<typeof minion>) => m.attack === 3 && m.health === 3 && m.maxHealth === 3],
      ['s_tailwind', (m: ReturnType<typeof minion>) => m.attack === 2 && m.canAttack],
      ['s_soapBubble', (m: ReturnType<typeof minion>) => m.bubble],
    ] as const) {
      give(s, me, spell);
      const next = drachenspiel.applyMove(s, me, { type: 'playCard', handIndex: 0, target: { kind: 'minion', id: 'm_x' } }).state;
      expect(check(next.players[me].board[0]!)).toBe(true);
    }
  });

  it('Flutwelle spült ein Tier zurück, Wirbelsturm trifft alle, Glücksklee zieht zwei', () => {
    const { s, me, opp } = base();
    s.players[opp].board = [minion('m_a', 2, 2), minion('m_b', 3, 5)];
    s.players[opp].hand = [];
    give(s, me, 's_flood');
    let next = drachenspiel.applyMove(s, me, { type: 'playCard', handIndex: 0, target: { kind: 'minion', id: 'm_a' } }).state;
    expect(next.players[opp].board.map((m) => m.id)).toEqual(['m_b']);
    expect(next.players[opp].hand.map((c) => c.defId)).toEqual(['c43']);
    give(s, me, 's_whirlwind');
    next = drachenspiel.applyMove(s, me, { type: 'playCard', handIndex: 0 }).state;
    expect(next.players[opp].board.map((m) => [m.id, m.health])).toEqual([['m_b', 3]]);
    give(s, me, 's_clover');
    const deck = s.players[me].deck.length;
    next = drachenspiel.applyMove(s, me, { type: 'playCard', handIndex: 0 }).state;
    expect(next.players[me].hand).toHaveLength(2);
    expect(next.players[me].deck).toHaveLength(deck - 2);
  });

  it('Sommerregen heilt Held und Tiere, Wachstumsschub stärkt alle', () => {
    const { s, me } = base();
    s.players[me].health = 20;
    s.players[me].board = [{ ...minion('m_x', 2, 4), health: 1 }, minion('m_y', 1, 1)];
    give(s, me, 's_summerRain');
    let next = drachenspiel.applyMove(s, me, { type: 'playCard', handIndex: 0 }).state;
    expect(next.players[me].health).toBe(23);
    expect(next.players[me].board[0]!.health).toBe(4);
    give(s, me, 's_growth');
    next = drachenspiel.applyMove(s, me, { type: 'playCard', handIndex: 0 }).state;
    expect(next.players[me].board.map((m) => [m.attack, m.health])).toEqual([[3, 2], [2, 2]]);
  });
});
