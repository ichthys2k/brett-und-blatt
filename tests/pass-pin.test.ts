import { describe, expect, it } from 'vitest';
import { createPassBook, type Store } from '../apps/web/src/lib/passes';
import { afterFailure, checkPin, cleanPinLock, createPinLock, remainingSeconds, validPin, waitAfter } from '../apps/web/src/lib/passLock';

function memory(): Store {
  const data = new Map<string, string>();
  return { get: (k) => data.get(k) ?? null, set: (k, v) => void data.set(k, v), remove: (k) => void data.delete(k), keys: () => [...data.keys()] };
}

describe('Geräte-PIN für den Passwechsel (#559)', () => {
  it('speichert nur einen Hash, nie die PIN, und prüft richtig', async () => {
    const lock = await createPinLock('4711', 1000);
    expect(JSON.stringify(lock)).not.toContain('4711');
    expect(await checkPin(lock, '4711')).toBe(true);
    expect(await checkPin(lock, '4712')).toBe(false);
    expect(await checkPin(lock, '')).toBe(false);
    const other = await createPinLock('4711', 1000);
    expect(other.salt).not.toBe(lock.salt);
    expect(other.hash).not.toBe(lock.hash);
  });

  it('erlaubt nur Ziffern in sinnvoller Länge', () => {
    expect(validPin('1234')).toBe(true);
    expect(validPin('123')).toBe(false);
    expect(validPin('12a4')).toBe(false);
    expect(validPin('1'.repeat(13))).toBe(false);
  });

  it('Fehlversuche: erst frei, dann wachsende Wartezeit', () => {
    expect([1, 2, 3, 4, 5, 6, 20].map(waitAfter)).toEqual([0, 0, 10, 30, 60, 300, 300]);
    let a = afterFailure(undefined, 1000);
    expect(remainingSeconds(a, 1000)).toBe(0);
    a = afterFailure(afterFailure(a, 1000), 1000);
    expect(a.fails).toBe(3);
    expect(remainingSeconds(a, 1000)).toBe(10);
    expect(remainingSeconds(a, 12_000)).toBe(0);
  });

  it('das Passbuch behält die Sperre, räumt Unbrauchbares weg und kennt keine Gast-Sperre', async () => {
    const book = createPassBook(memory());
    const id = book.touch({ name: 'Mia', avatar: '🦊', hasCode: false })!;
    const lock = await createPinLock('2468', 1000);
    expect(book.setLock(id, lock)).toBe(true);
    expect(book.list()[0]!.lock).toEqual(lock);
    // bleibt nach einem Anzeige-Update erhalten
    book.touch({ name: 'Mia', avatar: '🦊', hasCode: true });
    expect(book.list()[0]!.lock).toEqual(lock);
    expect(book.setLock(id, null)).toBe(true);
    expect(book.list()[0]!.lock).toBeUndefined();
    expect(cleanPinLock({ salt: 'x', hash: 'y', iter: 5 })).toBeUndefined();

    const guest = book.createNew({ name: 'Mia', avatar: '🦊', hasCode: true }, { guest: true })!;
    expect(book.setLock(guest, lock)).toBe(false);
  });

  it('PIN-lose Pässe wechseln wie bisher', () => {
    const store = memory();
    const book = createPassBook(store);
    const a = book.touch({ name: 'Mia', avatar: '🦊', hasCode: false })!;
    const b = book.createNew({ name: 'Mia', avatar: '🦊', hasCode: false })!;
    expect(book.list().every((e) => !e.lock)).toBe(true);
    expect(book.switchTo(a, { name: '', avatar: '', hasCode: false })).toBe(true);
    expect(book.activeId()).toBe(a);
    expect(b).not.toBe(a);
  });
});
