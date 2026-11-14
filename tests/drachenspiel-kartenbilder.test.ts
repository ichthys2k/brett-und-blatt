/*
 * Kartenbilder des Drachenspiels (#309): Dateien gehören zu Karten, und ein Bild übersteht den
 * Weg nach Anki und zurück, ohne Emoji und Werte zu verlieren.
 */
import { describe, expect, it } from 'vitest';
import { ankiToDrachenspielCards, drachenspielCardsToAnki, parseCustomCardCatalog } from '../packages/engine/src';
import { CARDS_DB } from '../packages/games/drachenspiel/src/cards';
import { CARD_ART_MEDIA, cardArtFile, cardArtOf, withCardArt } from '../packages/games/drachenspiel/src/ui/cardArt';

type Fs = { readdirSync(path: URL): string[]; statSync(path: URL): { size: number } };
const fs = (globalThis as unknown as { process: { getBuiltinModule(name: 'node:fs'): Fs } }).process.getBuiltinModule('node:fs');
const dir = new URL('../packages/games/drachenspiel/src/ui/karten/', import.meta.url);

describe('Kartenbilder Drachenspiel (#309)', () => {
  it('jede Datei gehört zu einer Karte und ist klein genug', () => {
    const files = fs.readdirSync(dir).filter((name) => name.endsWith('.webp'));
    const known = new Set(Object.keys(CARDS_DB).map(cardArtFile));
    for (const name of files) {
      expect(known.has(name), name).toBe(true);
      expect(fs.statSync(new URL(name, dir)).size, name).toBeLessThanOrEqual(120 * 1024);
    }
    expect(Object.keys(CARD_ART_MEDIA).sort()).toEqual(files.sort());
  });

  it('ohne Bild bleibt die Karte beim Emoji', () => {
    const id = Object.keys(CARDS_DB).find((cardId) => !cardArtOf(cardId));
    if (!id) return;
    const note = drachenspielCardsToAnki([CARDS_DB[id]!]).notes[0]!;
    expect(note.fields[12]).toBe(CARDS_DB[id]!.emoji);
    expect(withCardArt({ a: 'b' })).toEqual(Object.keys(CARD_ART_MEDIA).length ? { ...CARD_ART_MEDIA, a: 'b' } : { a: 'b' });
  });

  it('ein Bild reist als Medium nach Anki und zurück', () => {
    const card = Object.values(CARDS_DB).find((c) => !c.isSpell)!;
    const col = drachenspielCardsToAnki([{ ...card, image: cardArtFile(card.id) }]);
    expect(col.notes[0]!.fields[12]).toBe(`<img src="${cardArtFile(card.id)}">`);
    const [back] = ankiToDrachenspielCards(col);
    expect(back!.image).toBe(cardArtFile(card.id));
    expect(back!.emoji).toBe(card.emoji);
    // Als Kartenset gelesen: Werte bleiben, das Emoji wird nicht zum <img>-Text.
    const catalog = parseCustomCardCatalog(col);
    expect(catalog.combatCards[card.id]?.emoji).toBe(card.emoji);
    expect(catalog.combatCards[card.id]?.attack).toBe(card.attack);
  });
});
