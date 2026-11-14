import { describe, expect, it } from 'vitest';
import {
  cardToKennung,
  cardKennungCandidates,
  extractImageRef,
  extractPlayingCardOverrides,
  createPlayingCardCollection,
  BUB_PLAYING_CARD_NOTETYPE_ID,
  type AnkiCollection,
} from '../src';

describe('Anki Sheet Overrides', () => {
  describe('cardToKennung', () => {
    it('creates french kennung for standard french cards', () => {
      expect(cardToKennung('H1.1', 'four-color')).toBe('fr:hearts-A');
      expect(cardToKennung('H13.1', 'french')).toBe('fr:hearts-K');
      expect(cardToKennung('S12.1', 'four-color')).toBe('fr:spades-D');
      expect(cardToKennung('C11.1', 'simple')).toBe('fr:clubs-B');
      expect(cardToKennung('D10.1', 'four-color')).toBe('fr:diamonds-10');
      expect(cardToKennung('H7.1', 'four-color')).toBe('fr:hearts-7');
    });

    it('creates bavarian/german kennung for bavarian or german deckStyle', () => {
      expect(cardToKennung('H1.1', 'bavarian')).toBe('by:herz-A');
      expect(cardToKennung('D12.1', 'bavarian')).toBe('by:schellen-O');
      expect(cardToKennung('C11.1', 'german')).toBe('by:eichel-U');
      expect(cardToKennung('S13.1', 'bavarian')).toBe('by:gras-K');
      expect(cardToKennung('D7.1', 'german')).toBe('by:schellen-7');
    });

    it('handles jokers correctly', () => {
      expect(cardToKennung('JK.1', 'four-color')).toBe('fr:joker');
      expect(cardToKennung('JK.1', 'bavarian')).toBe('by:joker');
    });
  });

  describe('cardKennungCandidates', () => {
    it('provides primary kennung first, then alternate sheet candidate', () => {
      expect(cardKennungCandidates('H1.1', 'four-color')).toEqual(['fr:hearts-A', 'by:herz-A']);
      expect(cardKennungCandidates('D12.1', 'bavarian')).toEqual(['by:schellen-O', 'fr:diamonds-D']);
    });
  });

  describe('extractImageRef', () => {
    it('extracts filename from <img src="...">', () => {
      expect(extractImageRef('<img src="herz_ass.png">')).toBe('herz_ass.png');
      expect(extractImageRef('<img src=\'bavarian_ober.jpg\' alt="Ober" />')).toBe('bavarian_ober.jpg');
    });

    it('returns raw string if not an img tag', () => {
      expect(extractImageRef('custom_art.png')).toBe('custom_art.png');
      expect(extractImageRef('')).toBe('');
    });
  });

  describe('extractPlayingCardOverrides', () => {
    it('extracts overrides from a playing card collection with custom note fields', () => {
      const col: AnkiCollection = {
        v: 2,
        notetypes: [],
        decks: [],
        graves: [],
        notes: [
          {
            id: 1,
            guid: 'g1',
            mid: BUB_PLAYING_CARD_NOTETYPE_ID,
            did: 1,
            mod: 100,
            tags: ['spielblatt', 'custom'],
            fields: [
              'fr:hearts-A', // 0: Kennung
              'franzoesisch', // 1: Blatt
              'hearts', // 2: Farbe
              'A', // 3: Rang
              'Die Rote Kaiserin', // 4: Name (custom)
              'A', // 5: Eckzeichen
              '♥', // 6: FarbSymbol
              '<img src="kaiserin.png">', // 7: Bild (custom)
              'gold-barock', // 8: Rahmen (custom)
              '11', // 9: PunkteStandard
              'Prachtvolle Kaiserin', // 10: Beschreibung
            ],
          },
          {
            id: 2,
            guid: 'g2',
            mid: BUB_PLAYING_CARD_NOTETYPE_ID,
            did: 1,
            mod: 100,
            tags: ['spielblatt'],
            fields: [
              'by:schellen-O',
              'bayerisch',
              'schellen',
              'O',
              'Glocken-Ober',
              'O',
              '🔔',
              'schellen_ober.png',
              'wood-tavern',
              '3',
              'Bayerischer Ober',
            ],
          },
        ],
      };

      const mediaMap = new Map<string, string>([
        ['kaiserin.png', 'blob:http://localhost/kaiserin-blob-url'],
        ['schellen_ober.png', 'blob:http://localhost/schellen-blob-url'],
      ]);

      const overrides = extractPlayingCardOverrides(col, {
        mediaResolver: (name) => mediaMap.get(name) ?? null,
      });

      expect(overrides['fr:hearts-A']).toEqual({
        kennung: 'fr:hearts-A',
        name: 'Die Rote Kaiserin',
        image: 'blob:http://localhost/kaiserin-blob-url',
        frame: 'gold-barock',
        description: 'Prachtvolle Kaiserin',
        points: '11',
      });

      expect(overrides['by:schellen-O']).toEqual({
        kennung: 'by:schellen-O',
        name: 'Glocken-Ober',
        image: 'blob:http://localhost/schellen-blob-url',
        frame: 'wood-tavern',
        description: 'Bayerischer Ober',
        points: '3',
      });
    });

    it('works seamlessly with createPlayingCardCollection stock deck', () => {
      const col = createPlayingCardCollection({ deck: 'french-32' });
      const overrides = extractPlayingCardOverrides(col);
      expect(Object.keys(overrides).length).toBe(32);
      expect(overrides['fr:hearts-A']).toBeDefined();
      expect(overrides['fr:hearts-A']?.name).toBe('Herz-Ass');
    });
  });
});
