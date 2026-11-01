import { Rng } from '@brett-und-blatt/engine';
import { describe, expect, it } from 'vitest';
import { drachenspiel, gameModule } from '../src';
import { CARDS_DB } from '../src/cards';
import { DECK_THEME_IDS, themeCardIds } from '../src/decks';
import type { DrachenspielState, Minion } from '../src/types';
import { getCardTraits } from '../src/ui/traits';

function fresh(deck = 'forest') {
  const s = drachenspiel.setup(2, { deckSelection: deck, mulligan: 'off' }, 'typen');
  const me = s.activeSeat as 0 | 1;
  const opp = (1 - me) as 0 | 1;
  s.players[me].mana = 10;
  s.players[me].maxMana = 10;
  s.players[opp].armor = 0;
  return { s, me, opp };
}
const beast = (id: string, attack: number, health: number, extra: Partial<Minion> = {}) =>
  ({ id, cardId: 'c43', owner: 0, playOrder: 1, name: id, emoji: '🐾', cost: 1, baseAttack: attack, attack, baseHealth: health, maxHealth: health, health, damage: 0, enchantments: [], quote: null, sound: null, taunt: false, rush: false, bubble: false, poisonous: false, stealth: false, canAttack: true, hasAttacked: false, ...extra }) as Minion;
const play = (s: DrachenspielState, seat: 0 | 1, defId: string) => {
  s.players[seat].hand = [{ uid: 'k', defId }];
  return drachenspiel.applyMove(s, seat, { type: 'playCard', handIndex: 0 }).state;
};
const endTwo = (s: DrachenspielState, me: 0 | 1, opp: 0 | 1) => drachenspiel.applyMove(drachenspiel.applyMove(s, me, { type: 'endTurn' }).state, opp, { type: 'endTurn' }).state;

describe('Bauten', () => {
  it('wirken einmal je Zug, kosten 1 Leben, greifen nicht an und fallen am Ende', () => {
    const { s, me, opp } = fresh();
    let state = play(s, me, 'f_dam');
    const dam = state.players[me].board[0]!;
    expect(drachenspiel.legalMoves(state, me).some((m) => m.type === 'attack')).toBe(false);
    state = drachenspiel.applyMove(state, me, { type: 'useBuilding', minionId: dam.id }).state;
    expect(state.players[me].armor).toBe(s.players[me].armor + 3);
    expect(state.players[me].board[0]!.health).toBe(3);
    expect(() => drachenspiel.applyMove(state, me, { type: 'useBuilding', minionId: dam.id })).toThrow();
    for (let i = 0; i < 3; i++) {
      state = endTwo(state, me, opp);
      state = drachenspiel.applyMove(state, me, { type: 'useBuilding', minionId: dam.id }).state;
    }
    expect(state.players[me].board).toHaveLength(0);
  });

  it('ein verstärkter Bau greift trotzdem nicht an, ein beruhigter wirkt nicht mehr', () => {
    const { s, me } = fresh();
    s.players[me].board = [beast('m_b', 3, 3, { cardId: 'f_dam', building: true })];
    expect(drachenspiel.legalMoves(s, me).filter((m) => m.type === 'attack')).toEqual([]);
    s.players[me].board = [beast('m_b', 0, 3, { cardId: 'f_dam', building: true, silenced: true })];
    expect(drachenspiel.legalMoves(s, me).some((m) => m.type === 'useBuilding')).toBe(false);
  });
});

describe('Winterschlaf', () => {
  it('ist unangreifbar und kein Ziel, Flächen treffen nicht, dann schlüpft das Ei', () => {
    const { s, me, opp } = fresh();
    let state = play(s, me, 'n_dragonegg');
    const egg = state.players[me].board[0]!;
    expect(egg.dormant).toBe(3);
    state = drachenspiel.applyMove(state, me, { type: 'endTurn' }).state;
    state.players[opp].board = [beast('m_a', 3, 3)];
    state.players[opp].mana = 10;
    expect(drachenspiel.legalMoves(state, opp)).not.toContainEqual({ type: 'attack', attackerId: 'm_a', target: { kind: 'minion', id: egg.id } });
    state.players[opp].hand = [{ uid: 'w', defId: 's_whirlwind' }, { uid: 'b', defId: 's_lightning' }];
    expect(() => drachenspiel.applyMove(state, opp, { type: 'playCard', handIndex: 1, target: { kind: 'minion', id: egg.id } })).toThrow();
    state = drachenspiel.applyMove(state, opp, { type: 'playCard', handIndex: 0 }).state;
    expect(state.players[me].board[0]!.health).toBe(1);
    state = drachenspiel.applyMove(state, opp, { type: 'endTurn' }).state;
    expect(state.players[me].board[0]!.dormant).toBe(2);
    state = endTwo(state, me, opp);
    state = endTwo(state, me, opp);
    const hatched = state.players[me].board[0]!;
    expect(hatched).toMatchObject({ cardId: 'token_eggdragon', attack: 7, id: egg.id, canAttack: true });
    expect(hatched.dormant).toBeUndefined();
    expect(drachenspiel.legalMoves(state, me)).toContainEqual({ type: 'attack', attackerId: egg.id, target: { kind: 'hero' } });
  });

  it('Beschützer im Winterschlaf schützen nicht, ein Schläfer greift nicht an', () => {
    const { s, me, opp } = fresh();
    s.players[me].board = [beast('m_a', 3, 3), beast('m_s', 3, 3, { dormant: 1 })];
    s.players[opp].board = [beast('m_t', 1, 1, { taunt: true, dormant: 1 })];
    const moves = drachenspiel.legalMoves(s, me);
    expect(moves).toContainEqual({ type: 'attack', attackerId: 'm_a', target: { kind: 'hero' } });
    expect(moves.some((m) => m.type === 'attack' && m.attackerId === 'm_s')).toBe(false);
  });
});

