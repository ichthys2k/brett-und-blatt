import { describe, expect, it } from 'vitest';
import {
  LEAGUE_KEEP_MS,
  Tournament,
  assignFields,
  outcomeFromEntry,
  parseFieldCount,
  parsePointRules,
  parseTournamentMessage,
  parseTournamentSettings,
  roundRobinRounds,
  type TournamentFormat,
  type TournamentSettings,
} from '../src';

const LEADER = 'kennung-der-leitung-01';
const GUEST = 'kennung-eines-gastes-1';

function local(entrants: number, format: TournamentFormat, extra: Partial<TournamentSettings> = {}, fields = 0, points?: { win: number; draw: number; loss: number }) {
  const clock = { now: 1_000_000 };
  const settings: TournamentSettings = { name: 'Kickercup', gameId: '', format, time: 'normal', days: 1, thirdPlace: false, isPublic: false, mode: 'local', sport: 'Tischkicker', result: 'goals', draws: false, fieldLabel: 'Tisch', ...extra };
  const t = Tournament.create('ABCD2345', 'seed-vor-ort', settings, { token: LEADER, name: 'Leitung' }, { now: () => clock.now, randomClaim: () => 'NEUCODE1' }, fields, points);
  const names = Array.from({ length: entrants }, (_, i) => `Team ${i + 1}`);
  if (entrants > 0) expect(t.addEntrants(LEADER, names)).toBeNull();
  return { t, clock };
}

/** Trägt alle spielbaren Partien ein; die erste Seite gewinnt mit 3:1. */
function enterAll(t: Tournament, score: [number, number] = [3, 1]) {
  let rounds = 0;
  while (t.phase === 'running' && rounds++ < 500) {
    const next = t.view(LEADER).matches.find((m) => (m.status === 'open' || m.status === 'running') && m.slots.every((s) => s.player));
    if (!next) break;
    expect(t.enterResult(LEADER, next.id, { score })).toBeNull();
  }
}

describe('Bausteine vor Ort', () => {
  it('Spieltage: jeder spielt höchstens einmal, alle Paarungen genau einmal', () => {
    for (const n of [3, 4, 5, 6, 7, 8]) {
      const ids = Array.from({ length: n }, (_, i) => `p${i}`);
      const rounds = roundRobinRounds(ids);
      expect(rounds).toHaveLength(n % 2 === 0 ? n - 1 : n);
      const seen = new Set<string>();
      for (const pairs of rounds) {
        const inRound = pairs.flat();
        expect(new Set(inRound).size).toBe(inRound.length);
        for (const [a, b] of pairs) seen.add([a, b].sort().join('|'));
      }
      expect(seen.size).toBe((n * (n - 1)) / 2);
    }
  });

  it('Spielstand und Sieger werden zu Ergebnissen', () => {
    expect(outcomeFromEntry({ score: [2, 5] }, false)).toEqual({ winner: 1, draw: false, walkover: false, score: [2, 5] });
    expect(outcomeFromEntry({ score: [2, 2] }, true)).toEqual({ winner: null, draw: true, walkover: false, score: [2, 2] });
    expect(outcomeFromEntry({ score: [2, 2] }, false)).toBeTypeOf('string');
    expect(outcomeFromEntry({ score: [-1, 2] }, false)).toBeTypeOf('string');
    expect(outcomeFromEntry({ score: [1.5, 2] }, false)).toBeTypeOf('string');
    expect(outcomeFromEntry({ winner: 0 }, false)).toEqual({ winner: 0, draw: false, walkover: false });
    expect(outcomeFromEntry({ winner: 'draw' }, false)).toBeTypeOf('string');
  });

  it('Einstellungen vor Ort', () => {
    const find = () => undefined;
    const body = { name: 'Kickercup', mode: 'local', format: 'league', sport: 'Tischkicker', result: 'goals', draws: true, fieldLabel: 'Tisch', spectators: true, returnRound: true, fields: 3 };
    expect(parseTournamentSettings(body, find)).toEqual({ name: 'Kickercup', gameId: '', format: 'league', time: 'normal', days: 1, thirdPlace: false, isPublic: false, mode: 'local', sport: 'Tischkicker', result: 'goals', draws: true, fieldLabel: 'Tisch', spectators: true, returnRound: true });
    expect(parseFieldCount(body)).toBe(3);
    expect(parseFieldCount({ fields: 99 })).toBe(0);
    expect(parseTournamentSettings({ ...body, sport: '' }, find)).toBeNull();
    expect(parseTournamentSettings({ ...body, format: 'world', groupCount: 4 }, find)?.groupCount).toBe(4);
    expect(parseTournamentSettings({ ...body, format: 'world', groupCount: 3 }, find)?.groupCount).toBeUndefined();
    expect(parseTournamentSettings({ ...body, format: 'swiss' }, find)?.returnRound).toBeUndefined();
  });

  it('Nachrichten der Leitung', () => {
    expect(parseTournamentMessage(JSON.stringify({ type: 'enterResult', match: 'g0-1', score: [3, 1] }))).toEqual({ type: 'enterResult', match: 'g0-1', score: [3, 1] });
    expect(parseTournamentMessage(JSON.stringify({ type: 'enterResult', match: 'g0-1', winner: 'draw' }))).toEqual({ type: 'enterResult', match: 'g0-1', winner: 'draw' });
    expect(parseTournamentMessage(JSON.stringify({ type: 'enterResult', match: 'g0-1' }))).toBeNull();
    expect(parseTournamentMessage(JSON.stringify({ type: 'setFields', count: 33 }))).toBeNull();
    const names = Array.from({ length: 128 }, (_, i) => `Teilnehmerin Nummer ${i}`);
    expect(parseTournamentMessage(JSON.stringify({ type: 'addEntrants', names }))).toEqual({ type: 'addEntrants', names });
  });
});

