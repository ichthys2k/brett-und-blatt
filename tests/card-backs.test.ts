import { beforeEach, describe, expect, it } from 'vitest';
import {
  CARD_BACK_CATALOG,
  getCardBackDefinition,
  isCardBackUnlocked,
  loadActiveCardBack,
  setActiveCardBack,
  CARD_BACK_KEY,
  type CardBackUnlockState,
} from '../apps/web/src/lib/cardBacks';
import { createPassBook, type Store } from '../apps/web/src/lib/passes';
import type { Book } from '../apps/web/src/lib/partiebuch';

function emptyBook(): Book {
  return {
    counts: {},
    stamps: {},
    recent: [],
  };
}

describe('Kartenrücken-Katalog & Freischaltungen (K2, #272)', () => {
  it('enthält alle 7 definierten Kartenrücken mit vollständigen Beschreibungen', () => {
    const expectedIds = [
      'classic-red',
      'classic-blue',
      'tavern-oak',
      'royal-crest',
      'bavarian-gold',
      'jester-velvet',
      'dragon-scale',
    ];

    expect(CARD_BACK_CATALOG.map((c) => c.id)).toEqual(expectedIds);
    for (const entry of CARD_BACK_CATALOG) {
      expect(entry.name.length).toBeGreaterThan(0);
      expect(entry.description.length).toBeGreaterThan(0);
      expect(typeof entry.unlockCheck).toBe('function');
    }
  });

  it('classic-red, classic-blue, tavern-oak und royal-crest sind von Beginn an freigeschaltet', () => {
    const state: CardBackUnlockState = {
      book: emptyBook(),
      hasCrest: false,
    };

    expect(isCardBackUnlocked('classic-red', state)).toBe(true);
    expect(isCardBackUnlocked('classic-blue', state)).toBe(true);
    expect(isCardBackUnlocked('tavern-oak', state)).toBe(true);
    expect(isCardBackUnlocked('royal-crest', state)).toBe(true);
  });

  describe('bavarian-gold (Wirtshaus-Raute Gold)', () => {
    const def = getCardBackDefinition('bavarian-gold');

    it('ist gesperrt, wenn weniger als 3 Stichspiel-Stempel erreicht sind', () => {
      const state: CardBackUnlockState = {
        book: emptyBook(),
        hasCrest: false,
      };

      const result = def.unlockCheck(state);
      expect(result.unlocked).toBe(false);
      expect(result.progressLabel).toContain('Noch 3 Stichspiel-Stempel');
    });

    it('schaltet frei, sobald 3 Stempel in Skat, Schafkopf, Doppelkopf oder Binokel vorhanden sind', () => {
      const book = emptyBook();
      book.stamps = {
        'skat/first': 1000,
        'skat/win': 2000,
        'schafkopf/first': 3000,
      };

      const state: CardBackUnlockState = {
        book,
        hasCrest: false,
      };

      const result = def.unlockCheck(state);
      expect(result.unlocked).toBe(true);
      expect(result.progressLabel).toContain('Freigeschaltet (3/3 Stichspiel-Stempel)');
    });
  });

  describe('jester-velvet (Narrenhof-Samt)', () => {
    const def = getCardBackDefinition('jester-velvet');

    it('ist gesperrt, wenn noch keine Partie im Narrenhof gespielt wurde', () => {
      const state: CardBackUnlockState = {
        book: emptyBook(),
        hasCrest: false,
        jesterUnlocked: false,
      };

      const result = def.unlockCheck(state);
      expect(result.unlocked).toBe(false);
      expect(result.progressLabel).toContain('Erfordert 1 Partie im Narrenhof');
    });

    it('schaltet frei, sobald 1 Partie im Narrenhof gespielt wurde', () => {
      const book = emptyBook();
      book.counts = {
        device1: {
          'color-sorter': {
            'solo/-': { played: 1, won: 0, drawn: 0, lost: 1 },
          },
        },
      };

      const state: CardBackUnlockState = {
        book,
        hasCrest: false,
      };

      const result = def.unlockCheck(state);
      expect(result.unlocked).toBe(true);
      expect(result.progressLabel).toContain('Freigeschaltet durch den Narrenhof');
    });

    it('schaltet frei, wenn Narren im Atelier freigeschaltet sind', () => {
      const state: CardBackUnlockState = {
        book: emptyBook(),
        hasCrest: false,
        jesterUnlocked: true,
      };

      const result = def.unlockCheck(state);
      expect(result.unlocked).toBe(true);
    });
  });

  describe('dragon-scale (Drachenschuppen-Glut)', () => {
    const def = getCardBackDefinition('dragon-scale');

    it('ist gesperrt, wenn noch kein Sieg im Drachenspiel erzielt wurde', () => {
      const book = emptyBook();
      book.counts = {
        device1: {
          drachenspiel: {
            'bots/easy': { played: 2, won: 0, drawn: 0, lost: 2 },
          },
        },
      };

      const state: CardBackUnlockState = {
        book,
        hasCrest: false,
      };

      const result = def.unlockCheck(state);
      expect(result.unlocked).toBe(false);
      expect(result.progressLabel).toContain('Erfordert 1 Sieg im Drachenspiel');
    });

    it('schaltet frei, sobald mindestens 1 Sieg im Drachenspiel verzeichnet ist', () => {
      const book = emptyBook();
      book.counts = {
        device1: {
          drachenspiel: {
            'bots/medium': { played: 1, won: 1, drawn: 0, lost: 0 },
          },
        },
      };

      const state: CardBackUnlockState = {
        book,
        hasCrest: false,
      };

      const result = def.unlockCheck(state);
      expect(result.unlocked).toBe(true);
      expect(result.progressLabel).toContain('Freigeschaltet durch Sieg im Drachenspiel');
    });
  });
});

