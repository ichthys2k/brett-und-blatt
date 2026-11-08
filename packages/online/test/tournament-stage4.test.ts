import { describe, expect, it } from 'vitest';
import { Tournament, parseTournamentSettings, type TournamentSettings } from '../src';

/** Stufe 4 (#188): Setzliste, weitere Formen. */

const LEADER = 'kennung-der-leitung-01';
const clock = { now: 1_000_000 };
const deps = { now: () => clock.now, randomClaim: () => 'NEUCODE1' };

function local(format: TournamentSettings['format'], extra: Partial<TournamentSettings>, names: string[]) {
  const settings: TournamentSettings = { name: 'Cup', gameId: '', format, time: 'normal', days: 1, thirdPlace: false, mode: 'local', sport: 'Darts', result: 'winner', ...extra };
  const t = Tournament.create('ABCD2345', 'seed-1', settings, { token: LEADER, name: 'Leitung' }, deps);
  expect(t.addEntrants(LEADER, names)).toBeNull();
  return t;
}

const names = (n: number) => Array.from({ length: n }, (_, i) => `Spieler${i + 1}`);

describe('Setzliste', () => {
  it('nur vor Ort und nur für Formen mit Baum oder Gruppen', () => {
    const find = () => undefined;
    const base = { name: 'Abend', mode: 'local', sport: 'Darts' };
    expect(parseTournamentSettings({ ...base, format: 'knockout', seeded: true }, find)).toMatchObject({ seeded: true });
    expect(parseTournamentSettings({ ...base, format: 'world', seeded: true }, find)).toMatchObject({ seeded: true });
    expect(parseTournamentSettings({ ...base, format: 'swiss', seeded: true }, find)?.seeded).toBeUndefined();
    expect(parseTournamentSettings({ ...base, format: 'knockout' }, find)?.seeded).toBeUndefined();
  });

  it('K.-o.: Nummer 1 und 2 treffen sich erst im Finale, 1 spielt gegen die Letzte', () => {
    const t = local('knockout', { seeded: true }, names(8));
    expect(t.start(LEADER)).toBeNull();
    const view = t.view(LEADER);
    const players = new Map(view.players.map((p) => [p.id, p.name]));
    const first = view.matches.filter((m) => m.stage === 0).map((m) => m.slots.map((s) => players.get(s.player!)));
    expect(first.some((pair) => pair.includes('Spieler1') && pair.includes('Spieler8'))).toBe(true);
    expect(first.some((pair) => pair.includes('Spieler2') && pair.includes('Spieler7'))).toBe(true);
    // 1 und 2 stehen in verschiedenen Hälften des Baums: erste Partie und letzte Partie.
    const index = (n: string) => first.findIndex((pair) => pair.includes(n));
    expect(Math.floor(index('Spieler1') / 2)).not.toBe(Math.floor(index('Spieler2') / 2));
  });

  it('ohne Setzliste entscheidet das Los: Nummer 1 gegen 8 ist kein Muss', () => {
    const lots = new Set<string>();
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f']) {
      const s: TournamentSettings = { name: 'Cup', gameId: '', format: 'knockout', time: 'normal', days: 1, thirdPlace: false, mode: 'local', sport: 'Darts', result: 'winner' };
      const t = Tournament.create('ABCD2345', seed, s, { token: LEADER, name: 'L' }, deps);
      t.addEntrants(LEADER, names(8));
      t.start(LEADER);
      lots.add(JSON.stringify(t.view(LEADER).matches.filter((m) => m.stage === 0).map((m) => m.slots.map((x) => x.player))));
    }
    expect(lots.size).toBeGreaterThan(1);
  });

  it('WM-Form: die Gesetzten verteilen sich auf die Gruppen', () => {
    const t = local('world', { seeded: true, groupCount: 4 }, names(16));
    expect(t.start(LEADER)).toBeNull();
    const view = t.view(LEADER);
    const names1 = new Map(view.players.map((p) => [p.id, p.name]));
    const top4 = ['Spieler1', 'Spieler2', 'Spieler3', 'Spieler4'];
    const groupsOfTop = view.groups.map((g) => g.players.map((id) => names1.get(id)!).filter((n) => top4.includes(n)).length);
    expect(groupsOfTop).toEqual([1, 1, 1, 1]);
  });
});

describe('Last One Standing', () => {
  const find = () => undefined;
  const base = { name: 'Abend', mode: 'local', sport: 'Darts', format: 'lives' };

  it('Leben nur 1 bis 5', () => {
    expect(parseTournamentSettings({ ...base, lives: 3 }, find)).toMatchObject({ format: 'lives', lives: 3 });
    expect(parseTournamentSettings({ ...base, lives: 9 }, find)?.lives).toBeUndefined();
    expect(parseTournamentSettings({ ...base, format: 'swiss', lives: 3 }, find)?.lives).toBeUndefined();
  });

  /** Spielt jede offene Partie: der Spieler mit der kleineren Nummer gewinnt. */
  function playAll(t: Tournament) {
    for (let guard = 0; guard < 50; guard++) {
      const view = t.view(LEADER);
      if (view.phase === 'finished') return;
      const open = view.matches.filter((m) => m.status !== 'done' && m.status !== 'waiting' && m.slots[0].player && m.slots[1].player);
      if (open.length === 0) return;
      const number = (id: string | null) => Number(view.players.find((p) => p.id === id)!.name.replace('Spieler', ''));
      for (const m of open) {
        const winner = number(m.slots[0].player) < number(m.slots[1].player) ? 0 : 1;
        expect(t.enterResult(LEADER, m.id, { winner })).toBeNull();
      }
    }
  }

  it('wer verliert, verliert ein Leben; der Letzte gewinnt, ausgeschieden wird nach Leben', () => {
    const t = local('lives', { lives: 2 }, names(5));
    expect(t.start(LEADER)).toBeNull();
    playAll(t);
    const view = t.view(LEADER);
    expect(view.phase).toBe('finished');
    const byName = (id: string) => view.players.find((p) => p.id === id)!.name;
    // Spieler1 gewinnt immer und bleibt bei vollen Leben; die Tabelle führt ihn an.
    expect(byName(view.podium[0]!)).toBe('Spieler1');
    expect(view.table[0]).toMatchObject({ lives: 2 });
    expect(view.table.slice(1).every((row) => row.lives === 0)).toBe(true);
    // Nach der Tabelle: wer zuletzt ausschied, steht vor denen, die früher ausschieden.
    expect(byName(view.podium[1]!)).toBe('Spieler2');
  });

  it('kein Remis: das Formular verlangt einen Sieger', () => {
    const t = local('lives', { draws: true }, names(4));
    t.start(LEADER);
    const m = t.view(LEADER).matches.find((x) => x.status !== 'done' && x.slots[0].player && x.slots[1].player)!;
    expect(t.enterResult(LEADER, m.id, { winner: 'draw' })).toBeTruthy();
  });

  it('ungerade Zahl: ein Freilos kostet kein Leben', () => {
    const t = local('lives', { lives: 1 }, names(5));
    t.start(LEADER);
    const view = t.view(LEADER);
    const bye = view.matches.find((m) => m.outcome?.bye);
    expect(bye).toBeTruthy();
    const row = view.table.find((r) => r.player === bye!.slots[0].player)!;
    expect(row.lives).toBe(1);
  });
});
