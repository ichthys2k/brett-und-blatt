/**
 * Kartensystem (#270, #277): Eigene Kartensets kommen online von der Raumleitung oder über das
 * offene Protokoll. Hier wird geprüft, dass nur Werte und Darstellung in sicheren Grenzen ankommen.
 */
import { describe, expect, it } from 'vitest';
import { resolveOptions, sanitizeCustomCardCatalog, type AnkiNote } from '../packages/engine/src';
import { parseClientMessage } from '../packages/online/src';
import { gameModule as drachenspiel } from '../packages/games/drachenspiel/src';
import { cardDefOf } from '../packages/games/drachenspiel/src/rules';
import { gameModule as quartett } from '../packages/games/quartett/src';
import { gameModule as colorSorter } from '../packages/games/color-sorter/src';
import { catalogOptionFor, changedCatalog, overrideIndex } from '../apps/web/src/lib/activeCardSet';
import { Rng } from '../packages/engine/src';
import { sanitizeEffect, sanitizeTriggers } from '../packages/games/drachenspiel/src/customcards';
import { sanitizeQuartettSet } from '../packages/engine/src';
import { setOf } from '../packages/games/quartett/src/rules';
import { buildableCards, encodeDeck } from '../packages/games/drachenspiel/src/deckcode';
import { GAME_CARD_TEMPLATES, generateTemplateCollection } from '../apps/web/src/lib/gameCardTemplates';
import { sqlDeps } from '../apps/web/src/lib/ankiSql';
import { buildApkg, readApkg } from '../packages/engine/src';
import { decompress } from 'fzstd';
import initSqlJs from 'sql.js';

const evil = {
  checksum: 'abc123',
  notices: ['ok'],
  combatCards: {
    s_lightning: { id: 's_lightning', name: 'Großer Blitz', cost: 9999, attack: 'viel', health: -5, keywords: ['taunt', 'gottmodus'], effects: [{ kind: 'damage', amount: 999 }], isSpell: false, targeting: 'none' },
    __proto__: { cost: 1 },
  },
  courtCards: { juggler: { key: 'juggler', price: 1e9, multiplier: 0, baseChips: Number.NaN, effect: 'alles' }, unbekannt: { price: 3 } },
  quartettCards: { A1: { id: 'A1', name: 'Riesen-Elefant', values: { weight: 1e20, length: 'NaN', speed: '12', huge: { a: 1 } }, sources: { x: 'y' } } },
};