describe('Fallen', () => {
  it('liegen verdeckt: Der Gegner sieht nur die Anzahl, auch im Ereignis', () => {
    const { s, me, opp } = fresh();
    s.players[me].hand = [{ uid: 'k', defId: 'wild_pit' }];
    const res = drachenspiel.applyMove(s, me, { type: 'playCard', handIndex: 0 });
    expect(drachenspiel.playerView(res.state, opp).players[me]).toMatchObject({ traps: null, trapCount: 1 });
    expect(JSON.stringify(drachenspiel.playerView(res.state, opp))).not.toContain('wild_pit');
    expect(JSON.stringify(drachenspiel.playerView(res.state, 'spectator'))).not.toContain('wild_pit');
    expect(drachenspiel.playerView(res.state, me).players[me].traps![0]!.defId).toBe('wild_pit');
    const set = res.events.find((e) => e.type === 'trapSet')!;
    expect(drachenspiel.eventView!(set, opp)).toMatchObject({ card: undefined });
  });

  it('dieselbe Falle nur einmal, höchstens drei', () => {
    const { s, me } = fresh();
    s.players[me].traps = [{ uid: 'a', defId: 'wild_pit' }];
    s.players[me].hand = [{ uid: 'k', defId: 'wild_pit' }, { uid: 'l', defId: 'n_mask' }];
    const moves = drachenspiel.legalMoves(s, me);
    expect(moves).not.toContainEqual({ type: 'playCard', handIndex: 0 });
    expect(moves).toContainEqual({ type: 'playCard', handIndex: 1 });
    s.players[me].traps.push({ uid: 'b', defId: 'f_roottrap' }, { uid: 'c', defId: 'farm_alarm' });
    expect(drachenspiel.legalMoves(s, me)).not.toContainEqual({ type: 'playCard', handIndex: 1 });
  });

  it('die Fallgrube trifft vor dem Schlag; fällt der Angreifer, bleibt der Held heil', () => {
    const { s, me, opp } = fresh();
    s.players[opp].traps = [{ uid: 'a', defId: 'wild_pit' }];
    s.players[me].board = [beast('m_k', 5, 3), beast('m_z', 2, 9)];
    const res = drachenspiel.applyMove(s, me, { type: 'attack', attackerId: 'm_k', target: { kind: 'hero' } });
    expect(res.state.players[opp].health).toBe(s.players[opp].health);
    expect(res.state.players[opp].traps).toEqual([]);
    expect(res.state.players[me].board.map((m) => m.id)).toEqual(['m_z']);
    const next = drachenspiel.applyMove(res.state, me, { type: 'attack', attackerId: 'm_z', target: { kind: 'hero' } }).state;
    expect(next.players[opp].health).toBe(s.players[opp].health - 2);
  });

  it('eine Falle auf Tiere trifft das gespielte Tier, auf Zauber zieht sie Karten; eigene Züge lösen nichts aus', () => {
    const { s, me, opp } = fresh();
    s.players[opp].traps = [{ uid: 'a', defId: 'bug_sticky' }];
    const hit = play(s, me, 'c43');
    expect(hit.players[me].board[0]).toMatchObject({ frozen: true, health: 4 });
    s.players[opp].traps = [{ uid: 'a', defId: 'n_mask' }];
    const hand = s.players[opp].hand.length;
    expect(play(s, me, 's_clover').players[opp].hand).toHaveLength(hand + 2);
    s.players[me].traps = [{ uid: 'b', defId: 'n_mask' }];
    s.players[opp].traps = [];
    expect(play(s, me, 's_clover').players[me].traps).toHaveLength(1);
  });

  it('der Bot durchschaut sie nicht: Gleiche Sicht, gleicher Zug, egal welche Falle liegt', () => {
    const { s, me, opp } = fresh();
    s.players[me].board = [beast('m_k', 3, 3)];
    const choose = (trap: string) => {
      s.players[opp].traps = [{ uid: 'a', defId: trap }];
      const view = gameModule.playerView(s, me);
      return { view: JSON.stringify(view), move: gameModule.bots[0]!.chooseMove({ module: gameModule, view, seat: me, level: 'hard', rng: Rng.fromSeed('gleich'), timeBudgetMs: 5000, now: () => 0 }) };
    };
    const a = choose('wild_pit');
    const b = choose('n_mask');
    expect(a.view).toBe(b.view);
    expect(a.move).toEqual(b.move);
  });

  it('die Stichprobe erfindet nur Fallen, die in der Anzahl stimmen', () => {
    const { s, me, opp } = fresh();
    s.players[opp].traps = [{ uid: 'a', defId: 'f_roottrap' }];
    const sampled = gameModule.sampleHidden!(gameModule.playerView(s, me), me, Rng.fromSeed('x'));
    expect(sampled.players[opp].traps).toHaveLength(1);
    expect(CARDS_DB[sampled.players[opp].traps[0]!.defId]!.trap).toBeDefined();
  });
});

