/*
 * Gemalte Kartenrücken (#314): Dateien in `packages/ui/src/cards/backs/` passen zu den erlaubten ids,
 * haben 500 × 700 px und höchstens 70 KB; der Katalog bietet genau die Rücken an, deren Bild da ist.
 * Die Punktsymmetrie entsteht beim Zusammenbau aus einem Viertel und wird dort mit
 * `magick compare -metric AE` geprüft (hier gibt es keinen WebP-Decoder).
 */
import { describe, expect, it } from 'vitest';
import { PAINTED_CARD_BACK_IDS, paintedCardBackFile, paintedCardBackUrl } from '../packages/ui/src/cards/paintedBacks';
import { CARD_BACK_CATALOG, PAINTED_CARD_BACK_CATALOG, type CardBackUnlockState } from '../apps/web/src/lib/cardBacks';
import type { Book } from '../apps/web/src/lib/partiebuch';

type Fs = { readdirSync(path: URL): string[]; readFileSync(path: URL): Uint8Array };
const fs = (globalThis as unknown as { process: { getBuiltinModule(name: 'node:fs'): Fs } }).process.getBuiltinModule('node:fs');
const dir = new URL('../packages/ui/src/cards/backs/', import.meta.url);
const files = fs.readdirSync(dir).filter((name) => name.endsWith('.webp'));

/** Breite und Höhe aus dem Kopf einer WebP-Datei (VP8, VP8L oder VP8X). */
function webpSize(bytes: Uint8Array): [number, number] {
  const tag = String.fromCharCode(...bytes.slice(12, 16));
  const u16 = (i: number) => bytes[i]! | (bytes[i + 1]! << 8);
  const u24 = (i: number) => u16(i) | (bytes[i + 2]! << 16);
  if (tag === 'VP8X') return [u24(24) + 1, u24(27) + 1];
  if (tag === 'VP8L') {
    const bits = bytes[21]! | (bytes[22]! << 8) | (bytes[23]! << 16) | (bytes[24]! << 24);
    return [(bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1];
  }
  if (tag === 'VP8 ') return [u16(26) & 0x3fff, u16(28) & 0x3fff];
  throw new Error(`kein WebP: ${tag}`);
}

const book = (counts: Book['counts'] = {}): Book => ({ counts, stamps: {}, recent: [] });
const state = (patch: Partial<CardBackUnlockState> = {}): CardBackUnlockState => ({ book: book(), hasCrest: false, ...patch });

describe('Gemalte Kartenrücken (#314)', () => {
  it('nur Dateien mit erlaubtem Namen, 500 × 700 px, höchstens 70 KB', () => {
    const allowed = new Set(PAINTED_CARD_BACK_IDS.map(paintedCardBackFile));
    for (const name of files) {
      expect(allowed.has(name), name).toBe(true);
      const bytes = fs.readFileSync(new URL(name, dir));
      expect(bytes.length, name).toBeLessThanOrEqual(70 * 1024);
      expect(webpSize(bytes), name).toEqual([500, 700]);
    }
  });

  it('der Katalog bietet genau die Rücken an, deren Bild vorhanden ist', () => {
    const offered = CARD_BACK_CATALOG.map((entry) => entry.id).filter((id) => (PAINTED_CARD_BACK_IDS as readonly string[]).includes(id));
    expect(offered.sort()).toEqual(PAINTED_CARD_BACK_IDS.filter((id) => files.includes(paintedCardBackFile(id))).sort());
    for (const id of PAINTED_CARD_BACK_IDS) expect(Boolean(paintedCardBackUrl(id))).toBe(files.includes(paintedCardBackFile(id)));
    expect(PAINTED_CARD_BACK_CATALOG.map((entry) => entry.id)).toEqual([...PAINTED_CARD_BACK_IDS]);
  });

  it('Freischaltregeln aus dem Issue', () => {
    const check = (id: string, s: CardBackUnlockState) => PAINTED_CARD_BACK_CATALOG.find((entry) => entry.id === id)!.unlockCheck(s).unlocked;
    expect(check('tavern-lantern', state())).toBe(true);

    expect(check('castle-banner', state({ book: book({ d: { skat: { 'bots/easy': { played: 9, won: 0, drawn: 0, lost: 9 } } } }) }))).toBe(false);
    expect(check('castle-banner', state({ book: book({ d: { skat: { 'bots/easy': { played: 6, won: 0, drawn: 0, lost: 6 } }, uno: { 'solo/-': { played: 4, won: 0, drawn: 0, lost: 4 } } } }) }))).toBe(true);

    expect(check('library-ink', state({ learnDays: 4 }))).toBe(false);
    expect(check('library-ink', state({ learnDays: 5 }))).toBe(true);

    const one = { 'bots/easy': { played: 1, won: 0, drawn: 0, lost: 1 } };
    const family = ['ludo', 'kniffel', 'maexle'];
    expect(check('garden-rose', state({ familyGameIds: family, book: book({ d: { ludo: one, kniffel: one, skat: one } }) }))).toBe(false);
    expect(check('garden-rose', state({ familyGameIds: family, book: book({ d: { ludo: one }, e: { kniffel: one, maexle: one } }) }))).toBe(true);

    expect(check('fairground', state({ book: book({ d: { 'color-sorter': one } }) }))).toBe(false);
    expect(check('fairground', state({ book: book({ d: { 'color-sorter': { 'solo/-': { played: 1, won: 1, drawn: 0, lost: 0 } } } }) }))).toBe(true);

    expect(check('night-sky', state({ book: book({ d: { skat: one } }) }))).toBe(false);
    expect(check('night-sky', state({ book: book({ d: { skat: { 'tournament/-': { played: 1, won: 0, drawn: 0, lost: 1 } } } }) }))).toBe(true);
  });

  it('ohne Bild bleibt ein gemalter Rücken unwählbar', () => {
    for (const id of PAINTED_CARD_BACK_IDS) {
      if (files.includes(paintedCardBackFile(id))) continue;
      expect(CARD_BACK_CATALOG.some((entry) => entry.id === id)).toBe(false);
    }
  });
});
