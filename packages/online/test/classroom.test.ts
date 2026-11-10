import { describe, expect, it } from 'vitest';
import { CLASS_CODE_LENGTH, CLASS_MAX_MEMBERS, classView, configureClass, createClass, decide, enrollMember, joinClass, leaveClass, parseClassCode, putCard, randomClassCode, removeMember, setLead, updateMember, type ClassState } from '../src/classroom';

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
  const full = { stamps: [{ gameId: 'chess', kinds: ['first', 'win', 'bogus'] }, { gameId: '<x>', kinds: ['win'] }], trophies: [{ gameId: 'chess', count: 3 }, { gameId: 'chess', count: -1 }], favorites: ['skat', '../x'] };

  it('legt eine geprüfte Karte ab und zeigt sie nur Mitgliedern', () => {
    const state = fresh();
    joinClass(state, person(1), 2);
    expect(putCard(state, T(1), full, 5)).toEqual({ ok: true });
    const card = classView(state, T(0)).members.find((m) => m.name === 'Kind1')?.card;
    expect(card?.stamps).toEqual([{ gameId: 'chess', kinds: ['first', 'win'] }]);
    expect(card?.trophies).toEqual([{ gameId: 'chess', count: 3 }]);
    expect(card?.favorites).toEqual(['skat']);
    expect(classView(state, T(99)).members).toEqual([]);
    expect(putCard(state, T(99), full, 6)).toEqual({ error: expect.any(String) });
  });

  it('lässt weg, was die Leitung nicht zeigen will – auch nachträglich', () => {
    const state = fresh();
    joinClass(state, person(1), 2);
    putCard(state, T(1), full, 5);
    expect(configureClass(state, T(1), { sections: { trophies: false } }, 6)).toEqual({ error: expect.any(String) });
    expect(configureClass(state, T(0), { sections: { trophies: false, favorites: false } }, 6)).toEqual({ ok: true });
    const card = classView(state, T(0)).members.find((m) => m.name === 'Kind1')?.card;
    expect(card?.trophies).toBeUndefined();
    expect(card?.favorites).toBeUndefined();
    expect(card?.stamps).toBeDefined();
    putCard(state, T(1), full, 7);
    expect(classView(state, T(0)).members.find((m) => m.name === 'Kind1')?.card?.trophies).toBeUndefined();
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
