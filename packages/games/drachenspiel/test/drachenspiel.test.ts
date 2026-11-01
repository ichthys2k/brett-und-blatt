import { Rng } from '@brett-und-blatt/engine';
import { gameContractChecks } from '@brett-und-blatt/engine/testing';
import { describe, expect, it, test } from 'vitest';
import { drachenspiel, gameModule } from '../src';
import { ALL_CARD_IDS, CARDS_DB } from '../src/cards';
import { DECK_THEME_IDS, themeCardIds } from '../src/decks';
import { HOUSE_POWERS } from '../src/powers';
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
    owner: overrides.owner ?? 0,
    playOrder: overrides.playOrder ?? 0,
    damage: overrides.damage ?? 0,
    enchantments: overrides.enchantments ?? [],
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
    state.players[1].armor = 0;

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
    s.players[1 - me]!.armor = 0;
    return { s, me, opp: (1 - me) as 0 | 1 };
  };
  const give = (s: ReturnType<typeof base>['s'], seat: number, defId: string) => {
    s.players[seat as 0 | 1].hand = [{ uid: `x_${defId}`, defId }];
  };
  const minion = (id: string, attack: number, health: number): Minion => ({
    id, cardId: 'c43', name: 'Zebra', emoji: '🦓', cost: 3, baseAttack: attack, attack, baseHealth: health, maxHealth: health, health,
    quote: null, sound: null, taunt: false, rush: false, bubble: false, poisonous: false, stealth: false, canAttack: false, hasAttacked: false, owner: 0, playOrder: 0, damage: 0, enchantments: [],
  });

  it('jedes Themendeck hat mit Zaubern 30 Karten, davon 6 Zauber; ohne Zauber keine', () => {
    for (const theme of ['forest', 'sea', 'farm', 'wild', 'bugs'] as const) {
      const on = drachenspiel.setup(2, { deckSelection: theme, mulligan: 'off' }, `d-${theme}`);
      const all = [...on.players[0].deck, ...on.players[0].hand].filter((c) => !c.defId.startsWith('special_'));
      expect(all).toHaveLength(30);
      expect(all.filter((c) => CARDS_DB[c.defId]!.isSpell)).toHaveLength(6);
      const off = drachenspiel.setup(2, { deckSelection: theme, mulligan: 'off', spells: 'off' }, `d-${theme}`);
      expect([...off.players[0].deck, ...off.players[0].hand].some((c) => CARDS_DB[c.defId]!.isSpell && !c.defId.startsWith('special_'))).toBe(false);
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
      ['s_honey', (m: Minion) => m.attack === 3 && m.health === 3 && m.maxHealth === 3],
      ['s_tailwind', (m: Minion) => m.attack === 2 && m.canAttack],
      ['s_soapBubble', (m: Minion) => m.bubble],
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
    s.players[me].board = [{ ...minion('m_x', 2, 4), health: 1, damage: 3 }, minion('m_y', 1, 1)];
    give(s, me, 's_summerRain');
    let next = drachenspiel.applyMove(s, me, { type: 'playCard', handIndex: 0 }).state;
    expect(next.players[me].health).toBe(23);
    expect(next.players[me].board[0]!.health).toBe(4);
    give(s, me, 's_growth');
    next = drachenspiel.applyMove(s, me, { type: 'playCard', handIndex: 0 }).state;
    expect(next.players[me].board.map((m) => [m.attack, m.health])).toEqual([[3, 2], [2, 2]]);
  });
});

describe('Mischen und Zufallsdeck', () => {
  const start = (seed: string) => {
    let s = drachenspiel.setup(2, { deckSelection: 'inGame', mulligan: 'on' }, seed);
    s = drachenspiel.applyMove(s, 0, { type: 'chooseDeck', deck: 'forest' }).state;
    return drachenspiel.applyMove(s, 1, { type: 'chooseDeck', deck: 'forest' }).state;
  };
  const order = (s: ReturnType<typeof start>, seat: 0 | 1) => [...s.players[seat].hand, ...s.players[seat].deck].map((c) => c.defId).join();

  it('Deckwahl im Spiel mischt je Seed anders, bei gleichem Seed gleich', () => {
    const orders = Array.from({ length: 6 }, (_, i) => order(start(`seed-${i}`), 0));
    expect(new Set(orders).size).toBe(6);
    expect(order(start('seed-0'), 0)).toBe(orders[0]);
  });

  it('beide Plätze bekommen bei gleichem Deck verschiedene Reihenfolgen', () => {
    const s = start('zwei-plaetze');
    const key = (seat: 0 | 1) => s.players[seat].deck.slice(0, 20).map((c) => c.defId).join();
    expect(key(0)).not.toBe(key(1));
  });

  it('der Kartentausch mischt je Seed anders', () => {
    const afterMulligan = (seed: string) => {
      const s = start(seed);
      const seat = s.startingSeat;
      const hand = s.players[seat].hand.map((_, i) => i);
      return drachenspiel.applyMove(s, seat, { type: 'mulligan', discardIndices: hand }).state.players[seat].deck.map((c) => c.defId).join();
    };
    expect(new Set(Array.from({ length: 6 }, (_, i) => afterMulligan(`tausch-${i}`))).size).toBe(6);
  });

  it('der Zufallsstrom erscheint in keiner Sicht', () => {
    const s = start('sicht');
    expect(s.rng).toBeDefined();
    expect(JSON.stringify(drachenspiel.playerView(s, 0))).not.toContain('"rng"');
  });

  it('gemischtes Deck: Thema mixed, 30 Karten, höchstens zwei Kopien, Fuchs und Drache einmal', () => {
    for (let i = 0; i < 20; i++) {
      const s = drachenspiel.setup(2, { deckSelection: 'random', mulligan: 'off' }, `mix-${i}`);
      const seat = s.startingSeat;
      const player = s.players[seat];
      expect(player.deckTheme).toBe('mixed');
      const ids = [...player.hand, ...player.deck, ].map((c) => c.defId);
      expect(ids.filter((id) => !id.startsWith('special_')).length + 1).toBeGreaterThanOrEqual(30);
      const counts = new Map<string, number>();
      for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
      for (const [id, n] of counts) expect(n, id).toBeLessThanOrEqual(id === 'c53' || id === 'c54' ? 1 : 2);
    }
  });
});

