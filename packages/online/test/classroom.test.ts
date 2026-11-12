import { describe, expect, it } from 'vitest';
import { CLASS_MAX_ROOMS, CLASS_ROOM_TTL_MS, announceClassRoom, closeClassRoom, CLASS_CODE_LENGTH, CLASS_MAX_MEMBERS, classView, configureClass, createClass, decide, enrollMember, joinClass, leaveClass, parseClassCode, putCard, randomClassCode, removeMember, setLead, updateMember, type ClassState } from '../src/classroom';
import { classStamps, sanitizeCard, DEFAULT_CARD_SECTIONS } from '../src/classcard';

const T = (n: number) => `token-${String(n).padStart(8, '0')}`;
const person = (n: number, name = `Kind${n}`) => ({ token: T(n), name, avatar: '🦊' });
function fresh(): ClassState {
  const state = createClass('🐶🐱🦊🐻🐸🐧', 'Klasse 6b', person(0, 'Frau Meier'), 1);
  if (typeof state === 'string') throw new Error(state);
  return state;
}

describe('Klassencode', () => {
  it('hat sechs Emoji aus 16', () => {
    expect(Array.from(randomClassCode((n) => n - 1))).toHaveLength(CLASS_CODE_LENGTH);
    expect(parseClassCode('🐶🐱🦊🐻🐸🐧')).toBe('🐶🐱🦊🐻🐸🐧');
    expect(parseClassCode('🐶 🐱 🦊 🐻 🐸 🐧')).toBe('🐶🐱🦊🐻🐸🐧');
    expect(parseClassCode('🐶🐱🦊🐻🐸')).toBeNull();
    expect(parseClassCode('🐶🐱🦊🐻🐸🍇')).toBeNull();
  });
  it('liest den Code aus einem Link', () => {
    expect(parseClassCode(`https://x.de/#/klasse/${encodeURIComponent('🐶🐱🦊🐻🐸🐧')}`)).toBe('🐶🐱🦊🐻🐸🐧');
  });
});

