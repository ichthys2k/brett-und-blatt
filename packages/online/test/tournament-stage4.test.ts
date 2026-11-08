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

describe('Liga nach Kalender', () => {
  const DAY = 24 * 60 * 60 * 1000;
  function online(start: number, extra: Partial<TournamentSettings> = {}) {
    const clock = { now: start - 1000 };
    const settings: TournamentSettings = { name: 'Liga', gameId: 'chess', format: 'league', time: 'normal', days: 3, thirdPlace: false, leagueStart: start, leagueDays: 7, ...extra };
    const t = Tournament.create('ABCD2345', 'seed-1', settings, { token: LEADER, name: 'L' }, { now: () => clock.now, randomClaim: () => 'X' });
    for (let i = 0; i < 4; i++) t.join(`kennung-spieler-${String(i).padStart(4, '0')}`, `Spieler${i}`, '🦊');
    return { t, clock };
  }

  it('Beginn und Abstand werden geprüft', () => {
    const find = () => ({ info: { id: 'chess', name: 'Schach', players: { min: 2, max: 2 } } as never, options: [] });
    const body = { name: 'Liga', gameId: 'chess', time: 'normal', days: 3, format: 'league' };
    const start = Date.now() + 3 * DAY;
    expect(parseTournamentSettings({ ...body, leagueStart: start, leagueDays: 14 }, find)).toMatchObject({ leagueStart: start, leagueDays: 14 });
    expect(parseTournamentSettings({ ...body, leagueStart: start, leagueDays: 5 }, find)?.leagueDays).toBeUndefined();
    expect(parseTournamentSettings({ ...body, leagueStart: 1000 }, find)?.leagueStart).toBeUndefined();
    expect(parseTournamentSettings({ ...body, format: 'swiss', leagueStart: start }, find)?.leagueStart).toBeUndefined();
  });

  it('online: spätere Spieltage werden erst an ihrem Datum spielbar', () => {
    const start = 5_000_000;
    const { t, clock } = online(start);
    clock.now = start; // erster Spieltag beginnt jetzt
    expect(t.start(LEADER)).toBeNull();
    const status = (stage: number) => new Set(t.view(LEADER).matches.filter((m) => m.stage === stage).map((m) => m.status));
    expect(status(0)).toEqual(new Set(['open']));
    expect(status(1)).toEqual(new Set(['waiting']));
    expect(t.view(LEADER).stages[1]).toMatchObject({ startsAt: start + 7 * DAY, deadline: start + 14 * DAY });
    expect(t.nextWakeup()).toBeLessThanOrEqual(start + 7 * DAY);
    clock.now = start + 7 * DAY + 1;
    t.tick();
    expect(status(1)).toEqual(new Set(['open']));
  });

  it('vor Ort: alle Spieltage offen, das Datum steht nur zur Anzeige', () => {
    const t = local('league', { leagueStart: Date.now() + DAY, leagueDays: 7 }, names(4));
    t.start(LEADER);
    const view = t.view(LEADER);
    expect(view.matches.every((m) => m.status === 'open' || m.status === 'running')).toBe(true);
    expect(view.stages[2]?.startsAt).toBeDefined();
  });
});

