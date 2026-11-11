import { beforeAll, describe, expect, it } from 'vitest';
import { unzipSync, zipSync } from 'fflate';
import { decompress } from 'fzstd';
import initSqlJs from 'sql.js';
import {
  ALL_BUB_NOTETYPES,
  BUB_COMBAT_CARD_FIELDS,
  BUB_COMBAT_CARD_NOTETYPE,
  BUB_COMBAT_CARD_NOTETYPE_ID,
  BUB_COMBAT_CARD_NOTETYPE_NAME,
  BUB_COURT_CARD_FIELDS,
  BUB_COURT_CARD_NOTETYPE,
  BUB_COURT_CARD_NOTETYPE_ID,
  BUB_COURT_CARD_NOTETYPE_NAME,
  BUB_QUARTETT_CARD_FIELDS,
  BUB_QUARTETT_CARD_NOTETYPE,
  BUB_QUARTETT_CARD_NOTETYPE_ID,
  BUB_QUARTETT_CARD_NOTETYPE_NAME,
  buildApkg,
  drachenspielCardsToAnki,
  ankiToDrachenspielCards,
  narrenhofCardsToAnki,
  ankiToNarrenhofCards,
  quartettSetToAnki,
  ankiToQuartettSet,
  woelfeRolesToAnki,
  ankiToWoelfeRoles,
  readApkg,
  renderCardSide,
  type ApkgDeps,
  type CombatCardLike,
  type CourtCardLike,
  type QuartettSetLike,
} from '../src';
import { sqlDeps } from '../../../apps/web/src/lib/ankiSql';

let deps: ApkgDeps;
beforeAll(async () => {
  const SQL = await initSqlJs();
  deps = sqlDeps(SQL, decompress, () => {
    throw new Error('zstd nicht benötigt für Legacy 2');
  });
});

