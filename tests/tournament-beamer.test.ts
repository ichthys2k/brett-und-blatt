import { describe, expect, it } from 'vitest';
import { parseRoute, paths } from '../apps/web/src/lib/router';

describe('Turnier-Bildschirm (#212)', () => {
  it('Pfad und Route passen zusammen', () => {
    expect(paths.tournamentBeamer('LOKAL-ABC234')).toBe('#/turnier/LOKAL-ABC234/beamer');
    expect(parseRoute(paths.tournamentBeamer('LOKAL-ABC234'))).toEqual({ name: 'tournamentBeamer', code: 'LOKAL-ABC234' });
  });
  it('die Einbettungsansicht bleibt eigene Route', () => {
    expect(parseRoute(paths.tournamentEmbed('X'))).toEqual({ name: 'tournamentEmbed', code: 'X' });
  });
});
