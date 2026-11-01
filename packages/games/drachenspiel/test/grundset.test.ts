import { describe, expect, it } from 'vitest';
import { drachenspiel } from '../src';
import { CARDS_DB } from '../src/cards';
import { DECK_THEME_IDS, DECK_THEMES, themeCardIds } from '../src/decks';
import { effectsText } from '../src/core/text';
import type { DrachenspielState, Effect } from '../src/types';
import { getCardTraits } from '../src/ui/traits';

const cards = Object.values(CARDS_DB).filter((def) => def.id !== 'special_star');
const collectible = cards.filter((def) => !def.token);

function fresh() {
  const s = drachenspiel.setup(2, { deckSelection: 'forest', mulligan: 'off' }, 'grund');
  const me = s.activeSeat as 0 | 1;
  const opp = (1 - me) as 0 | 1;
  s.players[me].mana = 10;
  s.players[me].maxMana = 10;
  s.players[opp].armor = 0;
  return { s, me, opp };
}
const offersChoice = (effects: Effect[]) => effects.some((e) => e.kind === 'discover' || e.kind === 'chooseOne' || e.kind === 'adapt');

describe('Kartentest über das ganze Grundset', () => {
  it('hat etwa 180 Karten: je Haus rund 30, dazu rund 30 neutrale', () => {
    expect(collectible.length).toBeGreaterThanOrEqual(170);
    for (const house of [...DECK_THEME_IDS, 'neutral']) {
      const size = collectible.filter((def) => def.house === house).length;
      expect(size, house).toBeGreaterThanOrEqual(25);
      expect(size, house).toBeLessThanOrEqual(35);
    }
  });

  it('jede Karte hat Haus, Seltenheit, Familie oder Schule und eine eindeutige Kennung', () => {
    for (const def of cards) {
      expect(def.house, def.id).toBeDefined();
      if (!def.token) expect(def.rarity, def.id).toBeDefined();
      if (def.isSpell) expect(def.school, def.id).toBeDefined();
      else if (!def.quest) expect(def.families?.length, def.id).toBeGreaterThan(0);
    }
  });

  it('jede Wirkung hat einen lesbaren, erzeugten Text', () => {
    for (const def of cards) {
      for (const trait of getCardTraits(def)) {
        expect(trait.description.length, def.id).toBeGreaterThan(3);
        expect(trait.description, def.id).not.toMatch(/undefined|dem Ziel/);
      }
      if (def.isSpell) expect(effectsText(def.effects ?? [], def.targeting ?? 'none', CARDS_DB), def.id).not.toMatch(/undefined|dem Ziel/);
    }
  });

  it('Spielsteine und Gerufenes gibt es wirklich, Wirkungen am Zugende bieten keine Wahl', () => {
    const check = (effects: Effect[], owner: string) => {
      for (const effect of effects) {
        if (effect.kind === 'summon' || effect.kind === 'addToHand') expect(CARDS_DB[effect.cardId], owner).toBeDefined();
        if (effect.kind === 'summonRandom') for (const id of effect.cardIds) expect(CARDS_DB[id], owner).toBeDefined();
      }
    };
    for (const def of cards) {
      check(def.effects ?? [], def.id);
      for (const trigger of def.triggers ?? []) {
        check(trigger.do, def.id);
        if (trigger.on === 'turnEnd' || trigger.on === 'spellCast') expect(offersChoice(trigger.do), def.id).toBe(false);
      }
      if (def.trap) {
        check(def.trap.do, def.id);
        expect(offersChoice(def.trap.do), def.id).toBe(false);
      }
      if (def.building) {
        check(def.building, def.id);
        expect(offersChoice(def.building), def.id).toBe(false);
      }
      if (def.quest) expect(CARDS_DB[def.quest.reward], def.id).toBeDefined();
      if (def.hatchesInto) expect(CARDS_DB[def.hatchesInto], def.id).toBeDefined();
    }
  });

  it('kein Tier liegt über dem Werte-Maßstab, außer Sagentieren', () => {
    for (const def of collectible) {
      if (def.isSpell || def.rarity === 'mythic') continue;
      expect(def.attack + def.health, `${def.id} ${def.name}`).toBeLessThanOrEqual(2 * def.cost + 2 + 2 * (def.overload ?? 0) + 2 * (def.dormant ?? 0));
    }
  });

  it('keine Figur trägt Namen des Vorbilds oder dunkle Begriffe', () => {
    for (const def of cards) expect(`${def.name} ${def.quote}`, def.id).not.toMatch(/hearthstone|warcraft|dämon|untot|leiche|\btod\b|\bblut\b/i);
  });
});