describe('Anki-Spezialnotiztypen (K4)', () => {
  describe('Notiztyp-Definitionen', () => {
    it('Kampfkarte besitzt korrekte Felder, ID und Metadaten', () => {
      expect(BUB_COMBAT_CARD_NOTETYPE.id).toBe(BUB_COMBAT_CARD_NOTETYPE_ID);
      expect(BUB_COMBAT_CARD_NOTETYPE.name).toBe(BUB_COMBAT_CARD_NOTETYPE_NAME);
      expect(BUB_COMBAT_CARD_NOTETYPE.flds.map((f) => f.name)).toEqual([...BUB_COMBAT_CARD_FIELDS]);
      expect(BUB_COMBAT_CARD_NOTETYPE.tmpls).toHaveLength(1);
      expect(BUB_COMBAT_CARD_NOTETYPE.tmpls[0]?.name).toBe('Kampfkarte');
      expect(BUB_COMBAT_CARD_NOTETYPE.tmpls[0]?.qfmt).toContain('bub-combat-card');
      expect(BUB_COMBAT_CARD_NOTETYPE.tmpls[0]?.afmt).toContain('<hr id=answer>');
    });

    it('Hof- & Rollenkarte besitzt korrekte Felder, ID und Metadaten', () => {
      expect(BUB_COURT_CARD_NOTETYPE.id).toBe(BUB_COURT_CARD_NOTETYPE_ID);
      expect(BUB_COURT_CARD_NOTETYPE.name).toBe(BUB_COURT_CARD_NOTETYPE_NAME);
      expect(BUB_COURT_CARD_NOTETYPE.flds.map((f) => f.name)).toEqual([...BUB_COURT_CARD_FIELDS]);
      expect(BUB_COURT_CARD_NOTETYPE.tmpls).toHaveLength(1);
      expect(BUB_COURT_CARD_NOTETYPE.tmpls[0]?.name).toBe('Hof- & Rollenkarte');
      expect(BUB_COURT_CARD_NOTETYPE.tmpls[0]?.qfmt).toContain('bub-court-card');
      expect(BUB_COURT_CARD_NOTETYPE.tmpls[0]?.afmt).toContain('<hr id=answer>');
    });

    it('Quartettkarte besitzt korrekte Felder, ID und Metadaten', () => {
      expect(BUB_QUARTETT_CARD_NOTETYPE.id).toBe(BUB_QUARTETT_CARD_NOTETYPE_ID);
      expect(BUB_QUARTETT_CARD_NOTETYPE.name).toBe(BUB_QUARTETT_CARD_NOTETYPE_NAME);
      expect(BUB_QUARTETT_CARD_NOTETYPE.flds.map((f) => f.name)).toEqual([...BUB_QUARTETT_CARD_FIELDS]);
      expect(BUB_QUARTETT_CARD_NOTETYPE.tmpls).toHaveLength(1);
      expect(BUB_QUARTETT_CARD_NOTETYPE.tmpls[0]?.name).toBe('Quartettkarte');
      expect(BUB_QUARTETT_CARD_NOTETYPE.tmpls[0]?.qfmt).toContain('bub-quartett-card');
      expect(BUB_QUARTETT_CARD_NOTETYPE.tmpls[0]?.afmt).toContain('<hr id=answer>');
    });

    it('ALL_BUB_NOTETYPES bündelt alle vier offiziellen Notiztypen', () => {
      expect(ALL_BUB_NOTETYPES).toHaveLength(4);
      const ids = ALL_BUB_NOTETYPES.map((nt) => nt.id);
      expect(new Set(ids).size).toBe(4);
    });
  });

  describe('HTML-Rendering (renderCardSide)', () => {
    it('rendert Kampfkarte Vorder- und Rückseite mit allen Details und Laufzeithinweis', () => {
      const sampleCard: CombatCardLike = {
        id: 'fuchs',
        name: 'Schlauer Fuchs',
        cost: 3,
        attack: 3,
        health: 2,
        emoji: '🦊',
        house: 'forest',
        rarity: 'rare',
        isSpell: false,
        families: ['pack'],
        keywords: ['rush', 'stealth'],
        text: 'Eifer. Verstohlenheit.',
        quote: 'Er schleicht durch den Tann.',
      };

      const col = drachenspielCardsToAnki([sampleCard]);
      const note = col.notes[0]!;

      const frontHtml = renderCardSide(BUB_COMBAT_CARD_NOTETYPE, note, 0, 'front', {
        runtimeFields: { SpielHinweis: 'Darf sofort angreifen' },
      });

      expect(frontHtml.html).toContain('Schlauer Fuchs');
      expect(frontHtml.html).toContain('💎');
      expect(frontHtml.html).toContain('3');
      expect(frontHtml.html).toContain('🦊');
      expect(frontHtml.html).toContain('⚔️');
      expect(frontHtml.html).toContain('🛡️');
      expect(frontHtml.html).toContain('rush, stealth');
      expect(frontHtml.html).toContain('Darf sofort angreifen');

      const backHtml = renderCardSide(BUB_COMBAT_CARD_NOTETYPE, note, 0, 'back', {
        runtimeFields: { SpielHinweis: 'Darf sofort angreifen' },
      });
      expect(backHtml.html).toContain('id="bub-answer"');
      expect(backHtml.html).toContain('Hinweis: Darf sofort angreifen');
    });

    it('rendert Hofkarte Vorder- und Rückseite mit Preisen und Werten', () => {
      const sampleMod: CourtCardLike = {
        key: 'juggler',
        name: 'Der Jongleur',
        emoji: '🤹',
        rarity: 'common',
        price: 5,
        text: '+2 Lachen je gewertete Karte',
        category: 'Narr',
        game: 'narrenhof',
      };

      const col = narrenhofCardsToAnki([sampleMod]);
      const note = col.notes[0]!;

      const frontHtml = renderCardSide(BUB_COURT_CARD_NOTETYPE, note, 0, 'front');
      expect(frontHtml.html).toContain('Der Jongleur');
      expect(frontHtml.html).toContain('5');
      expect(frontHtml.html).toContain('🥨');
      expect(frontHtml.html).toContain('+2 Lachen je gewertete Karte');
      expect(frontHtml.html).toContain('🤹');

      const backHtml = renderCardSide(BUB_COURT_CARD_NOTETYPE, note, 0, 'back');
      expect(backHtml.html).toContain('id="bub-answer"');
      expect(backHtml.html).toContain('Preis: 5 🥨');
    });

    it('rendert Quartettkarte Vorder- und Rückseite mit Eigenschaftstabelle', () => {
      const sampleSet: QuartettSetLike = {
        id: 'tiere',
        name: 'Tiere der Welt',
        properties: [
          { id: 'gewicht', label: 'Gewicht', unit: 'kg', higherWins: true },
          { id: 'tempo', label: 'Geschwindigkeit', unit: 'km/h', higherWins: true },
        ],
        groups: [{ id: 'A', name: 'Raubkatzen' }],
        cards: [
          {
            id: 'A1',
            name: 'Löwe',
            emoji: '🦁',
            values: { gewicht: 190, tempo: 80 },
            source: 'Wikipedia',
          },
        ],
      };

      const col = quartettSetToAnki(sampleSet);
      const note = col.notes[0]!;

      const frontHtml = renderCardSide(BUB_QUARTETT_CARD_NOTETYPE, note, 0, 'front');
      expect(frontHtml.html).toContain('A');
      expect(frontHtml.html).toContain('Raubkatzen');
      expect(frontHtml.html).toContain('Löwe');
      expect(frontHtml.html).toContain('🦁');
      expect(frontHtml.html).toContain('Gewicht');
      expect(frontHtml.html).toContain('190 kg');
      expect(frontHtml.html).toContain('Geschwindigkeit');
      expect(frontHtml.html).toContain('80 km/h');

      const backHtml = renderCardSide(BUB_QUARTETT_CARD_NOTETYPE, note, 0, 'back');
      expect(backHtml.html).toContain('id="bub-answer"');
      expect(backHtml.html).toContain('Set: Tiere der Welt');
    });
  });

  describe('Rundlauf-Garantie (Export ↔ Import)', () => {
    it('Drachenspiel: Karten exportieren, in Anki editieren und verlustfrei re-importieren', () => {
      const originalCards: CombatCardLike[] = [
        {
          id: 'baer',
          name: 'Brauner Bär',
          cost: 4,
          attack: 4,
          health: 5,
          emoji: '🐻',
          house: 'forest',
          rarity: 'common',
          isSpell: false,
          families: ['pack'],
          keywords: ['taunt'],
          text: 'Spott.',
          quote: 'Ein Wächter des Waldes.',
          // Zusätzliche Spielmechanik-Daten
          triggers: [{ on: 'played', do: [{ kind: 'armor', amount: 2 }] }],
        },
        {
          id: 'feuerball',
          name: 'Feuerball',
          cost: 4,
          emoji: '🔥',
          house: 'wild',
          rarity: 'rare',
          isSpell: true,
          school: 'ember',
          text: 'Fügt 6 Schaden zu.',
          quote: 'Aus Asche geboren.',
          effects: [{ kind: 'damage', amount: 6, to: { pick: 'chosen' } }],
        },
      ];

      // Export
      const col = drachenspielCardsToAnki(originalCards);
      expect(col.notes).toHaveLength(2);

      // Simulation: Benutzer ändert im Anki-Editor den Bären (z. B. Buff: Angriff 5 statt 4, Name modifiziert)
      const bearNote = col.notes.find((n) => n.fields[0] === 'baer')!;
      bearNote.fields[1] = 'Uralter Bär'; // Name
      bearNote.fields[6] = '5'; // Angriff geändert von 4 auf 5
      bearNote.fields[10] = 'Spott. Erhält +2 Rüstung.'; // Regeltext editiert

      // Re-Import
      const imported = ankiToDrachenspielCards(col);
      expect(imported).toHaveLength(2);

      const reimportedBear = imported.find((c) => c.id === 'baer')!;
      expect(reimportedBear.name).toBe('Uralter Bär');
      expect(reimportedBear.attack).toBe(5);
      expect(reimportedBear.health).toBe(5);
      expect(reimportedBear.text).toBe('Spott. Erhält +2 Rüstung.');
      // Die tieferen Triggers aus EffektDatenJSON blieben vollständig erhalten!
      expect(reimportedBear.triggers).toEqual([{ on: 'played', do: [{ kind: 'armor', amount: 2 }] }]);

      const reimportedFireball = imported.find((c) => c.id === 'feuerball')!;
      expect(reimportedFireball.name).toBe('Feuerball');
      expect(reimportedFireball.isSpell).toBe(true);
      expect(reimportedFireball.effects).toEqual([{ kind: 'damage', amount: 6, to: { pick: 'chosen' } }]);
    });

    it('Narrenhof: Mods exportieren, editieren und re-importieren', () => {
      const originalMods: CourtCardLike[] = [
        {
          key: 'fool_echo',
          name: 'Das Echo',
          emoji: '🗣️',
          rarity: 'uncommon',
          price: 6,
          text: 'Wiederholt die letzte Wertung',
          game: 'narrenhof',
          category: 'Narr',
          customEngineData: { retriggerCount: 1 },
        },
      ];

      const col = narrenhofCardsToAnki(originalMods);
      expect(col.notes).toHaveLength(1);

      // In Anki den Preis und den Spruch ändern
      col.notes[0]!.fields[5] = '7'; // Kaufpreis
      col.notes[0]!.fields[9] = 'Wiederholt die letzte Wertung doppelt'; // Regeltext

      const imported = ankiToNarrenhofCards(col);
      expect(imported).toHaveLength(1);
      expect(imported[0]?.key).toBe('fool_echo');
      expect(imported[0]?.price).toBe(7);
      expect(imported[0]?.text).toBe('Wiederholt die letzte Wertung doppelt');
      expect((imported[0] as unknown as Record<string, unknown>).customEngineData).toEqual({ retriggerCount: 1 });
    });

    it('Quartett: Set exportieren, Werte editieren und re-importieren', () => {
      const originalSet: QuartettSetLike = {
        id: 'weltraum',
        name: 'Weltraum',
        emoji: '🚀',
        license: 'CC-BY-4.0',
        description: 'Planeten und Sterne unseres Sonnensystems',
        note: 'Werte gerundet',
        properties: [
          { id: 'durchmesser', label: 'Durchmesser', unit: 'km', higherWins: true },
          { id: 'abstand', label: 'Sonnenabstand', unit: 'Mio. km', higherWins: false },
        ],
        groups: [{ id: 'A', name: 'Gesteinsplaneten' }],
        cards: [
          {
            id: 'A1',
            name: 'Merkur',
            emoji: '🪐',
            values: { durchmesser: 4879, abstand: 58 },
            source: 'NASA',
          },
        ],
      };

      const col = quartettSetToAnki(originalSet);
      expect(col.notes).toHaveLength(1);

      // In Anki den Durchmesser von Merkur korrigieren (z. B. auf 4880) und Namen ändern
      col.notes[0]!.fields[4] = 'Planet Merkur';
      col.notes[0]!.fields[7] = '4880'; // Wert1_Zahl (Durchmesser)

      const imported = ankiToQuartettSet(col);
      expect(imported.id).toBe('weltraum');
      expect(imported.name).toBe('Weltraum');
      expect(imported.cards).toHaveLength(1);
      expect(imported.cards[0]?.id).toBe('A1');
      expect(imported.cards[0]?.name).toBe('Planet Merkur');
      expect(imported.cards[0]?.values.durchmesser).toBe(4880);
      expect(imported.cards[0]?.values.abstand).toBe(58);
    });

    it('Wölfe im Schafspelz: Standardrollen exportieren und re-importieren', () => {
      const col = woelfeRolesToAnki();
      // 9 Standardrollen
      expect(col.notes).toHaveLength(9);

      const wolfNote = col.notes.find((n) => n.fields[0] === 'woelfe:wolf')!;
      expect(wolfNote).toBeDefined();
      expect(wolfNote.fields[3]).toBe('Wolf');

      // In Anki Rollen-Hinweistext anpassen
      wolfNote.fields[9] = 'Neuer Hinweistext für den Alpha-Wolf.';

      const imported = ankiToWoelfeRoles(col);
      expect(imported).toHaveLength(9);
      const reimportedWolf = imported.find((r) => r.role === 'wolf')!;
      expect(reimportedWolf.hint).toBe('Neuer Hinweistext für den Alpha-Wolf.');
      expect(reimportedWolf.emoji).toBe('🐺');
    });
  });

  describe('APKG-Rundlauf mit Datenbank und Zip', () => {
    it('kann eine Spezialdeck-Sammlung nach .apkg exportieren und fehlerfrei wieder importieren', async () => {
      const col = woelfeRolesToAnki();
      const uncompressedFiles = buildApkg(
        { collection: col },
        { scheduling: true, media: false },
        deps,
      );
      const apkgZip = zipSync(uncompressedFiles);

      expect(apkgZip).toBeInstanceOf(Uint8Array);
      expect(apkgZip.byteLength).toBeGreaterThan(1000);

      const unpackedFiles = unzipSync(apkgZip);
      const imported = readApkg(unpackedFiles, deps);

      expect(imported.collection.notetypes).toHaveLength(1);
      expect(imported.collection.notetypes[0]?.id).toBe(BUB_COURT_CARD_NOTETYPE_ID);
      expect(imported.collection.notes).toHaveLength(9);
    });
  });
});
