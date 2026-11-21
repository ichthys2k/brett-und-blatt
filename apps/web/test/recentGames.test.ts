import { describe, expect, it } from 'vitest';
import { recentGameIds } from '../src/console/recentGames';

describe('Zuletzt gespielt (#615)', () => {
  const known = new Set(['chess', 'skat', 'uno', 'go']);
  it('neueste zuerst, ohne Doppelte, ohne Unbekannte, mit Grenze', () => {
    const recent = [
      { gameId: 'skat', endedAt: 5 },
      { gameId: 'chess', endedAt: 9 },
      { gameId: 'weg', endedAt: 10 },
      { gameId: 'skat', endedAt: 8 },
      { gameId: 'uno', endedAt: 1 },
      { gameId: 'go', endedAt: 3 },
    ];
    expect(recentGameIds(recent, known)).toEqual(['chess', 'skat', 'go', 'uno']);
    expect(recentGameIds(recent, known, 2)).toEqual(['chess', 'skat']);
    expect(recentGameIds([], known)).toEqual([]);
  });
});
