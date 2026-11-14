/**
 * Quartett „Geometrie & Körper“ (#319): Die Zeichnungen aus `scripts/grafik/geometrie-svg.mjs`
 * zeigen genau so viele Ecken und Kanten, wie die Karte nennt.
 */
import { describe, expect, it } from 'vitest';
import geometrie from '../content/quartett/geometrie.json';
import { ankiToQuartettSet, quartettSetToAnki } from '../packages/engine/src';

// Ohne Node-Typen im Browser-tsconfig: Dateizugriff wie in tests/grafik.test.ts.
const fs = (globalThis as unknown as { process: { getBuiltinModule(name: 'node:fs'): { readFileSync(path: URL, encoding: 'utf8'): string } } }).process.getBuiltinModule('node:fs');
const count = (svg: string, attr: string) => new Set([...svg.matchAll(new RegExp(`${attr}="(\\d+)"`, 'g'))].map((m) => m[1])).size;

describe('Quartett: Geometrie-Zeichnungen', () => {
  for (const card of geometrie.cards) {
    it(`${card.id} ${card.name}: Ecken und Kanten stimmen`, () => {
      const svg = fs.readFileSync(new URL(`../content/quartett/bilder/geometrie/bub-quartett-geometrie-${card.id.toLowerCase()}.svg`, import.meta.url), 'utf8');
      expect(count(svg, 'data-ecke'), 'Ecken').toBe(card.values.vertices);
      expect(count(svg, 'data-kante'), 'Kanten').toBe(card.values.edges);
      expect(svg).not.toMatch(/<script|on\w+=/i);
      expect(svg.length).toBeLessThan(45_000);
    });
  }
});

describe('Quartett: Bilder als Anki-Medien', () => {
  it('der Export nennt das Bild im Feld „Bild“, der Rückweg liest es samt Emoji', () => {
    const col = quartettSetToAnki(geometrie);
    const note = col.notes.find((n) => n.guid === 'bub-quartett-geometrie-A1')!;
    expect(note.fields[5]).toBe('<img src="bub-quartett-geometrie-a1.svg">');
    // In Anki ein anderes Bild einsetzen: Es kommt so zurück.
    note.fields[5] = '<img src="mein-quadrat.webp">';
    const back = ankiToQuartettSet(col);
    const a1 = back.cards.find((c) => c.id === 'A1')!;
    expect(a1.image).toBe('mein-quadrat.webp');
    expect(a1.emoji).toBe('🟦');
    expect(back.cards.find((c) => c.id === 'B1')!.image).toBe('bub-quartett-geometrie-b1.svg');
  });
});

