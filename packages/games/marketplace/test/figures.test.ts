import { describe, expect, it } from 'vitest';
import { FIGURES, figureForField, JESTER_JOKES, jesterJoke } from '../src/ui/figures';

describe('marketplace: Nebenfiguren (#73)', () => {
  it('definiert alle fünf Nebenfiguren mit Namen, Titeln und Zitaten', () => {
    expect(Object.keys(FIGURES)).toEqual(['herald', 'innkeeper', 'abbot', 'king', 'jester']);
    for (const [id, fig] of Object.entries(FIGURES)) {
      expect(fig.id).toBe(id);
      expect(fig.name.length).toBeGreaterThan(0);
      expect(fig.title.length).toBeGreaterThan(0);
      expect(fig.quote.length).toBeGreaterThan(0);
    }
  });

  it('ordnet den Feldern die passenden Figuren zu', () => {
    expect(figureForField(2)?.id).toBe('herald');
    expect(figureForField(16)?.id).toBe('herald');
    expect(figureForField(24)?.id).toBe('herald');
    expect(figureForField(32)?.id).toBe('herald');

    expect(figureForField(4)?.id).toBe('abbot'); // Zehnt
    expect(figureForField(11)?.id).toBe('abbot'); // Kloster

    expect(figureForField(9)?.id).toBe('jester'); // Kerker

    expect(figureForField(20)?.id).toBe('king'); // Thronsaal
    expect(figureForField(33)?.id).toBe('king'); // Königszoll

    expect(figureForField(31)?.id).toBe('innkeeper'); // Taverne

    // Handwerksbetriebe und Ecken ohne Personen
    expect(figureForField(0)).toBeNull(); // Stadttor
    expect(figureForField(1)).toBeNull(); // Brezelstube
    expect(figureForField(18)).toBeNull(); // Jahrmarkt
  });

  it('liefert Witze des Hofnarrs', () => {
    expect(JESTER_JOKES.length).toBeGreaterThanOrEqual(4);
    expect(jesterJoke(0)).toBe(JESTER_JOKES[0]);
    expect(jesterJoke(1)).toBe(JESTER_JOKES[1]);
    expect(typeof jesterJoke()).toBe('string');
  });
});
