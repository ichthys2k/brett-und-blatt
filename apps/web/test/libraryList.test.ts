import type { GameInfo } from '@brett-und-blatt/engine';
import { describe, expect, it } from 'vitest';
import { libraryGames } from '../src/lib/gameCatalog';

const game = (id: string, min: number, max: number, name = id): GameInfo =>
  ({ id, name, description: '', emoji: '🎲', players: { min, max }, modes: ['solo'], patterns: ['open'], hiddenInformation: false, ruleVersion: 1, howToPlay: [] }) as GameInfo;

const all = [game('chess', 2, 2, 'Schach'), game('go', 2, 2, 'Go'), game('skat', 3, 4, 'Skat'), game('uno', 2, 10, 'Eins!'), game('bingo', 1, 30, 'Bingo')];

describe('Bibliothek der Konsole (#616)', () => {
  it('ohne Auswahl alle Spiele nach Rubriken, Lieblingsspiele vorn, ohne Doppelte', () => {
    const list = libraryGames({ all, favorites: ['uno', 'go'], filter: 'all', players: null, query: '' }).map((g) => g.id);
    expect(list).toEqual(['uno', 'go', 'chess', 'skat', 'bingo']);
  });

  it('Rubrik und Spielerzahl grenzen ein', () => {
    expect(libraryGames({ all, favorites: [], filter: 'cards', players: null, query: '' }).map((g) => g.id)).toEqual(['skat', 'uno']);
    expect(libraryGames({ all, favorites: [], filter: 'all', players: 8, query: '' }).map((g) => g.id)).toEqual(['uno', 'bingo']);
    expect(libraryGames({ all, favorites: [], filter: 'cards', players: 8, query: '' }).map((g) => g.id)).toEqual(['uno']);
  });

  it('Suche schlägt die Rubrik, die Spielerzahl gilt weiter', () => {
    expect(libraryGames({ all, favorites: [], filter: 'board', players: null, query: 'skat' }).map((g) => g.id)).toEqual(['skat']);
    expect(libraryGames({ all, favorites: [], filter: 'all', players: 2, query: 'skat' })).toEqual([]);
  });

  it('Lieblingsspiele außerhalb der Auswahl erscheinen nicht', () => {
    expect(libraryGames({ all, favorites: ['chess'], filter: 'cards', players: null, query: '' }).map((g) => g.id)).toEqual(['skat', 'uno']);
  });
});