describe('Speicherung & Pass-Wechsel (K2, #272)', () => {
  const storeMap = new Map<string, string>();
  const localStorageMock = {
    getItem: (key: string) => storeMap.get(key) ?? null,
    setItem: (key: string, val: string) => void storeMap.set(key, String(val)),
    removeItem: (key: string) => void storeMap.delete(key),
    clear: () => void storeMap.clear(),
  };

  (globalThis as unknown as { window: unknown }).window = { localStorage: localStorageMock };
  (globalThis as unknown as { localStorage: unknown }).localStorage = localStorageMock;

  beforeEach(() => {
    storeMap.clear();
  });

  it('loadActiveCardBack liefert standardmäßig classic-red', () => {
    expect(loadActiveCardBack()).toBe('classic-red');
  });

  it('gesperrter Rücken lässt sich nicht aktivieren', () => {
    // dragon-scale ist bei leerem Buch gesperrt
    const success = setActiveCardBack('dragon-scale');
    expect(success).toBe(false);
    expect(loadActiveCardBack()).toBe('classic-red');
  });

  it('freigeschalteter Rücken lässt sich aktivieren und speichern', () => {
    const success = setActiveCardBack('classic-blue');
    expect(success).toBe(true);
    expect(loadActiveCardBack()).toBe('classic-blue');
    expect(localStorage.getItem(CARD_BACK_KEY)).toBe('classic-blue');
  });

  it('gewählter Kartenrücken bleibt beim Pass-Wechsel je Pass erhalten (SCOPED_KEYS)', () => {
    const memory = new Map<string, string>();
    const store: Store = {
      get: (k) => memory.get(k) ?? null,
      set: (k, v) => void memory.set(k, v),
      remove: (k) => void memory.delete(k),
      keys: () => [...memory.keys()],
    };

    const book = createPassBook(store);
    const passA = { name: 'Cornelius', avatar: '🦁', hasCode: true };
    const passB = { name: 'Schüler', avatar: '🦊', hasCode: true };

    const idA = book.touch(passA)!;
    // Pass A wählt 'tavern-oak'
    store.set(CARD_BACK_KEY, 'tavern-oak');

    // Zu Pass B wechseln
    const idB = book.createNew(passA)!;
    book.touch(passB);
    // Pass B hat noch die Standard-Kartenrückenwahl
    expect(store.get(CARD_BACK_KEY)).toBeNull();
    // Pass B wählt 'classic-blue'
    store.set(CARD_BACK_KEY, 'classic-blue');

    // Zurück zu Pass A wechseln
    book.switchTo(idA, passB);
    expect(store.get(CARD_BACK_KEY)).toBe('tavern-oak');

    // Zurück zu Pass B wechseln
    book.switchTo(idB, passA);
    expect(store.get(CARD_BACK_KEY)).toBe('classic-blue');
  });
});