describe('Klasse', () => {
  it('wird mit einer Leitung angelegt', () => {
    const state = fresh();
    const view = classView(state, T(0));
    expect(view.lead).toBe(true);
    expect(view.members).toHaveLength(1);
    expect(createClass('x', '', person(0), 1)).toEqual(expect.any(String));
    expect(createClass('x', 'ok', { token: 'kurz', name: 'A' }, 1)).toEqual(expect.any(String));
  });

  it('nimmt Beitritte sofort an, wenn nichts bestätigt werden muss', () => {
    const state = fresh();
    expect(joinClass(state, person(1), 2)).toEqual({ ok: true });
    expect(classView(state, T(1)).members).toHaveLength(2);
    expect(joinClass(state, person(1), 3)).toEqual({ ok: true });
    expect(Object.keys(state.members)).toHaveLength(2);
  });

  it('zeigt Fremden weder Mitglieder noch Geräte-Kennungen', () => {
    const state = fresh();
    const stranger = classView(state, T(99));
    expect(stranger.members).toEqual([]);
    expect(JSON.stringify(classView(state, T(0)))).not.toContain('token-');
  });

  it('lässt mit Bestätigung erst die Leitung zu', () => {
    const state = fresh();
    configureClass(state, T(0), { approval: true }, 2);
    joinClass(state, person(1), 3);
    expect(classView(state, T(1)).waiting).toBe(true);
    expect(classView(state, T(1)).pending).toEqual([]);
    const lead = classView(state, T(0));
    expect(lead.pending).toHaveLength(1);
    expect(decide(state, T(1), lead.pending[0]!.id, true, 4)).toEqual({ error: expect.any(String) });
    expect(decide(state, T(0), lead.pending[0]!.id, true, 4)).toEqual({ ok: true });
    expect(classView(state, T(1)).members).toHaveLength(2);
    expect(classView(state, T(1)).waiting).toBe(false);
  });

  it('kann Anfragen ablehnen', () => {
    const state = fresh();
    configureClass(state, T(0), { approval: true }, 2);
    joinClass(state, person(1), 3);
    const id = classView(state, T(0)).pending[0]!.id;
    decide(state, T(0), id, false, 4);
    expect(classView(state, T(1)).members).toEqual([]);
    expect(classView(state, T(0)).pending).toEqual([]);
  });

  it('schließt den Beitritt und begrenzt die Größe', () => {
    const state = fresh();
    configureClass(state, T(0), { open: false }, 2);
    expect(joinClass(state, person(1), 3)).toEqual({ error: expect.any(String) });
    configureClass(state, T(0), { open: true }, 3);
    for (let i = 1; i < CLASS_MAX_MEMBERS; i++) expect(joinClass(state, person(i), 4)).toEqual({ ok: true });
    expect(joinClass(state, person(500), 5)).toEqual({ error: expect.any(String) });
  });

  it('lässt nur die Leitung entfernen, umbenennen und ernennen', () => {
    const state = fresh();
    joinClass(state, person(1), 2);
    joinClass(state, person(2), 2);
    const id1 = classView(state, T(0)).members.find((m) => !m.lead)!.id;
    expect(removeMember(state, T(2), id1)).toEqual({ error: expect.any(String) });
    expect(configureClass(state, T(1), { name: 'Anders' }, 3)).toEqual({ error: expect.any(String) });
    expect(setLead(state, T(0), id1, true)).toEqual({ ok: true });
    expect(configureClass(state, T(1), { name: 'Klasse 7a' }, 3)).toEqual({ ok: true });
    expect(removeMember(state, T(1), classView(state, T(0)).members.find((m) => m.name === 'Kind2')!.id)).toEqual({ ok: true });
  });

  it('lässt die einzige Leitung nicht gehen, solange andere da sind', () => {
    const state = fresh();
    joinClass(state, person(1), 2);
    expect(leaveClass(state, T(0))).toEqual({ error: expect.any(String) });
    expect(leaveClass(state, T(1))).toEqual({ ok: true });
    expect(leaveClass(state, T(0))).toEqual({ ok: true });
  });

  it('aktualisiert Name, Bild und Wappen eines Mitglieds', () => {
    const state = fresh();
    joinClass(state, person(1), 2);
    expect(updateMember(state, T(1), { name: 'Neu', avatar: '🐻' }, 3)).toEqual({ ok: true });
    const me = classView(state, T(1)).members.find((m) => m.name === 'Neu');
    expect(me?.avatar).toBe('🐻');
    expect(updateMember(state, T(77), { name: 'X' }, 3)).toEqual({ error: expect.any(String) });
  });
});

