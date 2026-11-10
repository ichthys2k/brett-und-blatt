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

describe('Verein oder Schule (#229)', () => {
  it('Pfade und Routen passen zusammen', () => {
    expect(parseRoute(paths.orgs)).toEqual({ name: 'orgs' });
    expect(parseRoute(`${paths.org('🦊🦊🦊🦊🦊🦊')}?einladung=ABCD2345`)).toEqual({ name: 'org', code: '🦊🦊🦊🦊🦊🦊', invite: 'ABCD2345' });
    expect(parseRoute(paths.org('🦊🦊🦊🦊🦊🦊'))).toEqual({ name: 'org', code: '🦊🦊🦊🦊🦊🦊' });
  });
});
