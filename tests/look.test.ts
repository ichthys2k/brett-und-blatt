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
