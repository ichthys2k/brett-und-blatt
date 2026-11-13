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
    expect(card.effects).toBeUndefined();
    expect(card.isSpell).toBeUndefined();
    expect(card.targeting).toBeUndefined();
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
    expect(catalog.combatCards.s_lightning!.effects).toBeUndefined();
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
    const cat = sanitizeCustomCardCatalog(evil)!;
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

