import { describe, expect, it } from 'vitest';
import { OPTION_CATEGORIES, parseOptionCategory } from '../src/console/optionCategories';

describe('Kategorien der Optionen (#640)', () => {
  it('liest die Kategorie aus der Adresse', () => {
    expect(parseOptionCategory('input', OPTION_CATEGORIES)).toBe('input');
    expect(parseOptionCategory(undefined, OPTION_CATEGORIES)).toBe('sound');
    expect(parseOptionCategory('unsinn', OPTION_CATEGORIES)).toBe('sound');
  });
  it('nicht verfügbare Kategorien fallen auf die erste zurück', () => {
    expect(parseOptionCategory('push', ['sound', 'music', 'app'])).toBe('sound');
  });
});
