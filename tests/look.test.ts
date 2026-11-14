import { describe, expect, it } from 'vitest';

// CSS liefert Vitest leer aus (auch mit `?raw`), deshalb direkt von der Platte lesen.
const fs = (globalThis as unknown as { process: { getBuiltinModule(name: 'node:fs'): { readFileSync(path: URL, encoding: 'utf8'): string } } }).process.getBuiltinModule('node:fs');
const css = fs.readFileSync(new URL('../apps/web/src/look.css', import.meta.url), 'utf8');
const blocks = [...css.matchAll(/:root\[data-look='tavern'\]\s*\{([^}]*)\}/g)].map((match) => Object.fromEntries([...match[1]!.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/g)].map((entry) => [entry[1]!, entry[2]!])));

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((start) => {
    const channel = Number.parseInt(hex.slice(start, start + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light! + 0.05) / (dark! + 0.05);
}

/** Vorder- und Hintergründe, die in der Oberfläche zusammen vorkommen. */
const PAIRS = [
  ['color-ink', 'color-bg'],
  ['color-ink', 'color-surface'],
  ['color-ink', 'color-surface-2'],
  ['color-muted', 'color-bg'],
  ['color-muted', 'color-surface'],
  ['color-muted', 'color-surface-2'],
  ['color-accent', 'color-bg'],
  ['color-accent', 'color-surface'],
  ['color-accent-ink', 'color-accent'],
  ['color-warning', 'color-surface'],
  ['color-danger', 'color-surface'],
  ['tavern-sign-ink', 'tavern-wood'],
  ['tavern-sign-ink', 'tavern-wood-dark'],
  ...['board', 'cards', 'family', 'math', 'oak', 'walnut', 'green-felt', 'red-felt', 'slate', 'marble'].flatMap(
    (room) => [['color-ink', `tavern-table-${room}`], ['color-muted', `tavern-table-${room}`]] as const,
  ),
] as const;

describe('Aussehen Taverne: Kontraste nach WCAG AA', () => {
  it('hat einen hellen und einen dunklen Token-Block', () => {
    expect(blocks).toHaveLength(2);
  });

  for (const [index, name] of ['hell', 'dunkel'].entries()) {
    for (const [fore, back] of PAIRS) {
      it(`${name}: ${fore} auf ${back} erreicht 4,5:1`, () => {
        expect(contrast(blocks[index]![fore]!, blocks[index]![back]!)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});

/**
 * Gemessene dunkelste und hellste Stellen der übernommenen Tischtexturen (#313).
 * Garantiert, dass Schrift überall auf der gemalten Fläche WCAG AA (≥ 4,5:1) erreicht.
 */
const TEXTURE_EXTREMES: Record<string, { theme: 'hell' | 'dunkel'; min: string; max: string }> = {
  'oak-light': { theme: 'hell', min: '#c3a977', max: '#f1d9a8' },
  'walnut-light': { theme: 'hell', min: '#cfb18b', max: '#dfc39d' },
  'green-felt-light': { theme: 'hell', min: '#b4c1a6', max: '#c0ceae' },
  'oak-dark': { theme: 'dunkel', min: '#261609', max: '#352818' },
  'walnut-dark': { theme: 'dunkel', min: '#19100f', max: '#34251d' },
  'green-felt-dark': { theme: 'dunkel', min: '#0d2818', max: '#0f2b1b' },
  'red-felt-light': { theme: 'hell', min: '#d9aea8', max: '#e0c2b7' },
  'red-felt-dark': { theme: 'dunkel', min: '#1a0707', max: '#210e12' },
  'slate-light': { theme: 'hell', min: '#b2b7b8', max: '#dadedf' },
  'slate-dark': { theme: 'dunkel', min: '#111516', max: '#3c3e40' },
  'marble-light': { theme: 'hell', min: '#dfdcd2', max: '#faf9f0' },
  'marble-dark': { theme: 'dunkel', min: '#151611', max: '#343530' },
};

describe('Tischtexturen: Kontraste an dunkelster und hellster Stelle (#313)', () => {
  for (const [name, info] of Object.entries(TEXTURE_EXTREMES)) {
    const block = info.theme === 'hell' ? blocks[0]! : blocks[1]!;
    it(`${name}: color-ink auf dunkelster Stelle (${info.min}) erreicht mindestens 4,5:1`, () => {
      expect(contrast(block['color-ink']!, info.min)).toBeGreaterThanOrEqual(4.5);
    });
    it(`${name}: color-ink auf hellster Stelle (${info.max}) erreicht mindestens 4,5:1`, () => {
      expect(contrast(block['color-ink']!, info.max)).toBeGreaterThanOrEqual(4.5);
    });
  }
});

