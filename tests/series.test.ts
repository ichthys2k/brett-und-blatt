import { describe, expect, it } from 'vitest';
import { placePoints, seriesCsv, seriesStandings, type SeriesTournament } from '../apps/web/src/lib/series';

const tournament = (name: string, players: string[], ranking: number[], matches: [number, number, 0 | 1 | null][] = []): SeriesTournament => ({
  name,
  players: players.map((n, i) => ({ id: `p${i}`, name: n })),
  ranking: ranking.map((i) => `p${i}`),
  matches: matches.map(([a, b, winner], i) => ({ stage: i, id: `m${i}`, slots: [{ player: `p${a}` }, { player: `p${b}` }], outcome: { winner, draw: winner === null } })),
});

describe('Serien', () => {
  it('Punkte nach Platz: linear und wie in der Formel 1', () => {
    expect(placePoints('linear', 1, 8)).toBe(8);
    expect(placePoints('linear', 8, 8)).toBe(1);
    expect(placePoints('f1', 1, 8)).toBe(25);
    expect(placePoints('f1', 3, 8)).toBe(15);
    expect(placePoints('f1', 11, 20)).toBe(0);
  });

  it('gemeinsame Rangliste: gleiche Namen (ohne Groß-/Kleinschreibung) werden zusammengezählt', () => {
    const rows = seriesStandings(
      [tournament('Mai', ['Anna', 'Ben', 'Cara'], [1, 0, 2]), tournament('Juni', ['ben', 'ANNA', 'Dora'], [1, 0, 2])],
      'linear',
    );
    expect(rows.map((r) => [r.name, r.points, r.tournaments])).toEqual([
      ['Anna', 5, 2],
      ['Ben', 5, 2],
      ['Cara', 1, 1],
      ['Dora', 1, 1],
    ]);
    const anna = rows.find((r) => r.name === 'Anna')!;
    expect(anna.best).toBe(1);
  });

  it('Elo: Wer gewinnt, steigt; die Summe bleibt gleich', () => {
    const rows = seriesStandings([tournament('Cup', ['A', 'B'], [0, 1], [[0, 1, 0], [0, 1, 0]])], 'linear');
    const [a, b] = [rows.find((r) => r.name === 'A')!, rows.find((r) => r.name === 'B')!];
    expect(a.elo).toBeGreaterThan(1000);
    expect(b.elo).toBeLessThan(1000);
    expect(a.elo + b.elo).toBeGreaterThanOrEqual(1999);
    expect(a.elo + b.elo).toBeLessThanOrEqual(2001);
  });

  it('Freilose und Zurückgezogene ohne Platz zählen nicht; CSV', () => {
    const t = tournament('Cup', ['A', 'B', 'C'], [0, 1]);
    t.matches.push({ stage: 5, id: 'bye', slots: [{ player: 'p2' }, { player: null }], outcome: { winner: 0, draw: false, bye: true } });
    const rows = seriesStandings([t], 'linear');
    expect(rows.find((r) => r.name === 'C')?.elo ?? 1000).toBe(1000);
    expect(seriesCsv(rows).split('\n')[0]).toBe('Rang;Name;Turniere;Punkte;Beste Platzierung;Elo');
  });
});