describe('Kartenset-Prüfung', () => {
  it('lässt nur bekannte Felder in Grenzen durch', () => {
    const cat = sanitizeCustomCardCatalog(JSON.stringify(evil))!;
    const card = cat.combatCards.s_lightning as unknown as Record<string, unknown>;
    expect(card).toMatchObject({ id: 's_lightning', name: 'Großer Blitz', cost: 20, health: 1 });
    expect(card.attack).toBeUndefined();
    // Effekte gehen roh und klein weiter; ihre Form prüft erst das Drachenspiel (sanitizeEffects).
    expect(card.effects).toEqual([{ kind: 'damage', amount: 999 }]);
    expect(card.isSpell).toBeUndefined();
    expect(cat.combatCards.s_lightning!.keywords).toEqual(['taunt']);
    expect(Object.keys(cat.combatCards)).toEqual(['s_lightning']);
    expect(cat.courtCards.juggler).toMatchObject({ price: 99, multiplier: 1 });
    expect((cat.courtCards.juggler as unknown as Record<string, unknown>).baseChips).toBeUndefined();
    expect(cat.quartettCards.A1!.values).toEqual({ weight: 1e12, speed: 12 });
    expect(cat.checksum).toBe('abc123');
  });

  it('weist Unsinn ab und versteht ältere Optionen', () => {
    expect(sanitizeCustomCardCatalog('kein json')).toBeNull();
    expect(sanitizeCustomCardCatalog([1, 2])).toBeNull();
    expect(sanitizeCustomCardCatalog({ s_honey: { cost: 3 } }, 'combat')!.combatCards.s_honey!.cost).toBe(3);
  });

  it('das Protokoll reicht nur das geprüfte Kartenset weiter', () => {
    const message = parseClientMessage(JSON.stringify({ type: 'setCustomCardCatalog', catalog: evil }));
    expect(message?.type).toBe('setCustomCardCatalog');
    const catalog = (message as unknown as { catalog: { combatCards: Record<string, Record<string, unknown>> } }).catalog;
    expect(catalog.combatCards.s_lightning!.isSpell).toBeUndefined();
    expect(parseClientMessage(JSON.stringify({ type: 'setCustomCardCatalog', catalog: 'x' }))).toBeNull();
  });

  it('die Spiele lassen die Option durch die Spielleitung (verborgene Option)', () => {
    const json = JSON.stringify({ checksum: 'abc', combatCards: { s_honey: { cost: 4 } } });
    for (const module of [drachenspiel, quartett, colorSorter]) expect(resolveOptions(module, { customCardCatalog: json }).customCardCatalog, module.info.id).toBe(json);
  });

  it('Drachenspiel behält Effekte und Kartenart, nimmt aber die Werte', () => {
    const state = drachenspiel.setup(2, { customCardCatalog: JSON.stringify(evil) }, 'kartenset');
    const def = cardDefOf(state, 's_lightning')!;
    expect(def.cost).toBe(20);
    expect(def.name).toBe('Großer Blitz');
    expect(def.isSpell).toBe(true);
    expect(def.effects).toEqual([{ kind: 'damage', amount: 3, to: { pick: 'chosen' } }]);
  });

  it('Quartett übernimmt nur gültige Werte bekannter Eigenschaften', () => {
    const state = quartett.setup(2, { set: 'tiere', customCardCatalog: JSON.stringify(evil) }, 'kartenset') as unknown as { customCardSet?: { cards: { id: string; name: string; values: Record<string, number> }[] } };
    const card = state.customCardSet?.cards.find((c) => c.id === 'A1');
    expect(card?.name).toBe('Riesen-Elefant');
    expect(card?.values.weight).toBe(1e12);
    expect(card?.values.speed).toBe(12);
    expect(Object.values(card?.values ?? {}).every(Number.isFinite)).toBe(true);
    expect(card?.values.huge).toBeUndefined();
  });

  it('Narrenhof nimmt nur bekannte Narren', () => {
    const state = colorSorter.setup(1, { customCardCatalog: JSON.stringify(evil) }, 'kartenset') as unknown as { customMods?: Record<string, unknown> };
    expect(Object.keys(state.customMods ?? {})).toEqual(['juggler']);
    expect((state.customMods?.juggler as Record<string, unknown>).effect).toBeUndefined();
  });
});

describe('Aktives Kartenset in der Web-App', () => {
  it('gibt nur geänderte Karten weiter und nur an passende Spiele', async () => {
    const cat = sanitizeCustomCardCatalog({ checksum: 'abc', combatCards: { s_lightning: { name: 'Großer Blitz', cost: 20, health: 1, keywords: ['taunt'] } } })!;
    const official = sanitizeCustomCardCatalog({ combatCards: { s_lightning: { name: 'Großer Blitz', cost: 20, health: 1, keywords: ['taunt'] }, s_honey: { name: 'Honigtopf', cost: 1 } } })!;
    expect(changedCatalog('drachenspiel', cat, [official])).toBeNull();
    const more = { ...cat, combatCards: { ...cat.combatCards, s_honey: { id: 's_honey', name: 'Honigtopf', cost: 5 } } };
    expect(Object.keys(changedCatalog('drachenspiel', more, [official])!.combatCards)).toEqual(['s_honey']);
    expect(await catalogOptionFor('skat', cat)).toBeNull();
    expect(await catalogOptionFor('quartett', { ...cat, quartettCards: {} })).toBeNull();
  });

  it('findet Notizen unter Kennung, GUID und ohne Spiel-Präfix', () => {
    const note = { id: 1, guid: 'bub-combat-s_honey', mid: 1_600_000_002_002, did: 1, mod: 0, usn: 0, tags: [], fields: ['drachenspiel:s_honey', 'Honig'], sfld: '', csum: 0, flags: 0, data: '' } as unknown as AnkiNote;
    const index = overrideIndex([note]);
    expect(index['bub-combat-s_honey']).toBe(note);
    expect(index['drachenspiel:s_honey']).toBe(note);
    expect(index.s_honey).toBe(note);
  });
});

