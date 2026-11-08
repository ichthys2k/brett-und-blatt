import { describe, expect, it } from 'vitest';
import { ACTIVE_PASS_KEY, createPassBook, type Store } from '../apps/web/src/lib/passes';

function memory(initial: Record<string, string> = {}): Store & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return { data, get: (k) => data.get(k) ?? null, set: (k, v) => void data.set(k, v), remove: (k) => void data.delete(k), keys: () => [...data.keys()] };
}

const A = { name: 'Mia', avatar: '🦊', hasCode: true };
const legacy = () =>
  memory({
    'brett-und-blatt:profil': JSON.stringify({ name: 'Mia', avatar: '🦊' }),
    'brett-und-blatt:geraet': '"token-mia"',
    'brett-und-blatt:spielercode': '"🦊🐻🐸🐙"',
    'brett-und-blatt:lieblingsspiele': '["chess"]',
    'brett-und-blatt:einstellungen:chess': '{"x":1}',
    'brett-und-blatt:ton': '{"lautstaerke":0.5}',
  });

describe('Mehrere Pässe an einem Gerät (#139)', () => {
  it('das bisherige Profil wird zum ersten Pass, nichts geht verloren, die Kennung bleibt', () => {
    const store = legacy();
    const book = createPassBook(store);
    expect(book.list()).toEqual([]);
    const id = book.touch(A)!;
    expect(book.list()).toEqual([{ id, ...A }]);
    expect(book.activeId()).toBe(id);
    expect(store.get('brett-und-blatt:geraet')).toBe('"token-mia"');
  });

  it('ohne Profil und ohne Pass wird kein leerer Eintrag angelegt', () => {
    const book = createPassBook(memory());
    expect(book.touch({ name: '', avatar: '', hasCode: false })).toBeNull();
    expect(book.list()).toEqual([]);
  });

  it('neuer Pass: das Gerät ist leer, der alte liegt beiseite und kommt beim Zurückwechseln unverändert wieder', () => {
    const store = legacy();
    const book = createPassBook(store);
    const mia = book.touch(A)!;
    const lena = book.createNew(A)!;
    expect(book.activeId()).toBe(lena);
    expect(store.get('brett-und-blatt:geraet')).toBeNull();
    expect(store.get('brett-und-blatt:profil')).toBeNull();
    expect(store.get('brett-und-blatt:einstellungen:chess')).toBeNull();
    // Gerätedaten bleiben
    expect(store.get('brett-und-blatt:ton')).toBe('{"lautstaerke":0.5}');

    store.set('brett-und-blatt:profil', JSON.stringify({ name: 'Lena', avatar: '🐸' }));
    store.set('brett-und-blatt:lieblingsspiele', '["go"]');
    book.touch({ name: 'Lena', avatar: '🐸', hasCode: false });

    expect(book.switchTo(mia, { name: 'Lena', avatar: '🐸', hasCode: false })).toBe(true);
    expect(book.activeId()).toBe(mia);
    expect(store.get('brett-und-blatt:geraet')).toBe('"token-mia"');
    expect(store.get('brett-und-blatt:lieblingsspiele')).toBe('["chess"]');
    expect(store.get('brett-und-blatt:einstellungen:chess')).toBe('{"x":1}');
    // Lenas Daten liegen beiseite
    expect(store.get(`brett-und-blatt:pass:${lena}:brett-und-blatt:lieblingsspiele`)).toBe('["go"]');
    expect(book.list().map((p) => p.name)).toEqual(['Mia', 'Lena']);

    book.switchTo(lena, A);
    expect(store.get('brett-und-blatt:lieblingsspiele')).toBe('["go"]');
    expect(store.get('brett-und-blatt:geraet')).toBeNull();
  });

  it('jeder Pass behält seine eigene Raum-Kennung', () => {
    const store = legacy();
    const book = createPassBook(store);
    const mia = book.touch(A)!;
    const other = book.createNew(A)!;
    store.set('brett-und-blatt:geraet', '"token-lena"');
    book.switchTo(mia, { name: 'Lena', avatar: '🐸', hasCode: false });
    expect(store.get('brett-und-blatt:geraet')).toBe('"token-mia"');
    book.switchTo(other, A);
    expect(store.get('brett-und-blatt:geraet')).toBe('"token-lena"');
  });

  it('Gast zeichnet nichts auf: Beim Verlassen sind Daten und Eintrag weg', () => {
    const store = legacy();
    const book = createPassBook(store);
    const mia = book.touch(A)!;
    const guest = book.createNew(A, { guest: true })!;
    expect(book.list().find((p) => p.id === guest)).toMatchObject({ guest: true, name: 'Gast' });
    store.set('brett-und-blatt:lieblingsspiele', '["spuren"]');
    book.switchTo(mia, { name: 'Gast', avatar: '👤', hasCode: false });
    expect(book.list().map((p) => p.id)).toEqual([mia]);
    expect([...store.data.keys()].some((k) => k.includes(guest))).toBe(false);
    expect(store.get('brett-und-blatt:lieblingsspiele')).toBe('["chess"]');
  });

  it('entfernen: ein beiseitegelegter Pass verschwindet mit seinen Daten; der aktive übergibt an den nächsten', () => {
    const store = legacy();
    const book = createPassBook(store);
    const mia = book.touch(A)!;
    const lena = book.createNew(A)!;
    store.set('brett-und-blatt:lieblingsspiele', '["go"]');
    book.touch({ name: 'Lena', avatar: '🐸', hasCode: false });

    book.remove(mia);
    expect(book.list().map((p) => p.id)).toEqual([lena]);
    expect([...store.data.keys()].some((k) => k.includes(mia))).toBe(false);

    book.remove(lena);
    expect(book.list()).toEqual([]);
    expect(store.get(ACTIVE_PASS_KEY)).toBeNull();
    expect(store.get('brett-und-blatt:lieblingsspiele')).toBeNull();
    expect(store.get('brett-und-blatt:ton')).toBe('{"lautstaerke":0.5}');
  });

  it('höchstens zwölf Pässe, unbekannte Kennungen werden abgewiesen', () => {
    const store = legacy();
    const book = createPassBook(store);
    book.touch(A);
    for (let i = 0; i < 11; i++) expect(book.createNew({ name: 'x', avatar: '🐸', hasCode: false })).not.toBeNull();
    expect(book.createNew(A)).toBeNull();
    expect(book.switchTo('0'.repeat(12), A)).toBe(false);
  });

  it('kaputte Listen im Speicher sind harmlos', () => {
    const store = memory({ 'brett-und-blatt:paesse': 'kein json' });
    expect(createPassBook(store).list()).toEqual([]);
    store.set('brett-und-blatt:paesse', JSON.stringify([{ id: 'zu kurz' }, { id: 'abcdef012345', name: 5 }]));
    expect(createPassBook(store).list()).toEqual([{ id: 'abcdef012345', name: '', avatar: '', hasCode: false }]);
  });
});
