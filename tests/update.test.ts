import { describe, expect, it } from 'vitest';
import { isNewerBuild, parseBuildInfo } from '../apps/web/src/lib/buildVersion';
import { isTableRoute } from '../apps/web/src/lib/tableRoute';

describe('Aktualisierung (#175)', () => {
  it('erkennt Routen, in denen eine Partie läuft', () => {
    for (const hash of ['#/partie', '#/raum/ABCD', '#/tisch/ABCD', '#/turnier/XYZ?helfer=1']) expect(isTableRoute(hash)).toBe(true);
  });
  it('lässt Menüs und Einstellungen zum Neuladen frei', () => {
    for (const hash of ['', '#/', '#/ton', '#/online', '#/neu/skat', '#/pass', '#/impressum', '#/partiebuch']) expect(isTableRoute(hash)).toBe(false);
  });
  it('meldet nur einen wirklich jüngeren Build (kein Hinweis bei gleichem oder älterem Stand)', () => {
    const own = { id: 'abc1234', time: 2000 };
    expect(isNewerBuild({ id: 'def5678', time: 3000 }, own)).toBe(true);
    expect(isNewerBuild({ id: 'abc1234', time: 2000 }, own)).toBe(false);
    expect(isNewerBuild({ id: 'old0000', time: 1000 }, own)).toBe(false);
    expect(isNewerBuild({ id: 'def5678', time: 2000 }, own)).toBe(false);
  });
  it('liest version.json streng', () => {
    expect(parseBuildInfo({ id: 'abc1234', time: 5 })).toEqual({ id: 'abc1234', time: 5 });
    for (const bad of [null, 'x', {}, { id: '', time: 1 }, { id: 'a', time: 'b' }, { id: 'a', time: Infinity }]) expect(parseBuildInfo(bad)).toBeNull();
  });
});
