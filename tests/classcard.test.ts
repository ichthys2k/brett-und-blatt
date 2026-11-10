import { CARD_STAMP_KINDS, DEFAULT_CARD_SECTIONS, CARD_SECTIONS } from '../packages/online/src';
import { describe, expect, it, beforeEach } from 'vitest';
import { STAMP_KINDS } from '../apps/web/src/lib/stamps';
import { buildClassCard, hiddenSections, setSectionHidden } from '../apps/web/src/lib/classes';
import { ALBUM_KEY } from '../apps/web/src/lib/album';
import { BOOK_KEY } from '../apps/web/src/lib/passRecorder';

const store = new Map<string, string>();
const localStorageMock = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => store.set(k, String(v)),
  removeItem: (k: string) => store.delete(k),
  clear: () => store.clear(),
};
(globalThis as unknown as { window: unknown }).window = {
  localStorage: localStorageMock,
  setTimeout,
  clearTimeout,
  crypto,
};
(globalThis as unknown as { localStorage: unknown }).localStorage = localStorageMock;

describe('Klassenkarte (#151)', () => {
  beforeEach(() => {
    store.clear();
    store.set('brett-und-blatt:spielerpass:profil', JSON.stringify({ name: 'Alex', avatar: '🦊' }));
  });

  it('kennt dieselben Stempelarten wie die Pass-Seite', () => {
    expect([...CARD_STAMP_KINDS]).toEqual([...STAMP_KINDS]);
  });

  it('enthält alle 5 Abschnitte im Standard', () => {
    expect(CARD_SECTIONS).toEqual(['stamps', 'trophies', 'favorites', 'album', 'botRating']);
    expect(DEFAULT_CARD_SECTIONS).toEqual({
      stamps: true,
      trophies: true,
      favorites: true,
      album: true,
      botRating: true,
    });
  });

  it('baut Klassenkarte mit Album-Funden und Bot-Wertung', () => {
    store.set(ALBUM_KEY, JSON.stringify({
      drachenspiel: { total: 10, found: { card1: 100, card2: 200 } },
      quartett: { total: 32, found: { t1: 300 } },
    }));

    store.set(BOOK_KEY, JSON.stringify({
      counts: {
        dev1: {
          chess: {
            'bots/medium': { played: 5, won: 3, drawn: 1, lost: 1 },
          },
        },
      },
      stamps: {},
      recent: [],
    }));

    const card = buildClassCard(DEFAULT_CARD_SECTIONS);
    expect(card.album).toEqual([
      { gameId: 'drachenspiel', count: 2 },
      { gameId: 'quartett', count: 1 },
    ]);
    expect(card.botRating).toEqual([
      { gameId: 'chess', games: 5, rating: 1320, wins: 3 },
    ]);
  });

  it('berücksichtigt ausgeblendete oder nicht erlaubte Abschnitte', () => {
    store.set(ALBUM_KEY, JSON.stringify({
      drachenspiel: { total: 10, found: { card1: 100 } },
    }));

    // Leitung schaltet Album aus
    const cardWithoutAlbum = buildClassCard({ ...DEFAULT_CARD_SECTIONS, album: false });
    expect(cardWithoutAlbum.album).toBeUndefined();

    // Mitglied blendet Album für sich aus
    setSectionHidden('album', true);
    expect(hiddenSections()).toContain('album');
    const cardHidden = buildClassCard(DEFAULT_CARD_SECTIONS);
    expect(cardHidden.album).toBeUndefined();

    // Wieder einblenden
    setSectionHidden('album', false);
    expect(hiddenSections()).not.toContain('album');
    const cardVisibleAgain = buildClassCard(DEFAULT_CARD_SECTIONS);
    expect(cardVisibleAgain.album).toBeDefined();
  });
});
