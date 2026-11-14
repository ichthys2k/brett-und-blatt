import { describe, expect, it } from 'vitest';

/** G9 (#318): Zu jedem Spielteil von Grafschaft, Marktstände und Rübenacker gibt es sein gemaltes Bild. */
type Fs = { readdirSync(path: URL): string[] };
const { readdirSync } = (globalThis as unknown as { process: { getBuiltinModule(name: 'node:fs'): Fs } }).process.getBuiltinModule('node:fs');
const dir = (path: string) => readdirSync(new URL(`../packages/games/${path}/`, import.meta.url)).sort();

describe('Gemalte Spielteile (G9, #318)', () => {
  it('Grafschaft: sechs Landschaften und zwanzig Hofaufträge', () => {
    expect(dir('grafschaft/src/ui/land')).toEqual(['field', 'forest', 'meadow', 'mountain', 'pond', 'village'].map((n) => `${n}.webp`));
    expect(dir('grafschaft/src/ui/auftraege')).toEqual(Array.from({ length: 20 }, (_, i) => `bub-grafschaft-q${i + 1}.webp`).sort());
  });

  it('Marktstände: vier Waren und vier Stände', () => {
    expect(dir('market-stalls/src/ui/waren')).toEqual(['apples', 'bread', 'cheese', 'fish'].map((n) => `bub-marktstaende-${n}.webp`));
    expect(dir('market-stalls/src/ui/staende')).toEqual([1, 2, 3, 4].map((n) => `stand-${n}.webp`));
  });

  it('Rübenacker: vier Karten und zehn Teile', () => {
    expect(dir('turnip-patch/src/ui/karten')).toEqual(['1', '2', '3', 'maulwurf'].map((n) => `bub-ruebenacker-karte-${n}.webp`));
    expect(dir('turnip-patch/src/ui/teile')).toEqual(
      ['erdhuegel', 'hase-blau', 'hase-gelb', 'hase-gruen', 'hase-lila', 'hase-rot', 'hase-tuerkis', 'maulwurf', 'ruebe', 'zaunpfahl'].map((n) => `${n}.webp`),
    );
  });
});
