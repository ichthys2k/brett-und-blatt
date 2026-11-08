import type { Result } from '../packages/engine/src';
import { describe, expect, it } from 'vitest';
import { emptyAlbum, foundCount, mergeAlbum, recordFinds, sameAlbum, sanitizeAlbum } from '../apps/web/src/lib/album';
import { albumSpec as quartett } from '../packages/games/quartett/src/ui/album';
import { albumSpec as pairs } from '../packages/games/pairs/src/ui/album';
import { albumSpec as bible } from '../packages/games/bible-quiz/src/ui/album';
import { albumSpec as dragons } from '../packages/games/drachenspiel/src/ui/album';
import { CARD_SETS } from '../packages/games/quartett/src/sets';
import { PAIR_SETS } from '../packages/games/pairs/src/content';
import { setQuestionCatalog } from '../packages/games/bible-quiz/src/questions';
import { ALL_CARD_IDS } from '../packages/games/drachenspiel/src/cards';

describe('Sammelalbum: Speicher (#148)', () => {
  it('trägt Funde ein, die erste Zeit bleibt, und merkt die Gesamtzahl', () => {
    let album = recordFinds(emptyAlbum(), 'quartett', 32, ['tiere:A1', 'tiere:A2'], 1000);
    album = recordFinds(album, 'quartett', 32, ['tiere:A2', 'tiere:B1'], 2000);
    expect(album.quartett).toEqual({ total: 32, found: { 'tiere:A1': 1000, 'tiere:A2': 1000, 'tiere:B1': 2000 } });
    expect(foundCount(album, 'quartett')).toBe(3);
    expect(recordFinds(album, 'quartett', 32, ['tiere:A1'], 9999)).toBe(album);
    expect(recordFinds(album, 'quartett', 40, [], 3000).quartett!.total).toBe(40);
  });

  it('zwei Geräte führen zusammen: Vereinigung, früheste Zeit, größere Gesamtzahl', () => {
    const phone = recordFinds(emptyAlbum(), 'pairs', 20, ['tiere:1', 'tiere:2'], 5000);
    const tablet = recordFinds(recordFinds(emptyAlbum(), 'pairs', 22, ['tiere:2', 'tiere:3'], 3000), 'bible-quiz', 168, ['q1'], 4000);
    const merged = mergeAlbum(phone, tablet);
    expect(merged.pairs).toEqual({ total: 22, found: { 'tiere:1': 5000, 'tiere:2': 3000, 'tiere:3': 3000 } });
    expect(merged['bible-quiz']!.found).toEqual({ q1: 4000 });
    expect(sameAlbum(mergeAlbum(tablet, phone), merged)).toBe(true);
    expect(sameAlbum(mergeAlbum(merged, merged), merged)).toBe(true);
  });

  it('bereinigt fremde Daten', () => {
    expect(sanitizeAlbum(null)).toEqual({});
    const dirty = sanitizeAlbum({ 'Böse!': { total: 1, found: {} }, quartett: { total: -5, found: { 'tiere:A1': 5, '<script>': 6, ok: -1, x: 'y' } }, pairs: 'kaputt' });
    expect(dirty).toEqual({ quartett: { total: 0, found: { 'tiere:A1': 5 } } });
  });
});

describe('Sammelalbum: Kapitel der Spiele (#148)', () => {
  it('Quartett: nur in gewonnenen Spielen, Karten der eigenen Hand, des Stapels und abgelegter Quartette', () => {
    const set = CARD_SETS.tiere!;
    const cards = set.cards.map((c) => c.id);
    const view = { set: 'tiere', hands: [[cards[0], null, cards[1]], [cards[2]]], stacks: [[{ card: cards[3], open: true }], []], quartets: [{ seat: 0, group: cards[8]!.slice(0, 1) }] } as never;
    const win: Result = { kind: 'win', winners: [0] };
    const ids = quartett.finds!({ view, events: [], seat: 0, result: win });
    expect(ids).toContain(`tiere:${cards[0]}`);
    expect(ids).toContain(`tiere:${cards[1]}`);
    expect(ids).toContain(`tiere:${cards[3]}`);
    expect(ids).not.toContain(`tiere:${cards[2]}`);
    expect(ids.filter((id) => id.startsWith('tiere:' + cards[8]!.slice(0, 1))).length).toBeGreaterThanOrEqual(4);
    expect(quartett.finds!({ view, events: [], seat: 0, result: { kind: 'win', winners: [1] } })).toEqual([]);
    expect(quartett.finds!({ view, events: [], seat: 0, result: null })).toEqual([]);
    expect(quartett.finds!({ view, events: [], seat: 0, result: { kind: 'draw' } })).toEqual([]);
    const catalog = quartett.catalog();
    expect(catalog.length).toBe(Object.values(CARD_SETS).reduce((n, s) => n + s.cards.length, 0));
    expect(new Set(catalog.map((i) => i.id)).size).toBe(catalog.length);
  });

  it('Paare finden: nur die selbst genommenen Paare, je Inhaltspaket', () => {
    const view = { set: 'tiere', faces: [{ pair: 3, side: 'a' }, { pair: 3, side: 'b' }, { pair: 5, side: 'a' }, null], status: [{ takenBy: 0 }, { takenBy: 0 }, { takenBy: 1 }, 'down'] } as never;
    expect(pairs.finds!({ view, events: [], seat: 0, result: null })).toEqual(['tiere:3']);
    expect(pairs.finds!({ view, events: [], seat: 1, result: null })).toEqual(['tiere:5']);
    const catalog = pairs.catalog();
    expect(catalog.length).toBe(Object.values(PAIR_SETS).reduce((n, s) => n + s.pairs.length, 0));
    expect(catalog[0]!.id).toMatch(/^[a-z-]+:\d+$/);
  });

  it('Bibel-Quiz: nur die eigene richtige Antwort bringt die Frage ins Album', () => {
    setQuestionCatalog([{ id: 7, category: 'Gleichnisse' as never, difficulty: 1, emojis: '🌾🐑', options: ['a', 'b', 'c', 'd'], info: 'x' }]);
    const view = { currentQuestion: { questionId: 7 } } as never;
    const right = [{ type: 'answered', seat: 0, correct: true }];
    expect(bible.finds!({ view, events: right, seat: 0, result: null })).toEqual(['q7']);
    expect(bible.finds!({ view, events: right, seat: 1, result: null })).toEqual([]);
    expect(bible.finds!({ view, events: [{ type: 'answered', seat: 0, correct: false }], seat: 0, result: null })).toEqual([]);
    expect(bible.finds!({ view, events: [{ type: 'reveal' }], seat: 0, result: null })).toEqual([]);
    expect(bible.catalog()).toEqual([{ id: 'q7', label: '🌾🐑', group: 'Gleichnisse' }]);
  });

  it('Drachenspiel: Karten von Hand und Feld einer gewonnenen Partie, nur bekannte Karten', () => {
    const [a, b, c] = ALL_CARD_IDS;
    const view = { players: [{ hand: [{ uid: '1', defId: a }, { uid: '2', defId: 'gibts-nicht' }], board: [{ cardId: b }] }, { hand: null, board: [{ cardId: c }] }] } as never;
    expect(dragons.finds!({ view, events: [], seat: 0, result: { kind: 'win', winners: [0] } }).sort()).toEqual([a, b].sort());
    expect(dragons.finds!({ view, events: [], seat: 0, result: { kind: 'win', winners: [1] } })).toEqual([]);
    expect(dragons.finds!({ view, events: [], seat: 0, result: null })).toEqual([]);
    expect(dragons.catalog().length).toBeGreaterThan(100);
  });
});