describe('Teilnehmer vor Ort', () => {
  it('Die Leitung trägt ein, niemand schreibt sich selbst ein', () => {
    const { t } = local(0, 'knockout');
    expect(t.join(GUEST, 'Gast', '🦊')).toBeTypeOf('string');
    expect(t.addEntrants(GUEST, ['Anna'])).toBeTypeOf('string');
    expect(t.addEntrants(LEADER, ['Anna / Ben', 'Carla / Dana'])).toBeNull();
    expect(t.addEntrants(LEADER, ['anna / ben'])).toContain('schon');
    const [first] = t.snapshot().players;
    expect(first).toMatchObject({ name: 'Anna / Ben', token: '' });
    expect(t.removeEntrant(LEADER, first!.id)).toBeNull();
    expect(t.snapshot().players.map((p) => p.name)).toEqual(['Carla / Dana']);
    expect(t.publicListing()).toBeNull();
  });

  it('Teilnehmer ohne Kennung lassen sich nicht übernehmen', () => {
    const { t } = local(4, 'knockout');
    expect(t.maySee('')).toBe(false);
    expect(t.view('').you).toBeNull();
  });

  it('Zuschaulink: ohne ihn sieht nur die Leitung zu', () => {
    expect(local(4, 'knockout').t.maySee(GUEST)).toBe(false);
    expect(local(4, 'knockout').t.maySee(LEADER)).toBe(true);
    expect(local(4, 'knockout', { spectators: true }).t.maySee(GUEST)).toBe(true);
  });
});

describe('Bundesliga-Modus', () => {
  it('Hin- und Rückrunde mit 6 Teams, Tabelle nach Tordifferenz', () => {
    const { t } = local(6, 'league', { returnRound: true, draws: true });
    expect(t.start(LEADER)).toBeNull();
    const view = t.view(LEADER);
    expect(view.stages).toHaveLength(10);
    expect(view.matches).toHaveLength(30);
    // Die Rückrunde tauscht das Heimrecht.
    const first = view.matches.filter((m) => m.stage === 0).map((m) => m.slots.map((s) => s.player).join('-'));
    const back = view.matches.filter((m) => m.stage === 5).map((m) => m.slots.map((s) => s.player).reverse().join('-'));
    expect(back).toEqual(first);
    for (const m of view.matches) expect(t.enterResult(LEADER, m.id, { score: m.stage % 3 === 0 ? [1, 1] : [2, 0] })).toBeNull();
    const done = t.view(LEADER);
    expect(done.phase).toBe('finished');
    expect(done.table).toHaveLength(6);
    expect(done.table[0]!.points).toBeGreaterThanOrEqual(done.table[1]!.points);
    expect(done.table.reduce((sum, r) => sum + r.scored - r.conceded, 0)).toBe(0);
    expect(done.podium).toEqual(done.table.slice(0, 3).map((r) => r.player));
    // Ergebnis berichtigen geht auch nach dem Ende, die Tabelle rechnet neu.
    expect(t.enterResult(LEADER, view.matches[0]!.id, { score: [0, 9] })).toBeNull();
  });

  it('Ligen bleiben ein Jahr nach der letzten Aktivität', () => {
    const { t, clock } = local(3, 'league');
    expect(t.start(LEADER)).toBeNull();
    expect(t.expiresAt()).toBe(clock.now + LEAGUE_KEEP_MS);
    expect(t.nextWakeup()).toBe(t.expiresAt());
  });

  it('Ohne Remis-Erlaubnis kein Unentschieden', () => {
    const { t } = local(4, 'league');
    expect(t.start(LEADER)).toBeNull();
    const [m] = t.view(LEADER).matches;
    expect(t.enterResult(LEADER, m!.id, { score: [2, 2] })).toBe('Unentschieden gibt es hier nicht.');
  });
});

