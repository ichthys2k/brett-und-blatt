import { describe, expect, it } from 'vitest';
import {
  BUB_COMBAT_CARD_NOTETYPE,
  BUB_COURT_CARD_NOTETYPE,
  BUB_QUARTETT_CARD_NOTETYPE,
  parseCombatCardSpec,
  parseCourtCardSpec,
  parseCustomCardCatalog,
  parseQuartettCardSpec,
  type AnkiCollection,
  type AnkiNote,
} from '../src';

describe('cardSpecParser (K7, #277)', () => {
  describe('Drachenspiel (Kampfkarten-Werte)', () => {
    it('parst und validiert gültige Zahlenwerte und Schlüsselwörter', () => {
      const note: AnkiNote = {
        id: 1,
        guid: 'bub-combat-c53',
        mid: BUB_COMBAT_CARD_NOTETYPE.id,
        did: 1,
        mod: 0,
        tags: ['combat', 'drachenspiel'],
        fields: [
          'c53', // Kennung
          'Silberfuchs', // Name
          'Begleiter', // Kartenart
          'wald', // Klasse
          'common', // Seltenheit
          '3', // Kosten
          '4', // Angriff
          '5', // Leben
          'Tiere', // Stamm
          'Spott, Ansturm', // Schluesselwoerter
          'Regeltext...', // Regeltext
          'Spruch...', // Spruch
          '🦊', // Bild
          '', // Rahmen
          '{}', // EffektDatenJSON
        ],
        flags: 0,
        data: '',
      };

      const res = parseCombatCardSpec(note);
      expect(res.card.id).toBe('c53');
      expect(res.card.name).toBe('Silberfuchs');
      expect(res.card.cost).toBe(3);
      expect(res.card.attack).toBe(4);
      expect(res.card.health).toBe(5);
      expect(res.card.keywords).toEqual(['taunt', 'rush']);
      expect(res.notices).toHaveLength(0);
    });

    it('klammert Grenzwerte (Clamping) und meldet ungültige Eingaben auf Deutsch', () => {
      const note: AnkiNote = {
        id: 2,
        guid: 'bub-combat-c53',
        mid: BUB_COMBAT_CARD_NOTETYPE.id,
        did: 1,
        mod: 0,
        tags: ['combat', 'drachenspiel'],
        fields: [
          'c53', // Kennung
          'Superdrache', // Name
          'Begleiter', // Kartenart
          'wald', // Klasse
          'common', // Seltenheit
          '99', // Kosten (Maximum 20)
          '-5', // Angriff (Minimum 0)
          'keineZahl', // Leben (ungültig -> Fallback 1)
          '', // Stamm
          'Fliegen, Spott', // 'Fliegen' ist unbekannt
          '', '', '', '', '',
        ],
        flags: 0,
        data: '',
      };

      const res = parseCombatCardSpec(note);
      expect(res.card.cost).toBe(20);
      expect(res.card.attack).toBe(0);
      expect(res.card.health).toBe(1);
      expect(res.card.keywords).toEqual(['taunt']);
      expect(res.notices.some((n) => n.includes('überschreitet das Maximum 20'))).toBe(true);
      expect(res.notices.some((n) => n.includes('liegt unter dem Minimum 0'))).toBe(true);
      expect(res.notices.some((n) => n.includes('ist keine Zahl'))).toBe(true);
      expect(res.notices.some((n) => n.includes('Unbekanntes Schlüsselwort ‚fliegen‘ ignoriert'))).toBe(true);
    });
  });

  describe('Narrenhof (Hofnarren-Werte)', () => {
    it('parst Kaufpreis, Basiswert und Multiplikator', () => {
      const note: AnkiNote = {
        id: 10,
        guid: 'bub-court-narrenhof-mod-clown',
        mid: BUB_COURT_CARD_NOTETYPE.id,
        did: 1,
        mod: 0,
        tags: ['court', 'narrenhof'],
        fields: [
          'mod-clown', // Kennung
          'narrenhof', // Spiel
          'Narr', // Kategorie
          'Oberster Hofnarr', // Name
          'episch', // Seltenheit
          '8', // Kaufpreis
          '50', // Basiswert
          'x4', // Multiplikator
          '', '', '', '', '', '',
        ],
        flags: 0,
        data: '',
      };

      const res = parseCourtCardSpec(note);
      expect(res.card.key).toBe('mod-clown');
      expect(res.card.name).toBe('Oberster Hofnarr');
      expect(res.card.price).toBe(8);
      expect(res.card.baseChips).toBe(50);
      expect(res.card.multiplier).toBe(4);
      expect(res.notices).toHaveLength(0);
    });
  });

  describe('Quartett (Mess- und Vergleichswerte)', () => {
    it('parst Zahlenwerte für die Eigenschaften', () => {
      const note: AnkiNote = {
        id: 20,
        guid: 'bub-quartett-tiere-A1',
        mid: BUB_QUARTETT_CARD_NOTETYPE.id,
        did: 1,
        mod: 0,
        tags: ['quartett', 'tiere'],
        fields: [
          'tiere:A1', // Kennung
          'Tiere der Welt', // SetName
          'A', // GruppeCode
          'Raubkatzen', // GruppeName
          'Löwe', // Name
          '🦁', // Bild
          'Gewicht', '250', 'kg', 'true',
          'Geschwindigkeit', '80', 'km/h', 'true',
          '', '', '', '',
          '', '', '', '',
          '', '', '', '',
          '', '', '', '',
          'Info...', '', '',
        ],
        flags: 0,
        data: '',
      };

      const res = parseQuartettCardSpec(note, ['weight', 'speed']);
      expect(res.card.id).toBe('A1');
      expect(res.card.name).toBe('Löwe');
      expect(res.card.values.weight).toBe(250);
      expect(res.card.values.speed).toBe(80);
      expect(res.notices).toHaveLength(0);
    });
  });

  describe('parseCustomCardCatalog & Checksum', () => {
    it('erzeugt deterministische Prüfsumme über geänderte Kartensätze', () => {
      const col: AnkiCollection = {
        v: 2,
        notetypes: [BUB_COMBAT_CARD_NOTETYPE],
        decks: [],
        notes: [
          {
            id: 1,
            guid: 'c53',
            mid: BUB_COMBAT_CARD_NOTETYPE.id,
            did: 1,
            mod: 0,
            tags: ['drachenspiel'],
            fields: ['c53', 'Fuchs', 'Begleiter', 'wald', 'common', '2', '3', '4', '', '', '', '', '', '', ''],
            flags: 0,
            data: '',
          },
        ],
        graves: [],
      };

      const cat1 = parseCustomCardCatalog(col);
      const cat2 = parseCustomCardCatalog(col);
      expect(cat1.checksum).toHaveLength(8);
      expect(cat1.checksum).toBe(cat2.checksum);
      expect(cat1.combatCards.c53?.cost).toBe(2);
      expect(cat1.combatCards.c53?.attack).toBe(3);
      expect(cat1.combatCards.c53?.health).toBe(4);
    });
  });
});