describe('Themendecks', () => {
  it('bestehen aus 30 Karten des eigenen Hauses und neutralen, höchstens zwei Kopien, Sagentiere einmal', () => {
    for (const theme of DECK_THEME_IDS) {
      for (const withSpells of [true, false]) {
        const ids = themeCardIds(theme, withSpells);
        expect(ids, theme).toHaveLength(30);
        for (const id of new Set(ids)) {
          const def = CARDS_DB[id]!;
          expect(def, id).toBeDefined();
          expect(ids.filter((x) => x === id).length, id).toBeLessThanOrEqual(def.rarity === 'mythic' ? 1 : 2);
          expect(def.house === theme || def.house === 'neutral', `${theme}: ${id}`).toBe(true);
        }
      }
      expect(DECK_THEMES[theme].spellSwap.in.every((id) => CARDS_DB[id]?.isSpell), theme).toBe(true);
    }
  });
});

describe('Neue Regeln des Grundsets', () => {
  const beast = (id: string, cardId: string, attack: number, health: number) =>
    ({ id, cardId, owner: 0, playOrder: 1, name: id, emoji: '🐾', cost: 1, baseAttack: attack, attack, baseHealth: health, maxHealth: health, health, damage: 0, enchantments: [], quote: null, sound: null, taunt: false, rush: false, bubble: false, poisonous: false, stealth: false, canAttack: true, hasAttacked: false }) as DrachenspielState['players'][0]['board'][0];

  it('Wirkungen am Zugende laufen vor dem Zugwechsel, nur beim eigenen Zug, beruhigte schweigen', () => {
    const { s, me, opp } = fresh();
    s.players[me].board = [beast('m_s', 'f_treefolk', 2, 4)];
    s.players[opp].board = [beast('m_o', 'f_treefolk', 2, 4)];
    const next = drachenspiel.applyMove(s, me, { type: 'endTurn' }).state;
    expect(next.players[me].board[0]!.maxHealth).toBe(5);
    expect(next.players[opp].board[0]!.maxHealth).toBe(4);
    expect(next.activeSeat).toBe(opp);
    s.players[me].board = [{ ...beast('m_s', 'f_treefolk', 2, 4), silenced: true }];
    expect(drachenspiel.applyMove(s, me, { type: 'endTurn' }).state.players[me].board[0]!.maxHealth).toBe(4);
  });

  it('ein Zugende, das die Partie beendet, gibt den Zug nicht weiter', () => {
    const { s, me, opp } = fresh();
    s.players[opp].health = 1;
    s.players[me].board = [beast('m_x', 'c20', 1, 1)];
    const saved = CARDS_DB.c20!.triggers;
    CARDS_DB.c20!.triggers = [{ on: 'turnEnd', do: [{ kind: 'damage', amount: 1, to: { pick: 'hero', side: 'enemy' } }] }];
    try {
      const next = drachenspiel.applyMove(s, me, { type: 'endTurn' }).state;
      expect(next.phase).toBe('ended');
      expect(next.activeSeat).toBe(me);
    } finally {
      CARDS_DB.c20!.triggers = saved;
    }
  });

  it('eine Wahl aus einem Abschied am Zugende hält an, danach ist der andere dran', () => {
    const { s, me, opp } = fresh();
    s.players[me].board = [{ ...beast('m_w', 'c51', 1, 1), damage: 0 }, beast('m_k', 'c20', 1, 3)];
    const saved = [CARDS_DB.c51!.triggers, CARDS_DB.c20!.triggers];
    CARDS_DB.c51!.triggers = [{ on: 'death', do: [{ kind: 'discover', pool: 'spell' }] }];
    CARDS_DB.c20!.triggers = [{ on: 'turnEnd', do: [{ kind: 'damage', amount: 1, to: { pick: 'allMinions', side: 'own' } }] }];
    try {
      const open = drachenspiel.applyMove(s, me, { type: 'endTurn' }).state;
      expect(open.pending?.seat).toBe(me);
      expect(open.activeSeat).toBe(me);
      const done = drachenspiel.applyMove(open, me, { type: 'choose', index: 0 }).state;
      expect(done.turnEnding).toBeUndefined();
      expect(done.activeSeat).toBe(opp);
    } finally {
      CARDS_DB.c51!.triggers = saved[0];
      CARDS_DB.c20!.triggers = saved[1];
    }
  });

  it('nach einem Zauber wächst der Uhu, die Sippe zählt nur andere Tiere, Familien-Stärkung trifft nur die Familie', () => {
    const { s, me } = fresh();
    s.players[me].board = [beast('m_u', 'f_eagleowl', 3, 6)];
    s.players[me].hand = [{ uid: 'z', defId: 's_clover' }];
    expect(drachenspiel.applyMove(s, me, { type: 'playCard', handIndex: 0 }).state.players[me].board[0]!.attack).toBe(4);

    s.players[me].board = [];
    s.players[me].hand = [{ uid: 'a', defId: 'n_dragonling' }];
    expect(drachenspiel.applyMove(s, me, { type: 'playCard', handIndex: 0 }).state.players[me].board[0]!.attack).toBe(3);
    s.players[me].board = [beast('m_d', 'c54', 1, 1)];
    s.players[me].hand = [{ uid: 'a', defId: 'n_dragonling' }];
    expect(drachenspiel.applyMove(s, me, { type: 'playCard', handIndex: 0 }).state.players[me].board[1]!.attack).toBe(5);

    s.players[me].board = [beast('m_h', 'c38', 1, 1), beast('m_v', 'c1', 1, 1)];
    s.players[me].hand = [{ uid: 'a', defId: 'farm_sheepdog' }];
    const herd = drachenspiel.applyMove(s, me, { type: 'playCard', handIndex: 0 }).state.players[me].board;
    expect(herd.map((m) => m.attack)).toEqual([2, 1, 2]);
  });

  it('der Zufallstreffer folgt dem Partie-Seed und trifft bei leerem Feld niemanden', () => {
    const { s, me, opp } = fresh();
    s.players[me].hand = [{ uid: 'b', defId: 'n_ballbolt' }];
    expect(drachenspiel.applyMove(s, me, { type: 'playCard', handIndex: 0 }).state.players[opp].health).toBe(s.players[opp].health);
    s.players[opp].board = [beast('m_a', 'c43', 1, 9), beast('m_b', 'c43', 1, 9)];
    const one = JSON.stringify(drachenspiel.applyMove(s, me, { type: 'playCard', handIndex: 0 }).state.players[opp].board);
    expect(JSON.stringify(drachenspiel.applyMove(s, me, { type: 'playCard', handIndex: 0 }).state.players[opp].board)).toBe(one);
  });

  it('Fährte suchen bleibt beim eigenen Haus und neutralen Karten, Sagentiere fehlen', () => {
    const { s, me } = fresh();
    for (let i = 0; i < 20; i++) {
      s.rng = drachenspiel.setup(2, { deckSelection: 'forest', mulligan: 'off' }, `f${i}`).rng;
      s.players[me].hand = [{ uid: 't', defId: 's_tracks' }];
      for (const option of drachenspiel.applyMove(s, me, { type: 'playCard', handIndex: 0 }).state.pending!.options) {
        const def = CARDS_DB[option.cardId!]!;
        expect(['forest', 'neutral']).toContain(def.house);
        expect(def.singleCopy, def.id).toBeFalsy();
      }
    }
  });
});