describe('Klassenkarten (#151)', () => {
  const full = {
    stamps: [{ gameId: 'chess', kinds: ['first', 'win', 'bogus'] }, { gameId: '<x>', kinds: ['win'] }],
    trophies: [{ gameId: 'chess', count: 3 }, { gameId: 'chess', count: -1 }],
    favorites: ['skat', '../x'],
    album: [{ gameId: 'drachenspiel', count: 7 }, { gameId: 'bad', count: -1 }],
    botRating: [{ gameId: 'chess', rating: 1250, games: 10, wins: 6 }, { gameId: 'bad', games: -5 }],
  };

  it('legt eine geprüfte Karte ab und zeigt sie nur Mitgliedern', () => {
    const state = fresh();
    joinClass(state, person(1), 2);
    expect(putCard(state, T(1), full, 5)).toEqual({ ok: true });
    const card = classView(state, T(0)).members.find((m) => m.name === 'Kind1')?.card;
    expect(card?.stamps).toEqual([{ gameId: 'chess', kinds: ['first', 'win'] }]);
    expect(card?.trophies).toEqual([{ gameId: 'chess', count: 3 }]);
    expect(card?.favorites).toEqual(['skat']);
    expect(card?.album).toEqual([{ gameId: 'drachenspiel', count: 7 }]);
    expect(card?.botRating).toEqual([{ gameId: 'chess', rating: 1250, games: 10, wins: 6 }]);
    expect(classView(state, T(99)).members).toEqual([]);
    expect(putCard(state, T(99), full, 6)).toEqual({ error: expect.any(String) });
  });

  it('lässt weg, was die Leitung nicht zeigen will – auch nachträglich', () => {
    const state = fresh();
    joinClass(state, person(1), 2);
    putCard(state, T(1), full, 5);
    expect(configureClass(state, T(1), { sections: { trophies: false } }, 6)).toEqual({ error: expect.any(String) });
    expect(configureClass(state, T(0), { sections: { trophies: false, favorites: false, album: false, botRating: false } }, 6)).toEqual({ ok: true });
    const card = classView(state, T(0)).members.find((m) => m.name === 'Kind1')?.card;
    expect(card?.trophies).toBeUndefined();
    expect(card?.favorites).toBeUndefined();
    expect(card?.album).toBeUndefined();
    expect(card?.botRating).toBeUndefined();
    expect(card?.stamps).toBeDefined();
    putCard(state, T(1), full, 7);
    expect(classView(state, T(0)).members.find((m) => m.name === 'Kind1')?.card?.trophies).toBeUndefined();
  });

  it('berechnet Klassen-Stempel für Spiele, die alle aktuellen Mitglieder gespielt haben', () => {
    const card1 = sanitizeCard({ stamps: [{ gameId: 'chess', kinds: ['first', 'win'] }, { gameId: 'skat', kinds: ['first'] }] }, DEFAULT_CARD_SECTIONS, 1)!;
    const card2 = sanitizeCard({ stamps: [{ gameId: 'chess', kinds: ['first'] }, { gameId: 'checkers', kinds: ['first'] }] }, DEFAULT_CARD_SECTIONS, 1)!;
    const card3 = sanitizeCard({ stamps: [{ gameId: 'chess', kinds: ['first'] }] }, DEFAULT_CARD_SECTIONS, 1)!;

    // Mindestens 2 Mitglieder
    expect(classStamps([card1])).toEqual([]);
    // Schach haben beide Mitglieder gespielt
    expect(classStamps([card1, card2])).toEqual(['chess']);
    // Alle 3 Mitglieder haben Schach gespielt
    expect(classStamps([card1, card2, card3])).toEqual(['chess']);
    // Wenn ein Mitglied fehlt oder keinen Stempel hat: leer
    expect(classStamps([card1, card2, undefined])).toEqual([]);
    expect(classStamps([card1, card2, { at: 1, stamps: [] }])).toEqual([]);
  });

  it('steuert die Ranglisten-Option (Vorgabe aus)', () => {
    const state = fresh();
    joinClass(state, person(1), 2);
    expect(classView(state, T(0)).leaderboard).toBe(false);
    expect(configureClass(state, T(1), { leaderboard: true }, 3)).toEqual({ error: expect.any(String) });
    expect(configureClass(state, T(0), { leaderboard: true }, 3)).toEqual({ ok: true });
    expect(classView(state, T(0)).leaderboard).toBe(true);
    expect(classView(state, T(1)).leaderboard).toBe(true);
    expect(configureClass(state, T(0), { leaderboard: false }, 4)).toEqual({ ok: true });
    expect(classView(state, T(1)).leaderboard).toBe(false);
  });

  it('enthält keine Geräte-Kennung', () => {
    const state = fresh();
    joinClass(state, person(1), 2);
    putCard(state, T(1), full, 5);
    expect(JSON.stringify(classView(state, T(0)))).not.toContain('token-');
  });
});

describe('Klassenausweise (#152): Eintragen durch die Leitung', () => {
  it('trägt ein Kind ein, auch bei geschlossenem Beitritt und mit Bestätigung', () => {
    const state = fresh();
    configureClass(state, T(0), { open: false, approval: true }, 2);
    expect(enrollMember(state, T(0), person(5, 'Mia'), 3)).toEqual({ ok: true });
    expect(classView(state, T(5)).members).toHaveLength(2);
    expect(enrollMember(state, T(0), person(5, 'Mia'), 4)).toEqual({ ok: true });
    expect(Object.keys(state.members)).toHaveLength(2);
  });
  it('lässt nur die Leitung eintragen und prüft die Angaben', () => {
    const state = fresh();
    joinClass(state, person(1), 2);
    expect(enrollMember(state, T(1), person(5), 3)).toEqual({ error: expect.any(String) });
    expect(enrollMember(state, T(0), { token: 'kurz', name: 'A' }, 3)).toEqual({ error: expect.any(String) });
    expect(enrollMember(state, T(0), { token: T(6), name: '' }, 3)).toEqual({ error: expect.any(String) });
  });
});