describe('Tische und Aufruf', () => {
  it('Ruft Partien an freie Tische, niemand steht an zwei Tischen', () => {
    const { t } = local(8, 'swiss', {}, 3);
    expect(t.start(LEADER)).toBeNull();
    const running = t.view(LEADER).matches.filter((m) => m.status === 'running');
    expect(running.map((m) => m.field).sort()).toEqual([0, 1, 2]);
    expect(t.view(LEADER).matches.filter((m) => m.status === 'open')).toHaveLength(1);
    // Ergebnis am Tisch 1: die wartende Partie rückt nach.
    const atOne = running.find((m) => m.field === 1)!;
    expect(t.enterResult(LEADER, atOne.id, { score: [5, 3] })).toBeNull();
    const after = t.view(LEADER).matches;
    expect(after.find((m) => m.id === atOne.id)).toMatchObject({ status: 'done', field: 1 });
    expect(after.filter((m) => m.status === 'running').map((m) => m.field).sort()).toEqual([0, 1, 2]);
  });

  it('Weniger Tische schicken Partien zurück in die Warteschlange', () => {
    const { t } = local(8, 'knockout', {}, 4);
    expect(t.start(LEADER)).toBeNull();
    expect(t.setFields(LEADER, 2)).toBeNull();
    const matches = t.view(LEADER).matches;
    expect(matches.filter((m) => m.status === 'running').map((m) => m.field).sort()).toEqual([0, 1]);
    expect(matches.filter((m) => m.status === 'open')).toHaveLength(2);
    expect(t.setFields(LEADER, 0)).toBeNull();
    expect(t.view(LEADER).matches.filter((m) => m.status === 'running')).toHaveLength(0);
  });

  it('assignFields lässt laufende Partien stehen', () => {
    const { t } = local(4, 'knockout', {}, 1);
    expect(t.start(LEADER)).toBeNull();
    expect(assignFields(t.snapshot(), 2_000_000)).toBe(false);
  });

  it('Rückzug entscheidet auch eine Partie am Tisch', () => {
    const { t } = local(4, 'knockout', {}, 2);
    expect(t.start(LEADER)).toBeNull();
    const m = t.view(LEADER).matches.find((x) => x.status === 'running')!;
    expect(t.withdraw(LEADER, m.slots[0].player!)).toBeNull();
    expect(t.view(LEADER).matches.find((x) => x.id === m.id)).toMatchObject({ status: 'done', outcome: { winner: 1, walkover: true } });
  });

  it('Bereit und Stichtage gibt es vor Ort nicht', () => {
    const { t, clock } = local(4, 'knockout');
    expect(t.start(LEADER)).toBeNull();
    clock.now += 400 * 24 * 60 * 60 * 1000 - 1;
    expect(t.tick()).toBe(false);
    expect(t.view(LEADER).matches.filter((m) => m.status === 'open')).toHaveLength(2);
    expect(t.extend(LEADER, 3)).toBeTypeOf('string');
  });
});