describe('Ehrliche Anzeige', () => {
  it('Heilung meldet nur, was wirklich geheilt wurde', () => {
    const s = drachenspiel.setup(2, { deckSelection: 'forest', mulligan: 'off' }, 'heilung');
    const me = s.activeSeat;
    s.players[me].mana = 10;
    s.players[me].health = 29;
    s.players[me].hand = [{ uid: 'h', defId: 'c29' }];
    const res = drachenspiel.applyMove(s, me, { type: 'playCard', handIndex: 0 });
    expect(res.state.players[me].health).toBe(30);
    expect(res.events.find((e) => e.type === 'heroHealed')).toMatchObject({ amount: 1 });

    const full = drachenspiel.setup(2, { deckSelection: 'forest', mulligan: 'off' }, 'heilung');
    full.players[me].mana = 10;
    full.players[me].hand = [{ uid: 'h', defId: 'c29' }];
    expect(drachenspiel.applyMove(full, me, { type: 'playCard', handIndex: 0 }).events.some((e) => e.type === 'heroHealed')).toBe(false);
  });

  it('Flink greift im Zug des Ausspielens auch den Helden an, wie der Text sagt', () => {
    const s = drachenspiel.setup(2, { deckSelection: 'forest', mulligan: 'off' }, 'flink');
    const me = s.activeSeat;
    s.players[me].mana = 10;
    s.players[me].hand = [{ uid: 'f', defId: 'c53' }];
    const next = drachenspiel.applyMove(s, me, { type: 'playCard', handIndex: 0 }).state;
    expect(drachenspiel.legalMoves(next, me).some((m) => m.type === 'attack' && m.target.kind === 'hero')).toBe(true);
  });
});

describe('Regelkern', () => {
  const fresh = () => {
    const s = drachenspiel.setup(2, { deckSelection: 'forest', mulligan: 'off' }, 'kern');
    const me = s.activeSeat as 0 | 1;
    s.players[me].mana = 10;
    s.players[me].maxMana = 10;
    s.players[1 - me]!.armor = 0;
    return { s, me, opp: (1 - me) as 0 | 1 };
  };
  const figure = (id: string, cardId: string, owner: 0 | 1, playOrder: number, attack: number, health: number, extra: Partial<Minion> = {}): Minion => ({
    ...createTestMinion({ id, cardId, attack, health, owner, playOrder }),
    ...extra,
  });

  it('Abschiede gleichzeitig gefallener Tiere folgen der Spielreihenfolge, nicht dem Platz', () => {
    const { s, me, opp } = fresh();
    s.players[me].board = [figure('m_raupe', 'c51', me, 9, 1, 1)];
    s.players[opp].board = [figure('m_fisch', 'c20', opp, 3, 1, 1)];
    // Beide fallen durch denselben Tausch; zuerst wirkt die ältere Figur des Gegners. Ihr Schaden
    // trifft also noch nicht den Schmetterling, der erst danach erscheint.
    const res = drachenspiel.applyMove(s, me, { type: 'attack', attackerId: 'm_raupe', target: { kind: 'minion', id: 'm_fisch' } });
    const kinds = res.events.filter((e) => e.type === 'minionLeft' || e.type === 'damage' || e.type === 'minionSummoned').map((e) => e.type);
    expect(kinds).toEqual(['damage', 'damage', 'minionLeft', 'minionLeft', 'minionSummoned']);
    expect(res.state.players[me].board[0]).toMatchObject({ cardId: 'token_butterfly', bubble: true });
    expect(res.state.queue).toEqual([]);
  });

  it('Ketten aus Abschieden laufen, bis niemand mehr fällt', () => {
    const { s, me, opp } = fresh();
    s.players[me].board = [figure('m_a', 'c20', me, 1, 1, 1), figure('m_c', 'c20', me, 4, 1, 1)];
    s.players[opp].board = [figure('m_b', 'c20', opp, 2, 1, 2)];
    const res = drachenspiel.applyMove(s, me, { type: 'attack', attackerId: 'm_a', target: { kind: 'minion', id: 'm_b' } });
    expect(res.state.players[opp].board).toEqual([]);
    expect(res.state.players[me].board.map((m) => m.id)).toEqual([]);
  });

  it('Schaden bleibt, wenn Verstärkungen hinzukommen, und Heilung geht bis zum neuen Maximum', () => {
    const { s, me } = fresh();
    s.players[me].board = [figure('m_x', 'c43', me, 1, 2, 4, { health: 1, damage: 3 })];
    s.players[me].hand = [{ uid: 'h', defId: 's_honey' }];
    const buffed = drachenspiel.applyMove(s, me, { type: 'playCard', handIndex: 0, target: { kind: 'minion', id: 'm_x' } }).state;
    expect(buffed.players[me].board[0]).toMatchObject({ attack: 4, maxHealth: 6, health: 3, damage: 3 });
    expect(buffed.players[me].board[0]!.enchantments).toHaveLength(1);
  });

  it('fallen beide Helden in derselben Aktion, ist es unentschieden', () => {
    const { s, me, opp } = fresh();
    s.players[me].health = 1;
    s.players[opp].health = 1;
    s.players[me].deck = [];
    s.players[me].fatigue = 5;
    s.players[opp].deck = [];
    s.players[opp].fatigue = 5;
    const next = drachenspiel.applyMove(s, me, { type: 'endTurn' }).state;
    expect(next.players[opp].health).toBeLessThanOrEqual(0);
    expect(drachenspiel.result(next)?.kind).toBe('win');
    next.players[me].health = 0;
    expect(drachenspiel.result(next)?.kind).toBe('draw');
  });

  it('nach der Zuggrenze endet die Partie unentschieden', () => {
    const { s, me } = fresh();
    s.turn = 89;
    const next = drachenspiel.applyMove(s, me, { type: 'endTurn' }).state;
    expect(next.phase).toBe('ended');
    expect(drachenspiel.result(next)).toMatchObject({ kind: 'draw' });
  });

  it('volles Feld meldet das verlorene Tier', () => {
    const { s, me } = fresh();
    s.players[me].board = Array.from({ length: 6 }, (_, i) => figure(`m_${i}`, 'c43', me, i, 1, 1));
    s.players[me].hand = [{ uid: 'a', defId: 'c1' }];
    const res = drachenspiel.applyMove(s, me, { type: 'playCard', handIndex: 0 });
    expect(res.state.players[me].board).toHaveLength(7);
    expect(res.events.some((e) => e.type === 'boardFull')).toBe(true);
  });

  it('alte Spielstände ohne Veränderungsliste spielen weiter', () => {
    const { s, me } = fresh();
    const old = { ...figure('m_alt', 'c43', me, 0, 4, 6, { baseAttack: 2, baseHealth: 4, health: 5 }) } as Partial<Minion>;
    delete old.damage;
    delete old.enchantments;
    delete old.playOrder;
    delete old.owner;
    s.players[me].board = [old as Minion];
    delete (s as Partial<typeof s>).queue;
    const next = drachenspiel.applyMove(s, me, { type: 'endTurn' }).state;
    expect(next.players[me].board[0]).toMatchObject({ attack: 4, maxHealth: 6, health: 5, damage: 1 });
  });

  it('jede Karte mit Wirkung hat einen erzeugten Text, und neue Effekte brauchen keinen Regelcode', () => {
    for (const def of Object.values(CARDS_DB)) {
      if (def.effects) expect(def.text, def.id).toMatch(/\S/);
    }
    const { s, me, opp } = fresh();
    CARDS_DB.test_neu = {
      id: 'test_neu', name: 'Probe', cost: 1, attack: 0, health: 0, emoji: '🧪', quote: '', isSpell: true, targeting: 'none',
      effects: [{ kind: 'damage', amount: 1, to: { pick: 'hero', side: 'enemy' } }, { kind: 'summon', cardId: 'token_ant', count: 2 }],
    };
    s.players[me].hand = [{ uid: 'n', defId: 'test_neu' }];
    const hp = s.players[opp].health;
    const next = drachenspiel.applyMove(s, me, { type: 'playCard', handIndex: 0 }).state;
    delete CARDS_DB.test_neu;
    expect(next.players[opp].health).toBe(hp - 1);
    expect(next.players[me].board.map((m) => m.cardId)).toEqual(['token_ant', 'token_ant']);
  });
});