describe('Offizielle Kartensätze als Anki-Paket', () => {
  for (const template of GAME_CARD_TEMPLATES) {
    it(`${template.id}: lässt sich als .apkg bauen und wieder lesen`, async () => {
      const SQL = await initSqlJs();
      const deps = sqlDeps(SQL, decompress, () => {
        throw new Error('zstd nicht nötig');
      });
      const collection = await generateTemplateCollection(template.id);
      const read = readApkg(buildApkg({ collection }, { scheduling: false, media: false }, deps), deps);
      expect(read.collection.notes).toHaveLength(collection.notes.length);
    });
  }
});

describe('Drachenspiel: geprüfte Effekte und neue Begleiter aus Anki', () => {
  it('lässt nur bekannte Effekte in Grenzen zu', () => {
    expect(sanitizeEffect({ kind: 'damage', amount: 999, to: { pick: 'hero', side: 'enemy' } })).toEqual({ kind: 'damage', amount: 20, to: { pick: 'hero', side: 'enemy' } });
    expect(sanitizeEffect({ kind: 'damage', amount: 2, to: { pick: 'everything' } })).toBeNull();
    expect(sanitizeEffect({ kind: 'gottmodus' })).toBeNull();
    expect(sanitizeEffect({ kind: 'summon', cardId: 'gibt_es_nicht' })).toBeNull();
    expect(sanitizeEffect({ kind: 'draw', count: 50 })).toEqual({ kind: 'draw', count: 5 });
    expect(sanitizeEffect({ kind: 'grantKeyword', keyword: 'unsterblich', to: { pick: 'self' } })).toBeNull();
    const nested = { kind: 'chooseOne', options: [{ label: 'A', effects: [{ kind: 'chooseOne', options: [] }] }, { label: 'B', effects: [{ kind: 'draw', count: 1 }] }] };
    expect(sanitizeEffect(nested)).toBeNull();
    expect(sanitizeTriggers([{ on: 'played', do: [{ kind: 'heal', amount: 'full', to: { pick: 'self' } }, { kind: 'böse' }] }, { on: 'immer', do: [] }])).toEqual([{ on: 'played', do: [{ kind: 'heal', amount: 'full', to: { pick: 'self' } }] }]);
  });

  it('ein neuer Begleiter ist im eigenen Deck spielbar, mit seinem Auslöser', () => {
    const catalog = {
      checksum: 'abc',
      combatCards: {
        mein_igel: {
          name: 'Igel Ingo',
          cost: 1,
          attack: 3,
          health: 2,
          keywords: ['taunt', 'zaubern'],
          house: 'forest',
          triggers: [{ on: 'played', do: [{ kind: 'damage', amount: 2, to: { pick: 'hero', side: 'enemy' } }, { kind: 'böse' }] }],
        },
        'Böse Karte': { name: 'kaputt', cost: 1 },
      },
    };
    const options = { deckSelection: 'inGame', customCardCatalog: JSON.stringify(catalog) };
    let state = drachenspiel.setup(2, options, 'igel');
    const igel = cardDefOf(state, 'mein_igel')!;
    expect(igel).toMatchObject({ name: 'Igel Ingo', cost: 1, attack: 3, health: 2, keywords: ['taunt'], house: 'forest', triggers: [{ on: 'played', do: [{ kind: 'damage', amount: 2, to: { pick: 'hero', side: 'enemy' } }] }] });
    expect(cardDefOf(state, 'Böse Karte')).toBeUndefined();
    const extra = (state as unknown as { customCards: Record<string, never> }).customCards;
    expect(buildableCards('forest', extra).some((def) => def.id === 'mein_igel')).toBe(true);
    const others = buildableCards('forest').filter((def) => !def.quest && def.rarity !== 'mythic' && !def.singleCopy).slice(0, 14).flatMap((def) => [def.id, def.id]);
    const code = encodeDeck('forest', ['mein_igel', 'mein_igel', ...others]);
    state = drachenspiel.applyMove(state, 0, { type: 'chooseDeck', deck: 'forest', code }).state;
    state = drachenspiel.applyMove(state, 1, { type: 'chooseDeck', deck: 'sea' }).state;
    const ids = [...state.players[0].deck, ...state.players[0].hand].map((c) => c.defId);
    expect(ids.filter((id) => id === 'mein_igel')).toHaveLength(2);
    // Eine ganze Partie mit Bots läuft mit der neuen Karte durch.
    for (let step = 0; step < 3000 && !drachenspiel.result(state); step++) {
      const seat = drachenspiel.currentPlayers(state)[0] as 0 | 1;
      const move = drachenspiel.bots[0]!.chooseMove({ module: drachenspiel, view: drachenspiel.playerView(state, seat), seat, level: 'easy', rng: Rng.fromSeed(`igel/${step}`), timeBudgetMs: 50, now: () => Date.now() });
      state = drachenspiel.applyMove(state, seat, move).state;
    }
    expect(drachenspiel.result(state)).not.toBeNull();
  });
});

