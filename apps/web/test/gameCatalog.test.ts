import type { GameInfo } from '@brett-und-blatt/engine';
import { describe, expect, it } from 'vitest';
import { fitsPlayers, groupGames, parseFilter, searchGames, visibleGroups } from '../src/lib/gameCatalog';
import { mathPresetsFor } from '../src/lib/mathPresets';
import { CATEGORIES } from '../src/lib/rubriken';

function game(id: string, min: number, max: number, extra: Partial<GameInfo> = {}): GameInfo {
  return {
    id,
    name: extra.name ?? id,
    description: extra.description ?? '',
    emoji: '🎲',
    players: { min, max },
    modes: ['solo'],
    patterns: ['open'],
    hiddenInformation: false,
    ruleVersion: 1,
    howToPlay: extra.howToPlay ?? [],
  } as GameInfo;
}

const all = [
  game('chess', 2, 2, { name: 'Schach', description: 'Klassiker auf 64 Feldern' }),
  game('skat', 3, 4, { name: 'Skat', howToPlay: ['Reizen und Stiche zählen'] }),
  game('bingo', 1, 30, { name: 'Bingo' }),
  game('duck-rally', 1, 4, { name: 'Enten-Rallye' }),
  game('unbekannt', 2, 6, { name: 'Neues Spiel' }),
];

describe('Spielkatalog (#610)', () => {
  it('fitsPlayers prüft die Grenzen', () => {
    expect(fitsPlayers(all[1]!, null)).toBe(true);
    expect(fitsPlayers(all[1]!, 3)).toBe(true);
    expect(fitsPlayers(all[1]!, 4)).toBe(true);
    expect(fitsPlayers(all[1]!, 2)).toBe(false);
    expect(fitsPlayers(all[1]!, 5)).toBe(false);
  });

  it('groupGames ordnet wie CATEGORIES, Unbekanntes in die Familie', () => {
    const groups = groupGames(all, null);
    expect(groups.map((g) => g.id)).toEqual(CATEGORIES.map((c) => c.id));
    expect(groups.find((g) => g.id === 'board')!.games.map((g) => g.id)).toEqual(['chess']);
    expect(groups.find((g) => g.id === 'family')!.games.map((g) => g.id)).toEqual(['bingo', 'unbekannt']);
    expect(groups.find((g) => g.id === 'math')!.games.map((g) => g.id)).toEqual(['duck-rally']);
  });

  it('groupGames filtert nach Spielerzahl', () => {
    const groups = groupGames(all, 8);
    expect(groups.find((g) => g.id === 'board')!.games).toEqual([]);
    expect(groups.find((g) => g.id === 'family')!.games.map((g) => g.id)).toEqual(['bingo']);
  });

  it('searchGames findet über Name, Beschreibung, id und Anleitung', () => {
    expect(searchGames(all, '', null)).toBeNull();
    expect(searchGames(all, '   ', null)).toBeNull();
    expect(searchGames(all, 'SCHACH', null)!.map((g) => g.id)).toEqual(['chess']);
    expect(searchGames(all, '64 feldern', null)!.map((g) => g.id)).toEqual(['chess']);
    expect(searchGames(all, 'duck', null)!.map((g) => g.id)).toEqual(['duck-rally']);
    expect(searchGames(all, 'reizen', null)!.map((g) => g.id)).toEqual(['skat']);
    expect(searchGames(all, 'reizen', 2)).toEqual([]);
  });

  it('visibleGroups: Filter und leere Rubriken nur mit Spielerzahl weg', () => {
    const groups = groupGames(all, null);
    expect(visibleGroups(groups, 'all', null)).toHaveLength(4);
    expect(visibleGroups(groups, 'cards', null).map((g) => g.id)).toEqual(['cards']);
    const eight = groupGames(all, 8);
    expect(visibleGroups(eight, 'all', 8).map((g) => g.id)).toEqual(['family']);
    expect(visibleGroups(eight, 'board', 8)).toEqual([]);
  });

  it('parseFilter', () => {
    expect(parseFilter(undefined)).toBe('all');
    expect(parseFilter('cards')).toBe('cards');
    expect(parseFilter('mathe')).toBe('math');
    expect(parseFilter('unsinn')).toBe('all');
  });

  it('mathPresetsFor lässt Voreinstellungen weg, deren Spiel nicht passt', () => {
    const presets = mathPresetsFor(all, 8);
    expect(presets.some((p) => p.gameId === 'bingo')).toBe(true);
    // Schiffe versenken ist hier unbekannt und bleibt drin; Bingo passt zu acht.
    expect(presets.some((p) => p.gameId === 'battleship')).toBe(true);
    const withChess = mathPresetsFor([...all, game('pairs', 1, 6)], 8);
    expect(withChess.some((p) => p.gameId === 'pairs')).toBe(false);
  });
});