describe('Aufgaben', () => {
  it('sind offen, zählen passende Karten und geben am Ziel die Belohnung', () => {
    const { s, me, opp } = fresh();
    let state = play(s, me, 'f_quest');
    expect(drachenspiel.playerView(state, opp).players[me].quest).toEqual({ cardId: 'f_quest', progress: 0 });
    for (let i = 0; i < 3; i++) {
      state.players[me].mana = 10;
      state.players[me].board = [];
      state = play(state, me, 'c7');
    }
    state.players[me].board = [];
    state = play(state, me, 'c43');
    expect(state.players[me].quest?.progress).toBe(3);
    state.players[me].board = [];
    state = play(state, me, 'c7');
    expect(state.players[me].quest).toBeNull();
    expect(state.players[me].hand.map((c) => c.defId)).toContain('token_elder');
  });

  it('nur eine zur Zeit; Rüstung zählt für die Wildnis-Aufgabe', () => {
    const { s, me } = fresh('wild');
    let state = play(s, me, 'wild_quest');
    state.players[me].hand = [{ uid: 'q', defId: 'bug_quest' }];
    expect(drachenspiel.legalMoves(state, me)).not.toContainEqual({ type: 'playCard', handIndex: 0 });
    state.players[me].mana = 10;
    state = drachenspiel.applyMove(state, me, { type: 'heroPower' }).state;
    expect(state.players[me].quest?.progress).toBe(2);
  });
});

describe('Alte Spielstände und Decks', () => {
  it('laufen ohne Fallen und Aufgabe weiter', () => {
    const { s, me, opp } = fresh();
    for (const p of s.players) {
      const old = p as Partial<typeof p>;
      delete old.traps;
      delete old.quest;
    }
    expect(drachenspiel.playerView(s, me).players[opp]).toMatchObject({ trapCount: 0, quest: null });
    expect(drachenspiel.applyMove(s, me, { type: 'endTurn' }).state.players[opp]).toMatchObject({ traps: [], quest: null });
  });

  it('jedes Themendeck enthält Bau, Winterschlaf, Aufgabe und Falle; ohne Zauber fällt nur die Falle weg', () => {
    for (const theme of DECK_THEME_IDS) {
      const defs = themeCardIds(theme, true).map((id) => CARDS_DB[id]!);
      expect(defs.some((d) => d.building), theme).toBe(true);
      expect(defs.some((d) => d.dormant), theme).toBe(true);
      expect(defs.some((d) => d.quest), theme).toBe(true);
      expect(defs.some((d) => d.trap), theme).toBe(true);
      const off = themeCardIds(theme, false).map((id) => CARDS_DB[id]!);
      expect(off.some((d) => d.trap), theme).toBe(false);
      expect(off.some((d) => d.quest), theme).toBe(true);
    }
  });

  it('der Text nennt die Zahl gerufener Tiere', () => {
    expect(CARDS_DB.farm_alarm!.text).toContain('2× ein Küken');
    expect(CARDS_DB.farm_march!.text).toContain('3× ein Küken');
    expect(CARDS_DB.bug_cocoon!.text).toContain('schlüpft daraus: Falter (4/4)');
  });

  it('alle neuen Kartentypen erklären sich auf der Karte', () => {
    for (const def of Object.values(CARDS_DB)) {
      if (!def.trap && !def.quest && !def.building && !def.dormant) continue;
      expect(def.text, def.id).toBeTruthy();
      expect(def.text, def.id).not.toMatch(/undefined|dem Ziel|eine Karte\./);
      expect(getCardTraits(def).length, def.id).toBeGreaterThan(0);
    }
  });
});