describe('Platzierungsspiele', () => {
  const name = (t: Tournament) => (id: string | null) => t.view(LEADER).players.find((p) => p.id === id)?.name ?? '';

  /** Spielt alles; der Spieler mit der kleineren Nummer gewinnt immer. */
  function playAll(t: Tournament) {
    for (let guard = 0; guard < 80; guard++) {
      const view = t.view(LEADER);
      if (view.phase === 'finished') return;
      const open = view.matches.filter((m) => (m.status === 'open' || m.status === 'running') && m.slots[0].player && m.slots[1].player);
      if (open.length === 0) return;
      const number = (id: string | null) => Number(view.players.find((p) => p.id === id)!.name.replace('Spieler', ''));
      for (const m of open) expect(t.enterResult(LEADER, m.id, { winner: number(m.slots[0].player) < number(m.slots[1].player) ? 0 : 1 })).toBeNull();
    }
  }

  it('Einstellung nur für K.-o. und WM-Form und schließt das Spiel um Platz 3 ein', () => {
    const find = () => undefined;
    const base = { name: 'Abend', mode: 'local', sport: 'Darts' };
    expect(parseTournamentSettings({ ...base, format: 'knockout', placements: true }, find)).toMatchObject({ placements: true, thirdPlace: true });
    expect(parseTournamentSettings({ ...base, format: 'swiss', placements: true }, find)?.placements).toBeUndefined();
  });

  it('8 Spieler: jeder Platz von 1 bis 8 wird ausgespielt', () => {
    const t = local('knockout', { placements: true, thirdPlace: true, seeded: true }, names(8));
    expect(t.start(LEADER)).toBeNull();
    // Hauptbaum 7 Partien + Spiel um 3 + Baum der 4 Verlierer des Viertelfinales (3 Partien + Spiel um 7).
    const ids = t.view(LEADER).matches.map((m) => m.id).sort();
    expect(ids.filter((id) => id.startsWith('c'))).toHaveLength(4);
    playAll(t);
    const view = t.view(LEADER);
    expect(view.phase).toBe('finished');
    expect(view.ranking.map(name(t))).toEqual(['Spieler1', 'Spieler2', 'Spieler3', 'Spieler4', 'Spieler5', 'Spieler6', 'Spieler7', 'Spieler8']);
  });

  it('16 Spieler: Achtelfinal-Verlierer spielen die Plätze 9 bis 16 aus', () => {
    const t = local('knockout', { placements: true, thirdPlace: true, seeded: true }, names(16));
    t.start(LEADER);
    playAll(t);
    const view = t.view(LEADER);
    expect(view.phase).toBe('finished');
    expect(view.ranking).toHaveLength(16);
    expect(view.ranking.map(name(t))).toEqual(names(16));
  });

  it('6 Spieler (Freilose): alle erhalten einen Platz, ohne Platzierungsspiele bleibt die Rangliste leer', () => {
    const t = local('knockout', { placements: true, thirdPlace: true, seeded: true }, names(6));
    t.start(LEADER);
    playAll(t);
    expect(t.view(LEADER).phase).toBe('finished');
    const first = t.view(LEADER).ranking.map(name(t)).slice(0, 4);
    expect(first).toEqual(['Spieler1', 'Spieler2', 'Spieler3', 'Spieler4']);
    const plain = local('knockout', { thirdPlace: true }, names(8));
    plain.start(LEADER);
    playAll(plain);
    expect(plain.view(LEADER).ranking).toEqual([]);
  });
});

describe('Beste Dritte', () => {
  const find = () => undefined;
  const base = { name: 'Abend', mode: 'local', sport: 'Darts', format: 'world' };

  it('nur mit passender Gruppenzahl', () => {
    expect(parseTournamentSettings({ ...base, bestThirds: true, groupCount: 6 }, find)).toMatchObject({ bestThirds: true, groupCount: 6 });
    expect(parseTournamentSettings({ ...base, bestThirds: true, groupCount: 4 }, find)?.bestThirds).toBeUndefined();
    expect(parseTournamentSettings({ ...base, bestThirds: true }, find)?.bestThirds).toBeUndefined();
  });

  it('3 Gruppen: zwei Beste Dritte füllen den Baum auf acht, nur Gruppendritte mit den besten Ergebnissen kommen weiter', () => {
    const t = local('world', { bestThirds: true, groupCount: 3, seeded: true }, names(12));
    expect(t.start(LEADER)).toBeNull();
    const view = t.view(LEADER);
    expect(view.groups).toHaveLength(3);
    const first = view.matches.filter((m) => m.id.startsWith('k3-'));
    expect(first).toHaveLength(4);
    const kinds = first.flatMap((m) => m.slots.map((s) => s.from?.kind));
    expect(kinds.filter((k) => k === 'bestThird')).toHaveLength(2);
    expect(kinds.filter((k) => k === 'groupPlace')).toHaveLength(6);
    // Gruppenphase spielen: kleinere Nummer gewinnt; danach stehen alle acht im Baum.
    for (let guard = 0; guard < 40; guard++) {
      const v = t.view(LEADER);
      const open = v.matches.filter((m) => (m.status === 'open' || m.status === 'running') && m.slots[0].player && m.slots[1].player);
      if (open.length === 0) break;
      const number = (id: string | null) => Number(v.players.find((p) => p.id === id)!.name.replace('Spieler', ''));
      for (const m of open) t.enterResult(LEADER, m.id, { winner: number(m.slots[0].player) < number(m.slots[1].player) ? 0 : 1 });
    }
    const done = t.view(LEADER);
    expect(done.phase).toBe('finished');
    expect(done.podium).toHaveLength(2);
  });
});