import { addClassPack, clearProgress, markProgress, mayStoreProgress, removeClassPack, setLeadKey, CLASS_MAX_PACKS, PROGRESS_MAX_CHARS } from '../src';

describe('Pakete und Lernstand (#224)', () => {
  const key43 = 'k'.repeat(43);
  const pub = 'P'.repeat(87);
  const make = () => {
    const state = createClass('🍎🍌🍇🍊🍓🥝', 'Klasse 5a', { token: 'lead-token-1', name: 'Frau Muster', avatar: '🦊' }, 1000) as ClassState;
    joinClass(state, { token: 'kid-token-0001', name: 'Kind', avatar: '🐼' }, 2000);
    return state;
  };
  it('nur die Leitung legt Pakete in die Klasse; Mitglieder sehen sie samt Schlüssel, Fremde nicht', () => {
    const state = make();
    expect('error' in addClassPack(state, 'kid-token-0001', { name: 'Latein', key: key43 }, 3000)).toBe(true);
    expect('error' in addClassPack(state, 'lead-token-1', { name: 'Latein', key: 'zu kurz' }, 3000)).toBe(true);
    expect(addClassPack(state, 'lead-token-1', { name: 'Latein', key: key43 }, 3000)).toEqual({ ok: true });
    expect(classView(state, 'kid-token-0001').packs).toMatchObject([{ name: 'Latein', key: key43 }]);
    expect(classView(state, 'fremd-token-99').packs).toEqual([]);
    // derselbe Link: kein Doppelter
    addClassPack(state, 'lead-token-1', { name: 'Latein 2', key: key43 }, 4000);
    expect(state.packs).toHaveLength(1);
    expect(state.packs![0]!.name).toBe('Latein 2');
    const id = state.packs![0]!.id;
    expect('error' in removeClassPack(state, 'kid-token-0001', id)).toBe(true);
    expect(removeClassPack(state, 'lead-token-1', id)).toEqual({ ok: true });
    expect(state.packs).toEqual([]);
  });
  it('höchstens zwölf Pakete', () => {
    const state = make();
    for (let i = 0; i < CLASS_MAX_PACKS; i++) expect(addClassPack(state, 'lead-token-1', { name: `P${i}`, key: String(i).padStart(43, 'a') }, 3000)).toEqual({ ok: true });
    expect('error' in addClassPack(state, 'lead-token-1', { name: 'zu viel', key: 'z'.repeat(43) }, 3000)).toBe(true);
  });
  it('der Lernstand wird nur bei eingeschaltetem Lernstand abgelegt und nur für die Leitung sichtbar gemeldet', () => {
    const state = make();
    expect('error' in mayStoreProgress(state, 'kid-token-0001', 'abc')).toBe(true); // aus
    expect(setLeadKey(state, 'lead-token-1', pub)).toEqual({ ok: true });
    expect('error' in setLeadKey(state, 'kid-token-0001', pub)).toBe(true);
    expect('error' in setLeadKey(state, 'lead-token-1', 'kurz')).toBe(true);
    expect(configureClass(state, 'lead-token-1', { learning: true }, 3000)).toEqual({ ok: true });
    expect(mayStoreProgress(state, 'kid-token-0001', 'YWJj')).toEqual({ ok: true });
    expect('error' in mayStoreProgress(state, 'kid-token-0001', 'a'.repeat(PROGRESS_MAX_CHARS + 1))).toBe(true);
    expect('error' in mayStoreProgress(state, 'kid-token-0001', 'nicht gültig!')).toBe(true);
    expect('error' in mayStoreProgress(state, 'fremd-token-99', 'YWJj')).toBe(true);
    markProgress(state, 'kid-token-0001', 5000);
    // Mitglieder sehen die Schlüssel der Leitung, nur die Leitung sieht, wer abgelegt hat
    expect(classView(state, 'kid-token-0001').leadKeys).toEqual([{ id: state.members['lead-token-1']!.id, key: pub }]);
    expect(classView(state, 'lead-token-1').members.find((m) => !m.lead)?.progressAt).toBe(5000);
    expect(classView(state, 'kid-token-0001').members.find((m) => !m.lead)?.progressAt).toBeUndefined();
    // Ausschalten nimmt den Hinweis weg
    configureClass(state, 'lead-token-1', { learning: false }, 6000);
    expect(classView(state, 'lead-token-1').members.find((m) => !m.lead)?.progressAt).toBeUndefined();
    expect(classView(state, 'kid-token-0001').leadKeys).toEqual([]);
    clearProgress(state, 'kid-token-0001');
  });
});