describe('Formen vor Ort', () => {
  it('Volleyball: 8 Teams in 2 Gruppen, dann Halbfinale', () => {
    const { t } = local(8, 'world', { sport: 'Volleyball', result: 'sets', fieldLabel: 'Feld', thirdPlace: true, groupCount: 2 }, 2);
    expect(t.start(LEADER)).toBeNull();
    expect(t.view(LEADER).groups).toHaveLength(2);
    enterAll(t, [2, 1]);
    const view = t.view(LEADER);
    expect(view.phase).toBe('finished');
    expect(view.podium).toHaveLength(3);
    expect(view.matches.filter((m) => m.group === null).every((m) => m.outcome?.score)).toBe(true);
  });

  it('K.-o. braucht einen Sieger, auch wenn Remis erlaubt ist', () => {
    const { t } = local(4, 'knockout', { draws: true });
    expect(t.start(LEADER)).toBeNull();
    const [m] = t.view(LEADER).matches;
    expect(t.enterResult(LEADER, m!.id, { score: [1, 1] })).toBeTypeOf('string');
    expect(t.enterResult(LEADER, m!.id, { winner: 1 })).toBeNull();
  });

  it('Kicker: 12 Doppel im Schweizer System, Doppel-K.-o. mit 6', () => {
    for (const [format, n] of [['swiss', 12], ['double', 6]] as const) {
      const { t } = local(n, format, {}, 4);
      expect(t.start(LEADER)).toBeNull();
      enterAll(t);
      expect(t.phase).toBe('finished');
    }
  });

  it('Bereits weitergetragene K.-o.-Ergebnisse bleiben stehen', () => {
    const { t } = local(4, 'knockout');
    expect(t.start(LEADER)).toBeNull();
    const [a, b] = t.view(LEADER).matches.filter((m) => m.status === 'open');
    expect(t.enterResult(LEADER, a!.id, { score: [3, 0] })).toBeNull();
    expect(t.enterResult(LEADER, a!.id, { score: [0, 3] })).toBeNull();
    expect(t.enterResult(LEADER, b!.id, { score: [3, 0] })).toBeNull();
    const final = t.view(LEADER).matches.find((m) => m.status === 'open')!;
    expect(t.enterResult(LEADER, final.id, { score: [3, 2] })).toBeNull();
    expect(t.enterResult(LEADER, a!.id, { score: [3, 0] })).toBe('Daran hängen schon weitere Partien.');
  });
});

describe('Stufe 2: Nachmelden und eigene Punkte', () => {
  it('Eigene Punkte je Ergebnis', () => {
    expect(parsePointRules({ points: { win: 2, draw: 1, loss: 0 } })).toEqual({ win: 2, draw: 1, loss: 0 });
    expect(parsePointRules({ points: { win: 1, draw: 1, loss: 0 } })).toBeUndefined();
    expect(parsePointRules({ points: { win: 11, draw: 1, loss: 0 } })).toBeUndefined();
    expect(parsePointRules({})).toBeUndefined();
    const { t } = local(4, 'league', { draws: true }, 0, { win: 2, draw: 1, loss: 0 });
    expect(t.start(LEADER)).toBeNull();
    for (const m of t.view(LEADER).matches) expect(t.enterResult(LEADER, m.id, { score: [2, 1] })).toBeNull();
    const table = t.view(LEADER).table;
    expect(table.reduce((sum, r) => sum + r.points, 0)).toBe(6 * 2);
  });

  it('Nachmelden im Schweizer System: ab der nächsten Runde dabei', () => {
    const { t } = local(6, 'swiss');
    expect(t.start(LEADER)).toBeNull();
    expect(t.addEntrants(LEADER, ['Spät / Dran', 'Noch / Später'])).toBeNull();
    const late = t.snapshot().players.slice(-2).map((p) => p.id);
    expect(t.view(LEADER).matches.some((m) => m.slots.some((s) => late.includes(s.player ?? '')))).toBe(false);
    for (const m of t.view(LEADER).matches.filter((x) => x.status === 'open')) expect(t.enterResult(LEADER, m.id, { score: [1, 0] })).toBeNull();
    const round2 = t.view(LEADER).matches.filter((m) => m.stage === 1);
    expect(round2.flatMap((m) => m.slots.map((s) => s.player))).toEqual(expect.arrayContaining(late));
  });

  it('Nachmelden geht in anderen Formen nicht', () => {
    const { t } = local(4, 'knockout');
    expect(t.start(LEADER)).toBeNull();
    expect(t.addEntrants(LEADER, ['Zu / Spät'])).toBe('Die Einschreibung ist beendet.');
  });
});

