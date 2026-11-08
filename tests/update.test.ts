import { describe, expect, it } from 'vitest';
import { isTableRoute } from '../apps/web/src/lib/tableRoute';

describe('Aktualisierung (#175)', () => {
  it('erkennt Routen, in denen eine Partie läuft', () => {
    for (const hash of ['#/partie', '#/raum/ABCD', '#/tisch/ABCD', '#/turnier/XYZ?helfer=1']) expect(isTableRoute(hash)).toBe(true);
  });
  it('lässt Menüs und Einstellungen zum Neuladen frei', () => {
    for (const hash of ['', '#/', '#/ton', '#/online', '#/neu/skat', '#/pass', '#/impressum', '#/partiebuch']) expect(isTableRoute(hash)).toBe(false);
  });
});