import { DUE_MAX_CARDS, DUE_MIN_REPORTERS, DUE_REPORT_DAYS, aggregateDue, cleanDueReport, mayReportDue } from '../src';

describe('Fällige Karten der Klasse (#224)', () => {
  it('prüft die Meldung streng: nur Kennungen, keine Namen, keine Leerzeichen', () => {
    expect(cleanDueReport(['abc', 'x_y-1', 'abc'])).toEqual(['abc', 'x_y-1']);
    expect(cleanDueReport([])).toEqual([]);
    expect(cleanDueReport('abc')).toBeNull();
    expect(cleanDueReport(['mit Leerzeichen'])).toBeNull();
    expect(cleanDueReport([42])).toBeNull();
    expect(cleanDueReport(['a'.repeat(41)])).toBeNull();
    expect(cleanDueReport(Array.from({ length: DUE_MAX_CARDS + 1 }, (_, i) => `k${i}`))).toBeNull();
  });
  it('gemeldet wird nur bei eingeschaltetem Sammeln und von Mitgliedern', () => {
    const state = createClass('🍎🍌🍇🍊🍓🥝', 'K', { token: 'lead-token-1', name: 'L', avatar: '🦊' }, 1) as ClassState;
    joinClass(state, { token: 'kid-token-0001', name: 'Kind', avatar: '🐼' }, 2);
    expect('error' in mayReportDue(state, 'kid-token-0001')).toBe(true);
    expect(configureClass(state, 'lead-token-1', { dueCards: true }, 3)).toEqual({ ok: true });
    expect(classView(state, 'kid-token-0001').dueCards).toBe(true);
    expect(mayReportDue(state, 'kid-token-0001')).toEqual({ ok: true });
    expect('error' in mayReportDue(state, 'fremd-token-99')).toBe(true);
  });
  it('wertet erst ab drei Meldungen aus und zählt nur frische', () => {
    const now = 100 * 86_400_000;
    const report = (cards: string[], ageDays = 0) => ({ at: now - ageDays * 86_400_000, cards });
    expect(aggregateDue([report(['a']), report(['a', 'b'])], now)).toEqual({ reporters: 2, cards: [] });
    const three = aggregateDue([report(['a', 'b']), report(['a']), report(['a', 'c'], 1)], now);
    expect(three.reporters).toBe(DUE_MIN_REPORTERS);
    expect(three.cards).toEqual([{ card: 'a', n: 3 }, { card: 'b', n: 1 }, { card: 'c', n: 1 }]);
    // alte Meldungen fallen weg
    expect(aggregateDue([report(['a']), report(['a']), report(['a'], DUE_REPORT_DAYS)], now).cards).toEqual([]);
  });
});