describe('Stufe 2: Helfer', () => {
  const HELPER = 'kennung-eines-helfers-1';
  it('Helfer tragen ein, sehen das Turnier, verwalten aber nichts', () => {
    const { t } = local(4, 'knockout');
    expect(t.addHelper(GUEST, 'Mia', 'helper')).toBeTypeOf('string');
    expect(t.addHelper(LEADER, 'Mia', 'helper')).toBeNull();
    const [link] = t.view(LEADER).helpers;
    expect(link).toMatchObject({ name: 'Mia', role: 'helper', code: 'NEUCODE1', devices: 0 });
    expect(t.view(GUEST).helpers).toEqual([]);
    expect(t.maySee(HELPER)).toBe(false);
    expect(t.joinAsHelper(HELPER, 'falsch')).toBeTypeOf('string');
    expect(t.joinAsHelper(HELPER, 'neucode1')).toBeNull();
    expect(t.maySee(HELPER)).toBe(true);
    expect(t.view(HELPER)).toMatchObject({ helperRole: 'helper', isLeader: false, helpers: [] });
    expect(t.start(HELPER)).toBeTypeOf('string');
    expect(t.start(LEADER)).toBeNull();
    const [m] = t.view(LEADER).matches;
    expect(t.enterResult(HELPER, m!.id, { winner: 0 })).toBeNull();
    expect(t.setFields(HELPER, 2)).toBeTypeOf('string');
    // Entfernt: Zugang sofort weg.
    expect(t.removeHelper(LEADER, link!.id)).toBeNull();
    expect(t.maySee(HELPER)).toBe(false);
    expect(t.enterResult(HELPER, m!.id, { winner: 1 })).toBeTypeOf('string');
  });

  it('Mitleitung darf alles außer sich selbst entfernen', () => {
    const { t } = local(4, 'knockout');
    expect(t.addHelper(LEADER, 'Ole', 'coleader')).toBeNull();
    const [link] = t.view(LEADER).helpers;
    expect(t.joinAsHelper(HELPER, link!.code)).toBeNull();
    expect(t.view(HELPER)).toMatchObject({ isLeader: true, helperRole: 'coleader' });
    expect(t.addEntrants(HELPER, ['Neu / Dabei'])).toBeNull();
    expect(t.removeHelper(HELPER, link!.id)).toBeTypeOf('string');
    expect(t.start(HELPER)).toBeNull();
  });
});

describe('Stufe 2: Zeitplan und Schiedsrichter', () => {
  it('Uhrzeiten je Partie aus Beginn, Dauer, Pause und Tischen', () => {
    const { t } = local(6, 'league', {}, 2);
    expect(t.setSchedule(LEADER, { start: 0, matchMinutes: 0, breakMinutes: 5 })).toBeTypeOf('string');
    expect(t.setSchedule(GUEST, { start: 0, matchMinutes: 10, breakMinutes: 5 })).toBeTypeOf('string');
    const start = Date.UTC(2026, 10, 7, 14, 0);
    expect(t.setSchedule(LEADER, { start, matchMinutes: 10, breakMinutes: 5 })).toBeNull();
    expect(t.start(LEADER)).toBeNull();
    const times = t.view(LEADER).matches.map((m) => m.plannedAt!);
    // 15 Partien auf 2 Tischen: 8 Durchgänge zu je 15 Minuten.
    expect(times.slice(0, 4)).toEqual([start, start, start + 15 * 60_000, start + 15 * 60_000]);
    expect(Math.max(...times)).toBe(start + 7 * 15 * 60_000);
    expect(t.setSchedule(LEADER, null)).toBeNull();
    expect(t.view(LEADER).matches[0]!.plannedAt).toBeUndefined();
  });

  it('Teams pfeifen gegenseitig: spielfrei, gleichmäßig verteilt', () => {
    const { t } = local(6, 'league', {}, 2);
    expect(t.setReferees(LEADER, true)).toBeNull();
    expect(t.start(LEADER)).toBeNull();
    let rounds = 0;
    while (t.phase === 'running' && rounds++ < 50) {
      const view = t.view(LEADER);
      const running = view.matches.filter((m) => m.status === 'running');
      for (const m of running) {
        expect(m.referee).toBeDefined();
        // Wer pfeift, spielt nirgends gerade und pfeift nur einmal zugleich.
        expect(running.flatMap((x) => x.slots.map((s) => s.player))).not.toContain(m.referee);
      }
      expect(new Set(running.map((m) => m.referee)).size).toBe(running.length);
      expect(t.enterResult(LEADER, running[0]!.id, { score: [1, 0] })).toBeNull();
    }
    const counts = new Map<string, number>();
    for (const m of t.view(LEADER).matches) if (m.referee) counts.set(m.referee, (counts.get(m.referee) ?? 0) + 1);
    expect(Math.max(...counts.values()) - Math.min(...counts.values())).toBeLessThanOrEqual(2);
  });
});
