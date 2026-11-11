import { describe, expect, it } from 'vitest';
import { applyItems, collectItems, mergeItems, nameToKey, sameItems, sanitizeItems, syncedNames, type Items } from '../apps/web/src/lib/settingsBlock';
import { mergeArchiveShares, sameArchiveShares, sanitizeArchiveShares } from '../apps/web/src/lib/archiveShare';
import { mergePackShares, samePackShares, sanitizePackShares } from '../apps/web/src/lib/packShare';
import { mergeClassPackLinks, sameClassPackLinks, sanitizeClassPackLinks } from '../apps/web/src/lib/classLearning';

/** Ein „Gerät“: ein Speicher aus Schlüssel und Text. */
function device(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    read: (key: string) => data.get(key) ?? null,
    write: (key: string, value: string | null) => void (value === null ? data.delete(key) : data.set(key, value)),
  };
}

describe('Pass-Block „einstellungen“ (#140)', () => {
  it('kennt feste Schlüssel und die Einrichtung je Spiel, sonst nichts', () => {
    expect(nameToKey('musik')).toBe('brett-und-blatt:musik');
    expect(nameToKey('spiel:chess')).toBe('brett-und-blatt:einstellungen:chess');
    for (const bad of ['ton', 'spiel:', 'spiel:A B', 'handansicht', '__proto__', 'spiel:' + 'x'.repeat(50)]) expect(nameToKey(bad)).toBeNull();
    expect(syncedNames(['brett-und-blatt:einstellungen:go', 'brett-und-blatt:ton', 'brett-und-blatt:einstellungen:A B'])).toEqual([...syncedNames([]), 'spiel:go']);
  });

  it('Lautstärken, Klang an/aus und Hand-Ansicht bleiben am Gerät', () => {
    const names = syncedNames(['brett-und-blatt:ton', 'brett-und-blatt:handansicht']);
    expect(names.some((n) => n === 'ton' || n === 'handansicht')).toBe(false);
  });

  it('bemerkt Änderungen seit dem letzten Abgleich und vergibt den Zeitstempel', () => {
    const a = device({ 'brett-und-blatt:musik': '{"onlyStars":false}' });
    const first = collectItems(a.read, syncedNames([...a.data.keys()]), {}, 100);
    expect(first).toEqual({ musik: { v: '{"onlyStars":false}', t: 100 } });
    // unverändert: bleibt bei t=100
    expect(collectItems(a.read, syncedNames([...a.data.keys()]), first, 200)).toEqual(first);
    // geändert: t=300
    a.write('brett-und-blatt:musik', '{"onlyStars":true}');
    expect(collectItems(a.read, syncedNames([...a.data.keys()]), first, 300).musik).toEqual({ v: '{"onlyStars":true}', t: 300 });
    // zurückgesetzt: Löschvermerk
    a.write('brett-und-blatt:musik', null);
    expect(collectItems(a.read, syncedNames([]), first, 400).musik).toEqual({ v: null, t: 400 });
  });

  it('die jüngere Änderung gewinnt je Eintrag, bei Gleichstand der eigene Stand', () => {
    const local: Items = { musik: { v: 'a', t: 10 }, aussehen: { v: 'plain', t: 50 } };
    const remote: Items = { musik: { v: 'b', t: 20 }, aussehen: { v: 'tavern', t: 40 }, 'spiel:go': { v: '{}', t: 5 } };
    expect(mergeItems(remote, local)).toEqual({ musik: { v: 'b', t: 20 }, aussehen: { v: 'plain', t: 50 }, 'spiel:go': { v: '{}', t: 5 } });
    expect(mergeItems({ musik: { v: 'x', t: 10 } }, local).musik?.v).toBe('a');
    expect(sameItems(local, { ...local })).toBe(true);
    expect(sameItems(local, remote)).toBe(false);
  });

  it('zwei Geräte gleichen sich ab, und ein Löschvermerk erreicht das andere', () => {
    const phone = device({ 'brett-und-blatt:musik': 'laut', 'brett-und-blatt:aussehen': 'plain' });
    const tablet = device();
    let known: Items = {};
    const names = (d: ReturnType<typeof device>) => syncedNames([...d.data.keys()]);
    const phoneItems = collectItems(phone.read, names(phone), known, 100);
    const merged = mergeItems(phoneItems, collectItems(tablet.read, names(tablet), known, 90));
    expect(applyItems(merged, tablet.read, tablet.write)).toBe(true);
    expect(tablet.data.get('brett-und-blatt:musik')).toBe('laut');
    expect(applyItems(merged, tablet.read, tablet.write)).toBe(false);

    known = merged;
    tablet.write('brett-und-blatt:aussehen', null);
    const tabletItems = collectItems(tablet.read, names(tablet), known, 200);
    applyItems(mergeItems(tabletItems, phoneItems), phone.read, phone.write);
    expect(phone.data.has('brett-und-blatt:aussehen')).toBe(false);
  });

  it('bereinigt fremde Daten und übernimmt den früheren Block (nur Lieblingsspiele)', () => {
    expect(sanitizeItems(null)).toEqual({});
    expect(sanitizeItems({ items: { ton: { v: 'x', t: 1 }, musik: { v: 5, t: 1 }, aussehen: { v: 'plain', t: -1 }, bildkarten: { v: 'a', t: 7.9 } } })).toEqual({ bildkarten: { v: 'a', t: 7 } });
    expect(sanitizeItems({ items: { musik: { v: 'x'.repeat(9000), t: 1 } } })).toEqual({});
    expect(sanitizeItems({ favorites: ['chess', 3, '<b>', 'chess'], changed: 12 })).toEqual({ lieblingsspiele: { v: '["chess"]', t: 12 } });
  });
});

