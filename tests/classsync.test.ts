import { beforeEach, describe, expect, it } from 'vitest';

const store = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => store.set(key, String(value)),
  removeItem: (key: string) => store.delete(key),
  clear: () => store.clear(),
  get length() {
    return store.size;
  },
  key: (index: number) => Array.from(store.keys())[index] ?? null,
};

if (typeof window === 'undefined') {
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: localStorageMock,
  };
} else {
  Object.defineProperty(window, 'localStorage', { value: localStorageMock });
}

import {
  forgetClass,
  loadAllClassEntries,
  loadClasses,
  mergeKnownClasses,
  rememberClass,
  sameKnownClasses,
  sanitizeKnownClasses,
  type KnownClass,
} from '../apps/web/src/lib/classes';

describe('Klassen-Merkliste & Pass-Abgleich (#150)', () => {
  beforeEach(() => {
    store.clear();
  });

  it('bereinigt unbrauchbare Klassen-Einträge', () => {
    expect(sanitizeKnownClasses(null)).toEqual([]);
    expect(sanitizeKnownClasses([null, 'abc', { code: 123 }])).toEqual([]);
    expect(
      sanitizeKnownClasses([
        { code: '🐶🐱🦊🐻🐸🐧', name: 'Klasse 5a', at: 100 },
        { code: '🍎🍌🍓🍕🍦🍭', name: 'Sehr langer Klassenname der gekürzt werden sollte'.repeat(2), removed: true },
      ]),
    ).toEqual([
      { code: '🐶🐱🦊🐻🐸🐧', name: 'Klasse 5a', at: 100 },
      { code: '🍎🍌🍓🍕🍦🍭', name: 'Sehr langer Klassenname der gekürzt werd', removed: true },
    ]);
  });

  it('führt lokale und entfernte Listen zusammen, jüngere Änderung gewinnt', () => {
    const local: KnownClass[] = [
      { code: 'A', name: 'Mathe-AG', at: 10 },
      { code: 'B', name: 'Alte Klasse', at: 5, removed: false },
    ];
    const remote: KnownClass[] = [
      { code: 'B', name: 'Alte Klasse', at: 20, removed: true },
      { code: 'C', name: 'Schachclub', at: 15 },
    ];

    const merged = mergeKnownClasses(remote, local);
    expect(merged).toHaveLength(3);
    const b = merged.find((x) => x.code === 'B');
    expect(b?.removed).toBe(true);
    expect(b?.at).toBe(20);

    const c = merged.find((x) => x.code === 'C');
    expect(c?.name).toBe('Schachclub');
  });

  it('erkennt gleiche Listen mit sameKnownClasses', () => {
    const listA: KnownClass[] = [
      { code: 'A', name: '5a', at: 1 },
      { code: 'B', name: '6b', at: 2, removed: true },
    ];
    const listB: KnownClass[] = [
      { code: 'A', name: '5a', at: 1 },
      { code: 'B', name: '6b', at: 2, removed: true },
    ];
    const listC: KnownClass[] = [
      { code: 'A', name: '5a', at: 1 },
      { code: 'B', name: '6b', at: 3, removed: true },
    ];

    expect(sameKnownClasses(listA, listB)).toBe(true);
    expect(sameKnownClasses(listA, listC)).toBe(false);
  });

  it('rememberClass speichert aktiv und forgetClass markiert als gelöscht', () => {
    rememberClass({ code: 'CLASS1', name: 'Informatik' });
    expect(loadClasses()).toEqual([
      expect.objectContaining({ code: 'CLASS1', name: 'Informatik', removed: false }),
    ]);

    forgetClass('CLASS1');
    // loadClasses filtert gelöschte Klassen heraus
    expect(loadClasses()).toEqual([]);

    // loadAllClassEntries behält den Löschvermerk für den Pass-Abgleich
    const all = loadAllClassEntries();
    expect(all).toHaveLength(1);
    expect(all[0]?.code).toBe('CLASS1');
    expect(all[0]?.removed).toBe(true);
  });
});
