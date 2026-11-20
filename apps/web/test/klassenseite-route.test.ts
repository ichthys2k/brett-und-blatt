import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { pageAddress, parseRoute, paths } from '../src/lib/router';

// #578: Die Klassenseite darf die Adresse nicht auf „#/klassen“ umschreiben, sonst springt useRoute auf die Übersicht.
describe('Klassenseite (#578)', () => {
  const quelle = readFileSync(new URL('../src/screens/Classes.tsx', import.meta.url), 'utf8');

  it('die Route bleibt auf der Klassenseite, solange der Hash den Code trägt', () => {
    expect(parseRoute(paths.class('ABC123'))).toEqual({ name: 'class', code: 'ABC123' });
  });

  it('ClassPage schreibt die Adresse nicht auf die Übersicht um', () => {
    expect(quelle).not.toMatch(/replaceState/);
  });

  it('die Tafel nennt die Adresse der laufenden Seite', () => {
    expect(pageAddress({ origin: 'https://spiele.lipponer.de', pathname: '/' }, paths.classes)).toBe('https://spiele.lipponer.de/#/klassen');
    expect(quelle).not.toContain('brett-und-blatt.de/klassen');
  });
});
