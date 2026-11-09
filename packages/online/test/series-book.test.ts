import { describe, expect, it } from 'vitest';
import { SERIES_KEEP_MS, SERIES_MAX_TOURNAMENTS, SeriesBook, Tournament, parseSeriesLink, parseTournamentMessage, seriesStandings, type SeriesEntry, type TournamentSettings } from '../src';

/** Serien auf dem Server (#205). */

const LEADER = 'kennung-der-leitung-01';
const clock = { now: 1_000_000 };
let counter = 0;
const deps = { now: () => clock.now, randomKey: () => `KEY${'ABCDEFGHJKLMNPQRSTUVWXYZ'[counter++ % 24]}2222` };

const entry = (code: string, names: string[], at: number, keys?: string[]): SeriesEntry => ({
  code,
  name: `Cup ${code}`,
  at,
  players: names.map((name, i) => ({ id: `p${i}`, name, ...(keys ? { key: keys[i]! } : {}) })),
  matches: [{ stage: 0, id: 'm1', slots: [{ player: 'p0' }, { player: 'p1' }], outcome: { winner: 0, draw: false } }],
  ranking: names.map((_, i) => `p${i}`),
});

function book() {
  const created = SeriesBook.create('SERUE234', 'Kickerliga', 'linear', LEADER, deps);
  if (typeof created === 'string') throw new Error(created);
  return created;
}

describe('Serie anlegen und melden', () => {
  it('braucht Namen und gültige Wertung; zeigt den Schlüssel nur der Leitung', () => {
    expect(SeriesBook.create('SERUE234', '  ', 'linear', LEADER, deps)).toMatch(/Namen/);
    expect(SeriesBook.create('SERUE234', 'X', 'elo' as never, LEADER, deps)).toMatch(/wertung/);
    const b = book();
    expect(b.view(null).link).toBeUndefined();
    expect(b.view('fremde-kennung-123456').isLeader).toBe(false);
    expect(b.view(LEADER).link).toMatch(/^SERUE234-/);
  });

  it('nimmt Meldungen nur mit dem Schlüssel an und ersetzt dasselbe Turnier', () => {
    const b = book();
    const key = b.snapshot().linkKey;
    expect(b.report('FALSCH22', entry('T1', ['Anna', 'Ben'], 10))).toMatch(/Zuordnungscode/);
    expect(b.report(key, entry('T1', ['Anna', 'Ben'], 10))).toBeNull();
    expect(b.report(key, entry('T1', ['Anna', 'Ben', 'Cem'], 10))).toBeNull();
    expect(b.view(null).tournaments).toHaveLength(1);
    expect(b.view(null).tournaments[0]!.players).toBe(3);
  });

  it('die Rangliste kommt live aus den gemeldeten Turnieren', () => {
    const b = book();
    const key = b.snapshot().linkKey;
    b.report(key, entry('T1', ['Anna', 'Ben'], 10));
    b.report(key, entry('T2', ['ben', 'Anna'], 20));
    const rows = b.view(null).standings;
    // Gleiche Namen ohne Groß-/Kleinschreibung zählen zusammen; beide haben einen Sieg und eine Niederlage.
    expect(rows.map((r) => [r.name.toLowerCase(), r.points, r.tournaments]).sort()).toEqual([
      ['anna', 3, 2],
      ['ben', 3, 2],
    ]);
  });

  it('begrenzt die Zahl der Turniere', () => {
    const b = book();
    const key = b.snapshot().linkKey;
    for (let i = 0; i < SERIES_MAX_TOURNAMENTS; i++) expect(b.report(key, entry(`T${i}`, ['A', 'B'], i))).toBeNull();
    expect(b.report(key, entry('ZUVIEL', ['A', 'B'], 99))).toMatch(/höchstens/);
  });
});

describe('Erkennung über Kennungen', () => {
  it('dieselbe Kennung ist dieselbe Person, auch bei anderem Namen; gleicher Name mit anderer Kennung nicht', () => {
    const rows = seriesStandings([entry('T1', ['Anna', 'Ben'], 1, ['aaaaaaaaaaaaaaaa', 'bbbbbbbbbbbbbbbb']), entry('T2', ['Annika', 'Ben'], 2, ['aaaaaaaaaaaaaaaa', 'cccccccccccccccc'])], 'linear');
    expect(rows).toHaveLength(3);
    expect(rows.find((r) => r.name === 'Annika')?.tournaments).toBe(2);
    expect(rows.filter((r) => r.name === 'Ben')).toHaveLength(2);
  });
});