describe('Klassen im Rollenmodell (#232)', () => {
  it('die dienstälteste Leitung ist Betreiber, weitere Leitungen Leitung, Schüler nichts', async () => {
    const { classRoles, createClass, joinClass, setLead } = await import('../src/classroom');
    const A = 'kennung-lehrkraft-0001';
    const B = 'kennung-lehrkraft-0002';
    const C = 'kennung-schueler-00003';
    const state = createClass('🦊🦊🦊🦊🦊🦊', 'Klasse 5a', { token: A, name: 'Frau Alt' }, 1000);
    if (typeof state === 'string') throw new Error(state);
    joinClass(state, { token: B, name: 'Herr Neu' }, 2000);
    joinClass(state, { token: C, name: 'Kind' }, 3000);
    expect(setLead(state, A, state.members[B]!.id, true)).toEqual({ ok: true });
    expect(classRoles(state, A)).toEqual(['operator']);
    expect(classRoles(state, B)).toEqual(['lead']);
    expect(classRoles(state, C)).toEqual([]);
    expect(classRoles(state, 'kennung-fremder-0000001')).toEqual([]);
  });
});

describe('Offene Räume der Klasse (#151)', () => {
  const ROOM = '🐶🐱🦊🐻';
  function withMember(): ClassState {
    const state = fresh();
    joinClass(state, person(1, 'Mia'), 2);
    joinClass(state, person(2, 'Ben'), 2);
    return state;
  }

  it('zeigt Mitgliedern den Raum mit dem Namen, der ihn geöffnet hat', () => {
    const state = withMember();
    expect(announceClassRoom(state, T(1), ROOM, 10)).toEqual({ ok: true });
    const view = classView(state, T(2), 11);
    expect(view.rooms).toEqual([expect.objectContaining({ code: ROOM, name: 'Mia', mine: false })]);
    expect(classView(state, T(1), 11).rooms[0]?.mine).toBe(true);
  });

  it('zeigt Fremden und Wartenden nichts', () => {
    const state = withMember();
    announceClassRoom(state, T(1), ROOM, 10);
    expect(classView(state, T(99), 11).rooms).toEqual([]);
  });

  it('lehnt Fremde und ungültige Raumcodes ab', () => {
    const state = withMember();
    expect(announceClassRoom(state, T(99), ROOM, 10)).toEqual({ error: expect.any(String) });
    expect(announceClassRoom(state, T(1), 'abc', 10)).toEqual({ error: expect.any(String) });
    expect(announceClassRoom(state, T(1), '🐶🐱🦊', 10)).toEqual({ error: expect.any(String) });
    expect(state.rooms).toBeUndefined();
  });

  it('meldet denselben Raum nicht doppelt, hält höchstens fünf und lässt alte verfallen', () => {
    const state = withMember();
    announceClassRoom(state, T(1), ROOM, 10);
    announceClassRoom(state, T(1), ROOM, 20);
    expect(classView(state, T(1), 21).rooms).toHaveLength(1);
    const codes = ['🐶🐶🐶🐶', '🐱🐱🐱🐱', '🦊🦊🦊🦊', '🐻🐻🐻🐻', '🐸🐸🐸🐸', '🐧🐧🐧🐧'];
    codes.forEach((code, i) => announceClassRoom(state, T(1), code, 100 + i));
    expect(classView(state, T(1), 200).rooms).toHaveLength(CLASS_MAX_ROOMS);
    expect(classView(state, T(1), 100 + CLASS_ROOM_TTL_MS + 10).rooms).toEqual([]);
  });

  it('erlaubt das Schließen dem Öffnenden und der Leitung, sonst niemandem', () => {
    const state = withMember();
    announceClassRoom(state, T(1), ROOM, 10);
    expect(closeClassRoom(state, T(2), ROOM)).toEqual({ error: expect.any(String) });
    expect(closeClassRoom(state, T(1), ROOM)).toEqual({ ok: true });
    announceClassRoom(state, T(1), ROOM, 30);
    expect(closeClassRoom(state, T(0), ROOM)).toEqual({ ok: true });
    expect(closeClassRoom(state, T(0), ROOM)).toEqual({ error: expect.any(String) });
  });

  it('lässt den Raum verschwinden, wenn das Mitglied die Klasse verlässt', () => {
    const state = withMember();
    announceClassRoom(state, T(1), ROOM, 10);
    leaveClass(state, T(1));
    expect(classView(state, T(2), 11).rooms).toEqual([]);
  });
});