describe('Pass-Block „paketarchive“ (#224)', () => {
  const validKey = 'A'.repeat(43);
  it('bereinigt ungültige Einträge und behält gültige Archive', () => {
    expect(sanitizeArchiveShares(null)).toEqual({});
    expect(sanitizeArchiveShares({ 'p1': { key: validKey, secret: 'sec123', name: 'Latein', notes: 25, cards: 50, at: 1000 } })).toEqual({
      'p1': { key: validKey, secret: 'sec123', name: 'Latein', notes: 25, cards: 50, at: 1000 },
    });
    // falscher Schlüssel
    expect(sanitizeArchiveShares({ 'p1': { key: 'kurz', secret: 'sec123' } })).toEqual({});
  });

  it('führt Archive zusammen (jüngeres at gewinnt je Eintrag)', () => {
    const remote = {
      'p1': { key: validKey, secret: 's1', name: 'Alt', at: 100 },
      'p2': { key: validKey, secret: 's2', name: 'Zwei', at: 200 },
    };
    const local = {
      'p1': { key: validKey, secret: 's1-neu', name: 'Neu', at: 150 },
      'p3': { key: validKey, secret: 's3', name: 'Drei', at: 300 },
    };
    const merged = mergeArchiveShares(remote, local);
    expect(merged['p1']?.name).toBe('Neu');
    expect(merged['p2']?.name).toBe('Zwei');
    expect(merged['p3']?.name).toBe('Drei');
    expect(sameArchiveShares(merged, { ...merged })).toBe(true);
    expect(sameArchiveShares(merged, remote)).toBe(false);
  });
});

describe('Pass-Block „paketteilen“ (#101)', () => {
  const validKey = 'B'.repeat(43);
  it('bereinigt und führt zusammen', () => {
    expect(sanitizePackShares(null)).toEqual({});
    expect(sanitizePackShares({ 't1': { key: validKey, secret: 'secret' } })).toEqual({
      't1': { key: validKey, secret: 'secret' },
    });
    const a = { 't1': { key: validKey, secret: 's1' } };
    const b = { 't2': { key: validKey, secret: 's2' } };
    expect(mergePackShares(a, b)).toEqual({ ...a, ...b });
    expect(samePackShares(a, { ...a })).toBe(true);
  });
});

describe('Pass-Block „klassenpakete“ (#224)', () => {
  it('bereinigt und führt Zuordnungen zusammen', () => {
    expect(sanitizeClassPackLinks(null)).toEqual({});
    const local = { 'ABC1': { 'cp1': 'local1' } };
    const remote = { 'ABC1': { 'cp2': 'local2' }, 'DEF2': { 'cp3': 'local3' } };
    const merged = mergeClassPackLinks(remote, local);
    expect(merged).toEqual({
      'ABC1': { 'cp1': 'local1', 'cp2': 'local2' },
      'DEF2': { 'cp3': 'local3' },
    });
    expect(sameClassPackLinks(merged, { ...merged })).toBe(true);
  });
});