describe('Verwalten', () => {
  it('nur die Leitung benennt um, wechselt die Wertung, nimmt Turniere heraus und erneuert den Schlüssel', () => {
    const b = book();
    const key = b.snapshot().linkKey;
    b.report(key, entry('T1', ['A', 'B'], 1));
    const other = 'fremde-kennung-123456';
    expect(b.rename(other, 'Neu')).toMatch(/Leitung/);
    expect(b.setScheme(other, 'f1')).toMatch(/Leitung/);
    expect(b.remove(other, 'T1')).toMatch(/Leitung/);
    expect(b.newKey(other)).toMatch(/Leitung/);
    expect(b.rename(LEADER, 'Neue Liga')).toBeNull();
    expect(b.setScheme(LEADER, 'f1')).toBeNull();
    expect(b.view(null)).toMatchObject({ name: 'Neue Liga', scheme: 'f1' });
    expect(b.remove(LEADER, 'NIX')).toMatch(/nicht zur Serie/);
    expect(b.remove(LEADER, 'T1')).toBeNull();
    expect(b.view(null).tournaments).toHaveLength(0);
    expect(b.newKey(LEADER)).toBeNull();
    expect(b.accepts(key)).toBe(false);
  });

  it('läuft ein Jahr nach der letzten Aktivität ab, Verlängern verschiebt es', () => {
    clock.now = 5_000_000;
    const b = book();
    expect(b.expiresAt()).toBe(5_000_000 + SERIES_KEEP_MS);
    clock.now += SERIES_KEEP_MS / 2;
    expect(b.extend(LEADER)).toBeNull();
    expect(b.expiresAt()).toBe(clock.now + SERIES_KEEP_MS);
  });
});

describe('Zuordnungscode', () => {
  it('wird gelesen, egal ob mit Strich, Leerzeichen oder Kleinbuchstaben', () => {
    expect(parseSeriesLink('serue234-key22222')).toEqual({ code: 'SERUE234', key: 'KEY22222' });
    expect(parseSeriesLink('SERUE234 KEY22222')).toEqual({ code: 'SERUE234', key: 'KEY22222' });
    expect(parseSeriesLink('SERUE234KEY22222')).toEqual({ code: 'SERUE234', key: 'KEY22222' });
    expect(parseSeriesLink('zu kurz')).toBeNull();
    expect(parseSeriesLink('SERUE234-KEY0OIL1')).toBeNull();
  });
});

describe('Turnier und Serie', () => {
  const tdeps = { now: () => clock.now, randomClaim: () => 'NEUCODE1' };
  const settings: TournamentSettings = { name: 'Cup', gameId: 'chess', format: 'knockout', time: 'normal', days: 3, thirdPlace: false };
  const token = (i: number) => `kennung-spieler-${String(i).padStart(4, '0')}`;

  it('nur die Hauptleitung ordnet zu; der Schlüssel steht nie in der Sicht', () => {
    const t = Tournament.create('ABCD2345', 'seed-1', settings, { token: LEADER, name: 'L' }, tdeps);
    expect(t.attachSeries(token(0), 'SERUE234', 'KEY22222')).toMatch(/Hauptleitung/);
    expect(t.attachSeries(LEADER, 'SERUE234', 'KEY22222')).toBeNull();
    const view = t.view(LEADER);
    expect(view.series).toBe('SERUE234');
    expect(JSON.stringify(view)).not.toContain('KEY22222');
    expect(t.detachSeries(token(0))).toMatch(/Hauptleitung/);
    expect(t.detachSeries(LEADER)).toBeNull();
    expect(t.view(LEADER).series).toBeNull();
  });

  it('meldet erst nach dem Ende und nur einmal', () => {
    const t = Tournament.create('ABCD2345', 'seed-1', settings, { token: LEADER, name: 'L' }, tdeps);
    for (let i = 0; i < 4; i++) t.join(token(i), `Spieler${i}`, '🦊');
    t.attachSeries(LEADER, 'SERUE234', 'KEY22222');
    expect(t.seriesDue()).toBe(false);
    expect(t.seriesSource()).toBeNull();
    expect(t.start(LEADER)).toBeNull();
    expect(t.view(LEADER).phase).toBe('running');
  });

  it('ein beendetes Turnier liefert sein Ergebnis für die Serie', () => {
    const local: TournamentSettings = { name: 'Abend', gameId: '', format: 'knockout', time: 'normal', days: 1, thirdPlace: false, mode: 'local', sport: 'Darts', result: 'winner' };
    const t = Tournament.create('ABCD2345', 'seed-1', local, { token: LEADER, name: 'L' }, tdeps);
    t.addEntrants(LEADER, ['Anna', 'Ben', 'Cem', 'Dina']);
    t.attachSeries(LEADER, 'SERUE234', 'KEY22222');
    expect(t.start(LEADER)).toBeNull();
    for (let round = 0; round < 6 && t.view(LEADER).phase !== 'finished'; round++) {
      for (const m of t.view(LEADER).matches.filter((x) => !x.outcome && x.slots.every((s) => s.player))) expect(t.enterResult(LEADER, m.id, { winner: 0 })).toBeNull();
    }
    expect(t.view(LEADER).phase).toBe('finished');
    expect(t.seriesDue()).toBe(true);
    const source = t.seriesSource()!;
    expect(source.entry).toMatchObject({ code: 'ABCD2345', name: 'Abend' });
    expect(source.entry.ranking).toHaveLength(4);
    expect(source.entry.players.map((p) => p.name).sort()).toEqual(['Anna', 'Ben', 'Cem', 'Dina']);
    t.markSeriesReported();
    expect(t.seriesDue()).toBe(false);
  });

  it('Nachrichten werden gelesen', () => {
    expect(parseTournamentMessage(JSON.stringify({ type: 'attachSeries', link: 'SERUE234-KEY22222' }))).toEqual({ type: 'attachSeries', link: 'SERUE234-KEY22222' });
    expect(parseTournamentMessage(JSON.stringify({ type: 'attachSeries' }))).toBeNull();
    expect(parseTournamentMessage(JSON.stringify({ type: 'detachSeries' }))).toEqual({ type: 'detachSeries' });
  });
});
