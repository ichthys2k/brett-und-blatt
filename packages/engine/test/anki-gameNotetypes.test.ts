import { beforeAll, describe, expect, it } from 'vitest';
import { unzipSync, zipSync } from 'fflate';
import { decompress } from 'fzstd';
import initSqlJs from 'sql.js';
import {
  BUB_PLAYING_CARD_FIELDS,
  BUB_PLAYING_CARD_NOTETYPE,
  BUB_PLAYING_CARD_NOTETYPE_ID,
  BUB_PLAYING_CARD_NOTETYPE_NAME,
  createPlayingCardCollection,
  buildApkg,
  readApkg,
  renderCardSide,
  type ApkgDeps,
} from '../src';
import { sqlDeps } from '../../../apps/web/src/lib/ankiSql';

let deps: ApkgDeps;
beforeAll(async () => {
  const SQL = await initSqlJs();
  deps = sqlDeps(SQL, decompress, () => {
    throw new Error('zstd nicht benötigt für Legacy 2');
  });
});

describe('Anki-Notiztyp: Klassisches Spielblatt (K3)', () => {
  it('besitzt die fest vorgegebenen 11 Felder und Metadaten', () => {
    expect(BUB_PLAYING_CARD_NOTETYPE.id).toBe(BUB_PLAYING_CARD_NOTETYPE_ID);
    expect(BUB_PLAYING_CARD_NOTETYPE.name).toBe(BUB_PLAYING_CARD_NOTETYPE_NAME);
    expect(BUB_PLAYING_CARD_NOTETYPE.flds.map((f) => f.name)).toEqual([
      'Kennung',
      'Blatt',
      'Farbe',
      'Rang',
      'Name',
      'Eckzeichen',
      'FarbSymbol',
      'Bild',
      'Rahmen',
      'PunkteStandard',
      'BeschreibungStandard',
    ]);
    expect(BUB_PLAYING_CARD_FIELDS).toEqual(BUB_PLAYING_CARD_NOTETYPE.flds.map((f) => f.name));
    expect(BUB_PLAYING_CARD_NOTETYPE.tmpls).toHaveLength(1);
    expect(BUB_PLAYING_CARD_NOTETYPE.tmpls[0]?.name).toBe('Spielkarte');
    expect(BUB_PLAYING_CARD_NOTETYPE.tmpls[0]?.qfmt).toContain('{{#SpielHinweis}}{{SpielHinweis}}{{/SpielHinweis}}{{^SpielHinweis}}{{BeschreibungStandard}}{{/SpielHinweis}}');
  });

  it('erzeugt vollständige Kollektionen mit deterministischen GUIDs und IDs', () => {
    const colAll = createPlayingCardCollection();
    expect(colAll.v).toBe(2);
    expect(colAll.notetypes).toHaveLength(1);
    expect(colAll.notetypes[0]?.id).toBe(BUB_PLAYING_CARD_NOTETYPE_ID);

    // 52 französische + 32 bayerische = 84 Karten
    expect(colAll.notes).toHaveLength(84);

    // Deterministische GUIDs prüfen
    const heartsAce = colAll.notes.find((n) => n.guid === 'bub-card-fr-hearts-A');
    expect(heartsAce).toBeDefined();
    expect(heartsAce?.fields[0]).toBe('fr:hearts-A');
    expect(heartsAce?.fields[1]).toBe('franzoesisch');
    expect(heartsAce?.fields[2]).toBe('hearts');
    expect(heartsAce?.fields[3]).toBe('A');
    expect(heartsAce?.fields[4]).toBe('Herz-Ass');
    expect(heartsAce?.fields[5]).toBe('A');
    expect(heartsAce?.fields[6]).toBe('♥');
    expect(heartsAce?.fields[9]).toBe('11');

    const schellenOber = colAll.notes.find((n) => n.guid === 'bub-card-by-schellen-O');
    expect(schellenOber).toBeDefined();
    expect(schellenOber?.fields[0]).toBe('by:schellen-O');
    expect(schellenOber?.fields[1]).toBe('bayerisch');
    expect(schellenOber?.fields[2]).toBe('schellen');
    expect(schellenOber?.fields[3]).toBe('O');
    expect(schellenOber?.fields[4]).toBe('Schellen-Ober');
    expect(schellenOber?.fields[5]).toBe('O');
    expect(schellenOber?.fields[6]).toBe('🔔');
    expect(schellenOber?.fields[9]).toBe('3');

    // Alle GUIDs und IDs müssen strikt eindeutig sein
    const guids = new Set(colAll.notes.map((n) => n.guid));
    expect(guids.size).toBe(84);
    const ids = new Set(colAll.notes.map((n) => n.id));
    expect(ids.size).toBe(84);
  });

  it('erzeugt konfigurierbare Teilblätter', () => {
    const french52 = createPlayingCardCollection({ deck: 'french-52' });
    expect(french52.notes).toHaveLength(52);
    expect(french52.notes.every((n) => n.fields[1] === 'franzoesisch')).toBe(true);

    const french32 = createPlayingCardCollection({ deck: 'french-32' });
    expect(french32.notes).toHaveLength(32);
    expect(french32.notes.every((n) => n.fields[1] === 'franzoesisch')).toBe(true);

    const bavarian32 = createPlayingCardCollection({ deck: 'bavarian-32' });
    expect(bavarian32.notes).toHaveLength(32);
    expect(bavarian32.notes.every((n) => n.fields[1] === 'bayerisch')).toBe(true);
  });

  it('Rundlauf-Test: Spielblatt-Collection nach .apkg exportieren, wieder importieren, geänderten Kartennamen und dynamisches runtimeFields.SpielHinweis rendern', () => {
    // 1. Spielblatt-Kollektion generieren
    const originalCol = createPlayingCardCollection({ deck: 'french-52' });

    // 2. Als .apkg (Legacy 2) bauen und packen
    const uncompressedFiles = buildApkg(
      { collection: originalCol },
      { scheduling: true, media: false },
      deps,
    );
    const apkgZip = zipSync(uncompressedFiles);

    // 3. .apkg entpacken und über readApkg wieder importieren
    const unpackedFiles = unzipSync(apkgZip);
    const imported = readApkg(unpackedFiles, deps);

    // Prüfen, ob Kollektion und Notiztyp korrekt wiederhergestellt wurden
    expect(imported.collection.notetypes).toHaveLength(1);
    expect(imported.collection.notetypes[0]?.name).toBe(BUB_PLAYING_CARD_NOTETYPE_NAME);
    expect(imported.collection.notes).toHaveLength(52);

    // 4. Herz-Ass suchen und Namen ändern (wie wenn in Anki editiert)
    const aceNote = imported.collection.notes.find((n) => n.guid === 'bub-card-fr-hearts-A');
    expect(aceNote).toBeDefined();

    // In Anki wird Feld 4 (Name) editiert
    const modifiedNote = {
      ...aceNote!,
      fields: [...aceNote!.fields],
    };
    modifiedNote.fields[4] = 'Meister-Herz-Ass';

    // 5. Mit dynamischem runtimeFields.SpielHinweis rendern
    const rendered = renderCardSide(imported.collection, modifiedNote, 0, 'front', {
      runtimeFields: {
        SpielHinweis: 'Dynamischer Stich-Tipp: Höchste Farbkarte im Spiel!',
      },
    });

    // Prüfungen: Keine Fehler, geänderter Name gerendert, dynamischer Hinweis gerendert
    expect(rendered.errors).toEqual([]);
    expect(rendered.html).toContain('Meister-Herz-Ass');
    expect(rendered.html).toContain('Dynamischer Stich-Tipp: Höchste Farbkarte im Spiel!');
    // Standard-Beschreibung soll nicht erscheinen, da SpielHinweis aktiv ist
    expect(rendered.html).not.toContain('Höchste Farbkarte, zählt 11 Augen.');

    // 6. Gegenprobe ohne SpielHinweis: Standard-Beschreibung greift wieder
    const renderedFallback = renderCardSide(imported.collection, modifiedNote, 0, 'front');
    expect(renderedFallback.errors).toEqual([]);
    expect(renderedFallback.html).toContain('Meister-Herz-Ass');
    expect(renderedFallback.html).not.toContain('Dynamischer Stich-Tipp');
    expect(renderedFallback.html).toContain('Höchste Farbkarte, zählt 11 Augen.');
  });
});