describe('Quartett: eigenes Set aus Anki', () => {
  const autos = {
    name: 'Autos',
    emoji: '🚗',
    properties: [
      { id: 'ps', label: 'Leistung', unit: 'PS', higherWins: true },
      { id: 'kmh', label: 'Höchstgeschwindigkeit', unit: 'km/h', higherWins: true },
      { id: 'liter', label: 'Verbrauch', unit: 'l', higherWins: false },
    ],
    groups: [{ id: 'A', name: 'Kleinwagen' }],
    cards: ['A', 'B', 'C'].flatMap((g, gi) => [1, 2, 3, 4].map((n) => ({ id: `${g}${n}`, name: `Auto ${g}${n}`, emoji: '🚗', values: { ps: 50 + gi * 40 + n * 7, kmh: 140 + gi * 20 + n, liter: 9 - n } }))),
  };

  it('prüft Gruppen, Eigenschaften und Werte', () => {
    const set = sanitizeQuartettSet(autos)!;
    expect(set.groups.map((g) => g.name)).toEqual(['Kleinwagen', 'Gruppe B', 'Gruppe C']);
    expect(sanitizeQuartettSet({ ...autos, cards: autos.cards.slice(1) })).toBeNull();
    expect(sanitizeQuartettSet({ ...autos, properties: autos.properties.slice(0, 1) })).toBeNull();
    const weird = sanitizeQuartettSet({ ...autos, cards: autos.cards.map((c) => ({ ...c, values: { ps: 'viel', kmh: Infinity } })) })!;
    expect(weird.cards[0]!.values).toEqual({ ps: 0, kmh: 0, liter: 0 });
  });

  for (const mode of ['trump', 'collect']) {
    it(`spielt eine ganze Partie mit dem eigenen Set (${mode})`, () => {
      let state = quartett.setup(3, { mode, set: 'tiere', customCardCatalog: JSON.stringify({ checksum: 'a1', quartettSet: autos }) }, `autos-${mode}`);
      expect(setOf(state as never).name).toBe('Autos');
      for (let step = 0; step < 5000 && !quartett.result(state); step++) {
        const seat = quartett.currentPlayers(state)[0] as number;
        const move = quartett.bots[0]!.chooseMove({ module: quartett, view: quartett.playerView(state, seat), seat, level: 'medium', rng: Rng.fromSeed(`q/${step}`), timeBudgetMs: 30, now: () => Date.now() });
        state = quartett.applyMove(state, seat, move).state;
      }
      expect(quartett.result(state)).not.toBeNull();
    });
  }
});