describe('Held und Grundregeln', () => {
  function fresh(deckSelection = 'forest') {
    const s = drachenspiel.setup(2, { deckSelection, mulligan: 'off' }, `held-${deckSelection}`);
    const me = s.activeSeat as 0 | 1;
    const opp = (1 - me) as 0 | 1;
    s.players[me].mana = 10;
    s.players[me].maxMana = 10;
    s.players[opp].armor = 0;
    return { s, me, opp };
  }
  const heroAttacks = (s: DrachenspielState, seat: 0 | 1) => drachenspiel.legalMoves(s, seat).filter((m) => m.type === 'heroAttack');

  it('Rüstung fängt Schaden vor den Leben ab, auch Müdigkeit', () => {
    const { s, me, opp } = fresh();
    s.players[opp].armor = 2;
    s.players[me].board = [createTestMinion({ id: 'm_a', cardId: 'c43', attack: 3, health: 3 })];
    const hit = drachenspiel.applyMove(s, me, { type: 'attack', attackerId: 'm_a', target: { kind: 'hero' } }).state;
    expect(hit.players[opp]).toMatchObject({ armor: 0, health: 29 });

    s.players[opp].armor = 5;
    s.players[opp].deck = [];
    s.players[opp].fatigue = 2;
    const tired = drachenspiel.applyMove(s, me, { type: 'endTurn' }).state;
    expect(tired.players[opp]).toMatchObject({ armor: 2, health: 30, fatigue: 3 });
  });

  it('wer als Zweiter beginnt, startet mit 5 Rüstung', () => {
    const s = drachenspiel.setup(2, { deckSelection: 'forest', mulligan: 'off' }, 'ausgleich');
    expect(s.players[s.startingSeat].armor).toBe(0);
    expect(s.players[1 - s.startingSeat]!.armor).toBe(5);
  });

  it('die Hand fasst zehn Karten, die elfte verbrennt', () => {
    const { s, me, opp } = fresh();
    s.players[opp].hand = Array.from({ length: 9 }, (_, i) => ({ uid: `h${i}`, defId: 'c43' }));
    const ten = drachenspiel.applyMove(s, me, { type: 'endTurn' });
    expect(ten.state.players[opp].hand).toHaveLength(10);
    expect(ten.events.some((e) => e.type === 'cardBurned')).toBe(false);
    s.players[opp].hand.push({ uid: 'h9', defId: 'c43' });
    const burned = drachenspiel.applyMove(s, me, { type: 'endTurn' });
    expect(burned.state.players[opp].hand).toHaveLength(10);
    expect(burned.events.some((e) => e.type === 'cardBurned')).toBe(true);
  });

  it('die Sternschnuppe gibt auch bei zehn Kristallen eine elfte Einheit', () => {
    const { s, me } = fresh();
    s.players[me].hand = [{ uid: 's', defId: 'special_star' }];
    expect(drachenspiel.applyMove(s, me, { type: 'playCard', handIndex: 0 }).state.players[me].mana).toBe(11);
  });

  it('die Hauskraft kostet 2 Mana und geht einmal je Zug', () => {
    const { s, me, opp } = fresh('wild');
    s.players[me].mana = 1;
    expect(drachenspiel.legalMoves(s, me)).not.toContainEqual({ type: 'heroPower' });
    s.players[me].mana = 5;
    const used = drachenspiel.applyMove(s, me, { type: 'heroPower' }).state;
    expect(used.players[me]).toMatchObject({ mana: 3, armor: 2, powerUsed: true });
    expect(drachenspiel.legalMoves(used, me)).not.toContainEqual({ type: 'heroPower' });
    expect(() => drachenspiel.applyMove(used, me, { type: 'heroPower' })).toThrow();
    const back = drachenspiel.applyMove(drachenspiel.applyMove(used, me, { type: 'endTurn' }).state, opp, { type: 'endTurn' }).state;
    expect(back.players[me].powerUsed).toBe(false);
    expect(drachenspiel.legalMoves(back, me)).toContainEqual({ type: 'heroPower' });
  });

  it('ruft eine Kraft ein Tier, geht sie bei vollem Feld nicht', () => {
    for (const deck of ['farm', 'sea']) {
      const { s, me } = fresh(deck);
      s.players[me].board = Array.from({ length: 7 }, (_, i) => createTestMinion({ id: `m_${i}`, cardId: 'c43' }));
      expect(drachenspiel.legalMoves(s, me)).not.toContainEqual({ type: 'heroPower' });
      s.players[me].board.pop();
      const next = drachenspiel.applyMove(s, me, { type: 'heroPower' }).state;
      expect(next.players[me].board).toHaveLength(7);
    }
  });

  it('Gezeitenruf lost über den Partie-Seed: gleicher Stand, gleiches Tier; verschiedene Seeds streuen', () => {
    const summoned = (seed: string) => {
      const s = drachenspiel.setup(2, { deckSelection: 'sea', mulligan: 'off' }, seed);
      s.players[s.activeSeat].mana = 2;
      const next = drachenspiel.applyMove(s, s.activeSeat, { type: 'heroPower' }).state;
      return next.players[s.activeSeat].board[0]!.cardId;
    };
    expect(summoned('a')).toBe(summoned('a'));
    const seen = new Set(Array.from({ length: 40 }, (_, i) => summoned(`streu-${i}`)));
    expect(seen).toEqual(new Set(['token_mussel', 'token_shrimp', 'token_seahorse']));
  });

  it('Eichenkraft: Der Held greift diesen Zug an, danach nicht mehr', () => {
    const { s, me, opp } = fresh('forest');
    expect(heroAttacks(s, me)).toEqual([]);
    const powered = drachenspiel.applyMove(s, me, { type: 'heroPower' }).state;
    expect(powered.players[me]).toMatchObject({ armor: 1, heroAttackBonus: 1 });
    const hit = drachenspiel.applyMove(powered, me, { type: 'heroAttack', target: { kind: 'hero' } }).state;
    expect(hit.players[opp].health).toBe(29);
    expect(heroAttacks(hit, me)).toEqual([]);
    expect(() => drachenspiel.applyMove(hit, me, { type: 'heroAttack', target: { kind: 'hero' } })).toThrow();
    const after = drachenspiel.applyMove(powered, me, { type: 'endTurn' }).state;
    expect(after.players[me].heroAttackBonus).toBe(0);
  });

  it('Rüstzeug nutzt sich ab, bricht und bleibt über den Zug hinaus', () => {
    const { s, me, opp } = fresh('bugs');
    let state = drachenspiel.applyMove(s, me, { type: 'heroPower' }).state;
    expect(state.players[me].gear).toMatchObject({ attack: 1, durability: 2 });
    state = drachenspiel.applyMove(state, me, { type: 'heroAttack', target: { kind: 'hero' } }).state;
    expect(state.players[me].gear?.durability).toBe(1);
    state = drachenspiel.applyMove(state, me, { type: 'endTurn' }).state;
    state = drachenspiel.applyMove(state, opp, { type: 'endTurn' }).state;
    const res = drachenspiel.applyMove(state, me, { type: 'heroAttack', target: { kind: 'hero' } });
    expect(res.state.players[me].gear).toBeNull();
    expect(res.events.some((e) => e.type === 'gearBroken')).toBe(true);
    expect(res.state.players[opp].health).toBe(28);
  });

  it('der Held achtet Beschützer und Versteckte, ein Tier schlägt zurück, Gift trifft ihn nicht', () => {
    const { s, me, opp } = fresh();
    s.players[me].gear = { name: 'x', emoji: '🐝', attack: 2, durability: 2 };
    s.players[opp].board = [
      createTestMinion({ id: 'm_w', cardId: 'c43', attack: 3, health: 5, taunt: true, poisonous: true }),
      createTestMinion({ id: 'm_n', cardId: 'c43', attack: 1, health: 1 }),
      createTestMinion({ id: 'm_v', cardId: 'c43', attack: 1, health: 1, stealth: true }),
    ];
    expect(heroAttacks(s, me)).toEqual([{ type: 'heroAttack', target: { kind: 'minion', id: 'm_w' } }]);
    expect(() => drachenspiel.applyMove(s, me, { type: 'heroAttack', target: { kind: 'hero' } })).toThrow();
    s.players[me].armor = 1;
    const next = drachenspiel.applyMove(s, me, { type: 'heroAttack', target: { kind: 'minion', id: 'm_w' } }).state;
    expect(next.players[opp].board.find((m) => m.id === 'm_w')!.health).toBe(3);
    expect(next.players[me]).toMatchObject({ armor: 0, health: 28 });
  });

  it('stirbt der Held am Gegenschlag, ist die Partie aus', () => {
    const { s, me, opp } = fresh();
    s.players[me].gear = { name: 'x', emoji: '🐝', attack: 1, durability: 1 };
    s.players[me].health = 2;
    s.players[opp].board = [createTestMinion({ id: 'm_w', cardId: 'c43', attack: 5, health: 5 })];
    const next = drachenspiel.applyMove(s, me, { type: 'heroAttack', target: { kind: 'minion', id: 'm_w' } }).state;
    expect(next.phase).toBe('ended');
    expect(drachenspiel.result(next)).toMatchObject({ kind: 'win', winners: [opp] });
  });

  it('das gemischte Deck bekommt eine Hauskraft aus dem Seed', () => {
    const powers = new Set(Array.from({ length: 30 }, (_, i) => drachenspiel.setup(2, { deckSelection: 'random', mulligan: 'off' }, `m-${i}`).players[0].power));
    expect(powers.has(null)).toBe(false);
    expect(powers.size).toBeGreaterThan(1);
  });

  it('die Deckwahl im Spiel setzt die Hauskraft', () => {
    const s = drachenspiel.setup(2, { deckSelection: 'inGame', mulligan: 'off' }, 'wahl');
    expect(drachenspiel.applyMove(s, 0, { type: 'chooseDeck', deck: 'sea' }).state.players[0].power).toBe('sea');
  });

  it('alte Spielstände ohne Heldenfelder spielen weiter', () => {
    const { s, me, opp } = fresh('wild');
    s.players[opp].maxMana = 5;
    for (const p of s.players) {
      const old = p as Partial<typeof p>;
      delete old.armor;
      delete old.gear;
      delete old.heroAttackBonus;
      delete old.heroAttacked;
      delete old.power;
      delete old.powerUsed;
    }
    expect(drachenspiel.playerView(s, me).players[opp]).toMatchObject({ armor: 0, gear: null, power: null });
    const next = drachenspiel.applyMove(s, me, { type: 'endTurn' }).state;
    expect(next.players[opp]).toMatchObject({ armor: 0, gear: null, power: 'wild', powerUsed: false });
    expect(drachenspiel.legalMoves(next, opp)).toContainEqual({ type: 'heroPower' });
  });

  it('jede Hauskraft hat einen erzeugten Text und jeder Spielstein ist kein Deck-Tier', () => {
    for (const power of Object.values(HOUSE_POWERS)) {
      expect(power.text.length).toBeGreaterThan(5);
      expect(power.text).not.toContain('undefined');
    }
    expect(HOUSE_POWERS.sea.text).toBe('Ruft zufällig eine Muschel (0/2 mit Beschützer), eine Garnele (1/1 mit Flink) oder ein Seepferdchen (1/2) herbei.');
    for (const id of ['token_chick', 'token_mussel', 'token_shrimp', 'token_seahorse']) expect(ALL_CARD_IDS).not.toContain(id);
  });
});

describe('Dauerhafte Stichwörter', () => {
  function fresh() {
    const s = drachenspiel.setup(2, { deckSelection: 'forest', mulligan: 'off' }, 'stichwort');
    const me = s.activeSeat as 0 | 1;
    const opp = (1 - me) as 0 | 1;
    s.players[me].mana = 10;
    s.players[me].maxMana = 10;
    s.players[opp].armor = 0;
    return { s, me, opp };
  }
  const beast = (id: string, attack: number, health: number, extra: Partial<Minion> = {}) => ({ ...createTestMinion({ id, cardId: 'c43', attack, health }), ...extra });
  const attack = (s: DrachenspielState, seat: 0 | 1, attackerId: string, target: { kind: 'hero' } | { kind: 'minion'; id: string }) => drachenspiel.applyMove(s, seat, { type: 'attack', attackerId, target }).state;
  const play = (s: DrachenspielState, seat: 0 | 1, defId: string) => {
    s.players[seat].hand = [{ uid: 'k', defId }];
    return drachenspiel.applyMove(s, seat, { type: 'playCard', handIndex: 0 }).state;
  };

  it('Sprinter greift im ersten Zug nur Tiere an, danach auch den Helden', () => {
    const { s, me, opp } = fresh();
    s.players[opp].board = [beast('m_x', 1, 9)];
    const next = play(s, me, 'c6');
    const rat = next.players[me].board[0]!;
    const moves = drachenspiel.legalMoves(next, me).filter((m) => m.type === 'attack' && m.attackerId === rat.id);
    expect(moves).toEqual([{ type: 'attack', attackerId: rat.id, target: { kind: 'minion', id: 'm_x' } }]);
    expect(() => attack(next, me, rat.id, { kind: 'hero' })).toThrow();
    const later = drachenspiel.applyMove(drachenspiel.applyMove(next, me, { type: 'endTurn' }).state, opp, { type: 'endTurn' }).state;
    expect(drachenspiel.legalMoves(later, me)).toContainEqual({ type: 'attack', attackerId: rat.id, target: { kind: 'hero' } });
  });

  it('Doppelschlag greift zweimal an, nicht dreimal', () => {
    const { s, me, opp } = fresh();
    s.players[me].board = [beast('m_d', 2, 5, { doubleStrike: true })];
    let next = attack(s, me, 'm_d', { kind: 'hero' });
    next = attack(next, me, 'm_d', { kind: 'hero' });
    expect(next.players[opp].health).toBe(26);
    expect(() => attack(next, me, 'm_d', { kind: 'hero' })).toThrow();
  });

  it('Lebenskraft heilt um den zugefügten Schaden, auch beim Gegenschlag, nicht an der Schutzblase', () => {
    const { s, me, opp } = fresh();
    s.players[me].health = 20;
    s.players[me].board = [beast('m_l', 3, 9, { lifesteal: true })];
    expect(attack(s, me, 'm_l', { kind: 'hero' }).players[me].health).toBe(23);
    s.players[opp].board = [beast('m_b', 1, 5, { bubble: true })];
    expect(attack(s, me, 'm_l', { kind: 'minion', id: 'm_b' }).players[me].health).toBe(20);
    s.players[opp].board = [beast('m_a', 3, 9)];
    s.players[me].board = [beast('m_o', 1, 9), beast('m_l', 2, 9, { lifesteal: true, canAttack: false })];
    s.players[me].board[0]!.taunt = true;
    const turn = drachenspiel.applyMove(s, me, { type: 'endTurn' }).state;
    turn.players[me].board = [beast('m_l', 2, 9, { lifesteal: true })];
    expect(attack(turn, opp, 'm_a', { kind: 'minion', id: 'm_l' }).players[me].health).toBe(22);
  });

  it('Kältestarre: Der Getroffene setzt seinen nächsten Angriff aus und taut dann auf', () => {
    const { s, me, opp } = fresh();
    s.players[me].board = [beast('m_f', 1, 9, { frostbite: true })];
    s.players[opp].board = [beast('m_z', 2, 9)];
    let next = attack(s, me, 'm_f', { kind: 'minion', id: 'm_z' });
    expect(next.players[opp].board[0]!.frozen).toBe(true);
    next = drachenspiel.applyMove(next, me, { type: 'endTurn' }).state;
    expect(drachenspiel.legalMoves(next, opp).some((m) => m.type === 'attack')).toBe(false);
    next = drachenspiel.applyMove(next, opp, { type: 'endTurn' }).state;
    expect(next.players[opp].board[0]!.frozen).toBeUndefined();
    next = drachenspiel.applyMove(next, me, { type: 'endTurn' }).state;
    expect(drachenspiel.legalMoves(next, opp).some((m) => m.type === 'attack')).toBe(true);
  });

  it('wer nach seinem Angriff erstarrt, setzt den folgenden Zug aus', () => {
    const { s, me, opp } = fresh();
    s.players[me].board = [beast('m_a', 1, 9)];
    s.players[opp].board = [beast('m_f', 1, 9, { frostbite: true })];
    let next = attack(s, me, 'm_a', { kind: 'minion', id: 'm_f' });
    expect(next.players[me].board[0]!.frozen).toBe(true);
    next = drachenspiel.applyMove(next, me, { type: 'endTurn' }).state;
    next = drachenspiel.applyMove(next, opp, { type: 'endTurn' }).state;
    expect(drachenspiel.legalMoves(next, me).some((m) => m.type === 'attack')).toBe(false);
  });

  it('Zweite Chance: einmal zurück mit 1 Leben, nach dem Abschied, beim zweiten Mal endgültig', () => {
    const { s, me, opp } = fresh();
    s.players[me].board = [beast('m_o', 9, 9)];
    s.players[opp].board = [{ ...createTestMinion({ id: 'm_c', cardId: 'c28', attack: 3, health: 2 }), reborn: true }];
    let next = attack(s, me, 'm_o', { kind: 'minion', id: 'm_c' });
    const back = next.players[opp].board[0]!;
    expect(back).toMatchObject({ cardId: 'c28', health: 1, maxHealth: 2 });
    expect(back.reborn).toBeUndefined();
    next.players[me].board[0]!.hasAttacked = false;
    next.players[me].board[0]!.canAttack = true;
    next = attack(next, me, 'm_o', { kind: 'minion', id: back.id });
    expect(next.players[opp].board).toHaveLength(0);
  });

  it('Naturkraft verstärkt Zauber, nicht Auftritte', () => {
    const { s, me, opp } = fresh();
    s.players[me].board = [beast('m_n', 1, 1, { spellPower: 1 })];
    s.players[me].hand = [{ uid: 'z', defId: 's_lightning' }];
    const hit = drachenspiel.applyMove(s, me, { type: 'playCard', handIndex: 0, target: { kind: 'hero' } }).state;
    expect(hit.players[opp].health).toBe(26);
    s.players[opp].board = [beast('m_t', 1, 9)];
    expect(play(s, me, 'c54').players[opp].board[0]!.health).toBe(7);
  });

  it('Eingerollt nimmt keinen Schaden und endet mit dem eigenen nächsten Zug', () => {
    const { s, me, opp } = fresh();
    const next = play(s, me, 'c10');
    const snail = next.players[me].board[0]!;
    expect(snail.immune).toBe(true);
    const turn = drachenspiel.applyMove(next, me, { type: 'endTurn' }).state;
    turn.players[opp].board = [beast('m_a', 5, 9)];
    const hit = attack(turn, opp, 'm_a', { kind: 'minion', id: snail.id });
    expect(hit.players[me].board[0]!.health).toBe(2);
    expect(drachenspiel.applyMove(hit, opp, { type: 'endTurn' }).state.players[me].board[0]!.immune).toBeUndefined();
  });

  it('Scheu ist kein Zauberziel, Flächenzauber treffen es trotzdem', () => {
    const { s, me, opp } = fresh();
    s.players[opp].board = [beast('m_s', 1, 9, { elusive: true })];
    s.players[me].hand = [{ uid: 'z', defId: 's_lightning' }, { uid: 'w', defId: 's_whirlwind' }];
    expect(() => drachenspiel.applyMove(s, me, { type: 'playCard', handIndex: 0, target: { kind: 'minion', id: 'm_s' } })).toThrow();
    expect(drachenspiel.applyMove(s, me, { type: 'playCard', handIndex: 1 }).state.players[opp].board[0]!.health).toBe(7);
  });

  it('Beruhigen nimmt Fähigkeiten und Verstärkungen, Abschied und Zweite Chance entfallen', () => {
    const { s, me, opp } = fresh();
    s.players[opp].board = [{ ...createTestMinion({ id: 'm_r', cardId: 'c51', attack: 3, health: 3, taunt: true }), baseAttack: 1, baseHealth: 1, reborn: true, damage: 2, enchantments: [{ id: 'e', source: 'x', attack: 2, health: 4 }], maxHealth: 5, health: 3 }];
    s.players[me].hand = [{ uid: 'q', defId: 's_quiet' }];
    const quiet = drachenspiel.applyMove(s, me, { type: 'playCard', handIndex: 0, target: { kind: 'minion', id: 'm_r' } }).state;
    const m = quiet.players[opp].board[0]!;
    expect(m).toMatchObject({ attack: 1, maxHealth: 1, health: 1, taunt: false, silenced: true, enchantments: [] });
    expect(m.reborn).toBeUndefined();
    quiet.players[me].board = [beast('m_o', 5, 5)];
    expect(attack(quiet, me, 'm_o', { kind: 'minion', id: 'm_r' }).players[opp].board).toHaveLength(0);
  });

  it('das Schaf beruhigt alle anderen Tiere, sich selbst nicht', () => {
    const { s, me, opp } = fresh();
    s.players[me].board = [beast('m_a', 1, 1, { taunt: true })];
    s.players[opp].board = [beast('m_b', 1, 1, { taunt: true })];
    const next = play(s, me, 'c37');
    expect(next.players[me].board.map((m) => Boolean(m.silenced))).toEqual([true, false]);
    expect(next.players[opp].board[0]!.taunt).toBe(false);
  });

  it('Tauschen kostet 1 Mana, die Karte geht ins Deck, eine neue kommt', () => {
    const { s, me } = fresh();
    s.players[me].hand = [{ uid: 'k', defId: 'c36' }, { uid: 'l', defId: 'c43' }];
    const size = s.players[me].deck.length;
    expect(drachenspiel.legalMoves(s, me)).toContainEqual({ type: 'tradeCard', handIndex: 0 });
    expect(drachenspiel.legalMoves(s, me)).not.toContainEqual({ type: 'tradeCard', handIndex: 1 });
    expect(() => drachenspiel.applyMove(s, me, { type: 'tradeCard', handIndex: 1 })).toThrow();
    const next = drachenspiel.applyMove(s, me, { type: 'tradeCard', handIndex: 0 }).state;
    expect(next.players[me].mana).toBe(9);
    expect(next.players[me].hand).toHaveLength(2);
    expect(next.players[me].deck).toHaveLength(size);
    s.players[me].mana = 0;
    expect(drachenspiel.legalMoves(s, me).some((m) => m.type === 'tradeCard')).toBe(false);
  });

  it('flüchtige Karten verschwinden am Zugende und der Gegner erfährt nicht, welche', () => {
    const { s, me, opp } = fresh();
    s.players[me].hand = [{ uid: 'a', defId: 'c34' }, { uid: 'b', defId: 'c43' }];
    const next = drachenspiel.applyMove(s, me, { type: 'playCard', handIndex: 0 }).state;
    const given = next.players[me].hand.find((c) => c.defId === 's_lightning')!;
    expect(given.fleeting).toBe(true);
    const res = drachenspiel.applyMove(next, me, { type: 'endTurn' });
    expect(res.state.players[me].hand.map((c) => c.uid)).toEqual(['b']);
    const faded = res.events.find((e) => e.type === 'cardFaded')!;
    expect(drachenspiel.eventView!(faded, opp)).toMatchObject({ card: undefined });
  });

  it('kein Haus hat mehr als 30 % textlose Tiere', () => {
    for (const theme of DECK_THEME_IDS) {
      const animals = [...new Set(themeCardIds(theme, true))].map((id) => CARDS_DB[id]!).filter((def) => !def.isSpell);
      const plain = animals.filter((def) => !def.keywords?.length && !def.triggers?.length && !def.spellPower);
      expect(plain.length / animals.length, theme).toBeLessThanOrEqual(0.3);
    }
  });
});

describe('Entscheidungen', () => {
  function fresh() {
    const s = drachenspiel.setup(2, { deckSelection: 'forest', mulligan: 'off' }, 'wahl-test');
    const me = s.activeSeat as 0 | 1;
    const opp = (1 - me) as 0 | 1;
    s.players[me].mana = 10;
    s.players[me].maxMana = 10;
    s.players[opp].armor = 0;
    return { s, me, opp };
  }
  const beast = (id: string, attack: number, health: number, extra: Partial<Minion> = {}) => ({ ...createTestMinion({ id, cardId: 'c43', attack, health }), ...extra });
  const hand = (s: DrachenspielState, seat: 0 | 1, ...ids: string[]) => {
    s.players[seat].hand = ids.map((defId, i) => ({ uid: `k${i}`, defId }));
  };
  const playAt = (s: DrachenspielState, seat: 0 | 1, handIndex: number, target?: { kind: 'minion'; id: string } | { kind: 'hero' }) =>
    drachenspiel.applyMove(s, seat, target ? { type: 'playCard', handIndex, target } : { type: 'playCard', handIndex }).state;

  it('ein Auftritt mit Ziel verlangt das Ziel und wirkt darauf', () => {
    const { s, me, opp } = fresh();
    s.players[opp].board = [beast('m_a', 3, 9)];
    hand(s, me, 'c18');
    expect(() => playAt(s, me, 0)).toThrow();
    const next = playAt(s, me, 0, { kind: 'minion', id: 'm_a' });
    expect(next.players[opp].board[0]!.frozen).toBe(true);
    expect(next.players[me].board[0]!.cardId).toBe('c18');
  });

  it('ohne mögliches Ziel lässt sich das Tier trotzdem legen', () => {
    const { s, me, opp } = fresh();
    s.players[opp].board = [beast('m_s', 1, 1, { stealth: true })];
    hand(s, me, 'c18');
    expect(drachenspiel.legalMoves(s, me)).toContainEqual({ type: 'playCard', handIndex: 0 });
    expect(playAt(s, me, 0).players[me].board).toHaveLength(1);
  });

  it('Fährte suchen hält an, bietet drei verschiedene Karten, nur der Wählende sieht sie', () => {
    const { s, me, opp } = fresh();
    hand(s, me, 's_tracks');
    const open = playAt(s, me, 0);
    expect(drachenspiel.currentPlayers(open)).toEqual([me]);
    const moves = drachenspiel.legalMoves(open, me);
    expect(moves).toEqual([{ type: 'choose', index: 0 }, { type: 'choose', index: 1 }, { type: 'choose', index: 2 }]);
    expect(() => drachenspiel.applyMove(open, me, { type: 'endTurn' })).toThrow();
    expect(() => drachenspiel.applyMove(open, opp, { type: 'choose', index: 0 })).toThrow();
    const offered = open.pending!.options.map((o) => o.cardId!);
    expect(new Set(offered).size).toBe(3);
    expect(offered.every((id) => !CARDS_DB[id]!.isSpell && !CARDS_DB[id]!.token)).toBe(true);
    expect(drachenspiel.playerView(open, me).pending!.options).toHaveLength(3);
    expect(drachenspiel.playerView(open, opp).pending).toMatchObject({ options: [], count: 3 });
    expect(drachenspiel.playerView(open, 'spectator').pending!.options).toEqual([]);
    const done = drachenspiel.applyMove(open, me, { type: 'choose', index: 1 }).state;
    expect(done.pending).toBeUndefined();
    expect(done.players[me].hand.map((c) => c.defId)).toEqual([offered[1]]);
  });

  it('die Wahlkarte führt nur die gewählte Wirkung aus', () => {
    const { s, me } = fresh();
    hand(s, me, 'c24');
    const open = playAt(s, me, 0);
    const size = open.players[me].hand.length;
    const buffed = drachenspiel.applyMove(open, me, { type: 'choose', index: 1 }).state;
    expect(buffed.players[me].board[0]).toMatchObject({ attack: 3, health: 4 });
    expect(buffed.players[me].hand).toHaveLength(size);
    const drew = drachenspiel.applyMove(open, me, { type: 'choose', index: 0 }).state;
    expect(drew.players[me].board[0]).toMatchObject({ attack: 2, health: 3 });
    expect(drew.players[me].hand).toHaveLength(size + 1);
  });

  it('Anpassen verbessert das Tier selbst', () => {
    const { s, me } = fresh();
    hand(s, me, 'c9');
    const open = playAt(s, me, 0);
    expect(open.pending!.options).toHaveLength(3);
    const before = JSON.stringify(open.players[me].board[0]);
    const next = drachenspiel.applyMove(open, me, { type: 'choose', index: 0 }).state;
    expect(JSON.stringify(next.players[me].board[0])).not.toBe(before);
  });

  it('eine Wahl aus einem Abschied gehört dem Besitzer des Tiers, auch im fremden Zug', () => {
    const { s, me, opp } = fresh();
    s.players[me].board = [beast('m_h', 9, 9)];
    const saved = CARDS_DB.c51!.triggers;
    CARDS_DB.c51!.triggers = [{ on: 'death', do: [{ kind: 'discover', pool: 'spell' }] }];
    try {
      s.players[opp].board = [createTestMinion({ id: 'm_r', cardId: 'c51', attack: 1, health: 1 })];
      const open = drachenspiel.applyMove(s, me, { type: 'attack', attackerId: 'm_h', target: { kind: 'minion', id: 'm_r' } }).state;
      expect(drachenspiel.currentPlayers(open)).toEqual([opp]);
      const done = drachenspiel.applyMove(open, opp, { type: 'choose', index: 0 }).state;
      expect(drachenspiel.currentPlayers(done)).toEqual([me]);
    } finally {
      CARDS_DB.c51!.triggers = saved;
    }
  });

  it('Rudeltaktik wirkt erst nach einer anderen Karte im selben Zug', () => {
    const { s, me } = fresh();
    hand(s, me, 'c2', 'c2', 'c43');
    const first = playAt(s, me, 0);
    expect(first.players[me].board[0]!.attack).toBe(2);
    const second = playAt(first, me, 0);
    expect(second.players[me].board[1]!.attack).toBe(3);
    const opp = (1 - me) as 0 | 1;
    const next = drachenspiel.applyMove(drachenspiel.applyMove(second, me, { type: 'endTurn' }).state, opp, { type: 'endTurn' }).state;
    expect(next.players[me].cardsPlayedThisTurn).toBe(0);
  });

  it('Einzelgänger wirkt nur von den Rändern der Hand', () => {
    const { s, me } = fresh();
    hand(s, me, 'c43', 'c25', 'c43');
    expect(playAt(s, me, 1).players[me].board[0]!.health).toBe(4);
    hand(s, me, 'c25', 'c43', 'c43');
    expect(playAt(s, me, 0).players[me].board[0]!.health).toBe(6);
    hand(s, me, 'c43', 'c43', 'c25');
    expect(playAt(s, me, 2).players[me].board[0]!.health).toBe(6);
  });

  it('Erschöpfung sperrt im nächsten Zug Mana und nur dort', () => {
    const { s, me, opp } = fresh();
    s.players[me].maxMana = 5;
    hand(s, me, 'c42');
    let next = playAt(s, me, 0);
    expect(next.players[me].overloadNext).toBe(2);
    next = drachenspiel.applyMove(drachenspiel.applyMove(next, me, { type: 'endTurn' }).state, opp, { type: 'endTurn' }).state;
    expect(next.players[me]).toMatchObject({ maxMana: 6, mana: 4, locked: 2, overloadNext: 0 });
    next = drachenspiel.applyMove(drachenspiel.applyMove(next, me, { type: 'endTurn' }).state, opp, { type: 'endTurn' }).state;
    expect(next.players[me]).toMatchObject({ mana: 7, locked: 0 });
  });

  it('bei Zeitablauf gilt die erste Möglichkeit', () => {
    const { s, me } = fresh();
    hand(s, me, 's_harvest');
    expect(drachenspiel.timeoutMove!(playAt(s, me, 0), me)).toEqual({ type: 'choose', index: 0 });
  });

  it.each(['easy', 'medium', 'hard'] as const)('der Bot auf „%s“ beantwortet eine offene Wahl', (level) => {
    const { s, me } = fresh();
    hand(s, me, 's_tracks');
    const open = playAt(s, me, 0);
    const move = gameModule.bots[0]!.chooseMove({ module: gameModule, view: gameModule.playerView(open, me), seat: me, level, rng: Rng.fromSeed('wahl'), timeBudgetMs: 200, now: () => Date.now() });
    expect(drachenspiel.legalMoves(open, me)).toContainEqual(move);
  });
});
