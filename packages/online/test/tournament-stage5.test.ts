import { describe, expect, it } from 'vitest';
import { LEAGUE_KEEP_MS, LEAGUE_ONLINE_MAX_PLAYERS, TOURNAMENT_KEEP_MS, Tournament, applyTournamentMessage, parseSeed, parseTournamentMessage, parseTournamentSettings, type TournamentSettings } from '../src';

/** Stufe 5 (#189): Anmeldung mit Freigabe, Check-in, längere Aufbewahrung. */

const LEADER = 'kennung-der-leitung-01';
const token = (i: number) => `kennung-spieler-${String(i).padStart(4, '0')}`;
const clock = { now: 1_000_000 };
const deps = { now: () => clock.now, randomClaim: () => 'NEUCODE1' };

function online(extra: Partial<TournamentSettings>, players = 0) {
  const settings: TournamentSettings = { name: 'Cup', gameId: 'chess', format: 'knockout', time: 'normal', days: 3, thirdPlace: false, ...extra };
  const t = Tournament.create('ABCD2345', 'seed-1', settings, { token: LEADER, name: 'L' }, deps);
  for (let i = 0; i < players; i++) expect(t.join(token(i), `Spieler${i}`, '🦊')).toBeNull();
  return t;
}

describe('Einstellungen und Nachrichten', () => {
  const find = () => ({ info: { id: 'chess', name: 'Schach', players: { min: 2, max: 2 } } as never, options: [] });
  it('Freigabe und Check-in werden übernommen', () => {
    const body = { name: 'Cup', gameId: 'chess', time: 'normal', days: 3, format: 'knockout', approval: true, checkin: true };
    expect(parseTournamentSettings(body, find)).toMatchObject({ approval: true, checkin: true });
    expect(parseTournamentSettings({ ...body, approval: undefined, checkin: undefined }, find)?.approval).toBeUndefined();
    const local = { name: 'Abend', mode: 'local', sport: 'Darts', format: 'knockout', checkin: true, approval: true };
    const parsed = parseTournamentSettings(local, () => undefined);
    expect(parsed?.checkin).toBe(true);
    expect(parsed?.approval).toBeUndefined();
  });
  it('die neuen Nachrichten werden streng gelesen', () => {
    expect(parseTournamentMessage(JSON.stringify({ type: 'approve', player: 'p1', ok: true }))).toEqual({ type: 'approve', player: 'p1', ok: true });
    expect(parseTournamentMessage(JSON.stringify({ type: 'approve', player: 'p1' }))).toBeNull();
    expect(parseTournamentMessage(JSON.stringify({ type: 'present', on: true }))).toEqual({ type: 'present', on: true });
    expect(parseTournamentMessage(JSON.stringify({ type: 'present', player: 'p2', on: false }))).toEqual({ type: 'present', player: 'p2', on: false });
    expect(parseTournamentMessage(JSON.stringify({ type: 'keepLong', on: true }))).toEqual({ type: 'keepLong', on: true });
    expect(parseTournamentMessage(JSON.stringify({ type: 'keepLong' }))).toBeNull();
  });
});

describe('Anmeldung mit Freigabe', () => {
  it('Anfragen warten, bis die Leitung zulässt; der Start ist bis dahin gesperrt', () => {
    const t = online({ approval: true }, 4);
    expect(t.view(LEADER).players.every((p) => p.pending)).toBe(true);
    expect(t.start(LEADER)).toMatch(/Freigabe/);
    const ids = t.view(LEADER).players.map((p) => p.id);
    expect(t.approve(token(0), ids[0]!, true)).toMatch(/Leitung/);
    for (const id of ids.slice(0, 3)) expect(t.approve(LEADER, id, true)).toBeNull();
    expect(t.approve(LEADER, ids[3]!, false)).toBeNull();
    expect(t.view(LEADER).players).toHaveLength(3);
    expect(t.approve(LEADER, ids[0]!, true)).toMatch(/keine offene Anfrage/);
    expect(t.start(LEADER)).toMatch(/mindestens/);
  });

  it('ohne Freigabe ist jeder sofort zugelassen', () => {
    const t = online({}, 4);
    expect(t.view(LEADER).players.some((p) => p.pending)).toBe(false);
    expect(t.start(LEADER)).toBeNull();
  });
});

describe('Check-in', () => {
  it('nur wer da ist, spielt mit; jeder checkt sich selbst ein, die Leitung für andere', () => {
    const t = online({ checkin: true }, 6);
    const players = t.view(LEADER).players;
    expect(players.every((p) => p.present === false)).toBe(true);
    expect(t.setPresent(token(0), undefined, true)).toBeNull();
    // Für andere darf nur die Leitung.
    expect(t.setPresent(token(0), players[1]!.id, true)).toMatch(/Leitung/);
    expect(t.setPresent(LEADER, players[1]!.id, true)).toBeNull();
    for (const p of players.slice(2, 5)) expect(t.setPresent(LEADER, p.id, true)).toBeNull();
    // Fünf anwesend, einer fehlt: er fällt beim Start weg.
    expect(t.start(LEADER)).toBeNull();
    const view = t.view(LEADER);
    expect(view.players).toHaveLength(5);
    expect(view.players.some((p) => p.id === players[5]!.id)).toBe(false);
  });

  it('zu wenige Anwesende: kein Start', () => {
    const t = online({ checkin: true }, 6);
    expect(t.setPresent(token(0), undefined, true)).toBeNull();
    expect(t.start(LEADER)).toMatch(/mindestens 4 Anwesende/);
  });

  it('ohne Check-in gibt es keine Anwesenheit', () => {
    const t = online({}, 4);
    expect(t.setPresent(token(0), undefined, true)).toMatch(/keinen Check-in/);
  });

  it('vor Ort: Teilnehmer fangen als abwesend an, Leitung hakt ab', () => {
    const settings: TournamentSettings = { name: 'Abend', gameId: '', format: 'knockout', time: 'normal', days: 1, thirdPlace: false, mode: 'local', sport: 'Darts', result: 'winner', checkin: true };
    const t = Tournament.create('ABCD2345', 'seed-1', settings, { token: LEADER, name: 'L' }, deps);
    t.addEntrants(LEADER, ['A', 'B', 'C', 'D', 'E']);
    const players = t.view(LEADER).players;
    expect(players.every((p) => p.present === false)).toBe(true);
    for (const p of players.slice(0, 4)) expect(t.setPresent(LEADER, p.id, true)).toBeNull();
    expect(t.start(LEADER)).toBeNull();
    expect(t.view(LEADER).players).toHaveLength(4);
  });
});

describe('Längere Aufbewahrung', () => {
  it('nur die Leitung; ein Jahr statt 30 Tage, auch für ein K.-o.-Turnier', () => {
    const t = online({}, 4);
    expect(t.expiresAt()).toBe(t.snapshot().lastActivity + TOURNAMENT_KEEP_MS);
    expect(t.setKeepLong(token(0), true)).toMatch(/Leitung/);
    expect(t.setKeepLong(LEADER, true)).toBeNull();
    expect(t.view(LEADER).keepLong).toBe(true);
    expect(t.expiresAt()).toBe(t.snapshot().lastActivity + LEAGUE_KEEP_MS);
    expect(t.setKeepLong(LEADER, false)).toBeNull();
    expect(t.view(LEADER).keepLong).toBe(false);
  });
});

describe('Leitung ohne Netz (Stufe 6)', () => {
  it('Startwert der Auslosung wird streng gelesen', () => {
    expect(parseSeed('0123456789abcdef01234567')).toBe('0123456789abcdef01234567');
    for (const bad of [undefined, 5, '', 'kurz', 'mit Leerzeichen und mehr', 'x'.repeat(65)]) expect(parseSeed(bad)).toBeUndefined();
  });

  it('der gemeinsame Verteiler lehnt ab und nimmt an wie die Methoden', () => {
    const t = online({}, 4);
    const from = { token: LEADER, name: 'L', avatar: '🏆' };
    expect(applyTournamentMessage(t, { token: token(0), name: 'x', avatar: '🦊' }, { type: 'start' })).toMatchObject({ kind: 'error' });
    expect(applyTournamentMessage(t, from, { type: 'start' })).toEqual({ kind: 'ok' });
    expect(applyTournamentMessage(t, { token: token(0), name: 'x', avatar: '🦊' }, { type: 'delete' })).toMatchObject({ kind: 'error' });
    expect(applyTournamentMessage(t, from, { type: 'delete' })).toEqual({ kind: 'delete' });
  });

  it('gleicher Startwert, gleiche Auslosung', () => {
    const make = (seed: string) => {
      const s: TournamentSettings = { name: 'Cup', gameId: '', format: 'knockout', time: 'normal', days: 1, thirdPlace: false, mode: 'local', sport: 'Darts', result: 'winner' };
      const t = Tournament.create('ABCD2345', seed, s, { token: LEADER, name: 'L' }, deps);
      t.addEntrants(LEADER, ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
      t.start(LEADER);
      return JSON.stringify(t.view(LEADER).matches.filter((m) => m.stage === 0).map((m) => m.slots.map((x) => x.player)));
    };
    expect(make('seed-gleich-0001')).toBe(make('seed-gleich-0001'));
    expect(new Set(['a-seed-00001', 'b-seed-00002', 'c-seed-00003', 'd-seed-00004', 'e-seed-00005'].map(make)).size).toBeGreaterThan(1);
  });
});

describe('Online-Bundesliga begrenzen (#202)', () => {
  it('ab 30 Teilnehmern ist die Einschreibung zu, mit Hinweis auf Alternativen', () => {
    const t = online({ format: 'league' }, LEAGUE_ONLINE_MAX_PLAYERS);
    expect(t.view(LEADER).players).toHaveLength(30);
    const refused = t.join(token(99), 'Zu viel', '🦊');
    expect(refused).toMatch(/30 Teilnehmer/);
    expect(refused).toMatch(/WM-Form|Schweizer System/);
    expect(t.view(LEADER).players).toHaveLength(30);
  });

  it('andere Formen online und die Liga vor Ort sind nicht betroffen', () => {
    const swiss = online({ format: 'swiss' }, 31);
    expect(swiss.view(LEADER).players).toHaveLength(31);
    const settings: TournamentSettings = { name: 'Abend', gameId: '', format: 'league', time: 'normal', days: 1, thirdPlace: false, mode: 'local', sport: 'Darts', result: 'winner' };
    const local = Tournament.create('ABCD2345', 'seed-1', settings, { token: LEADER, name: 'L' }, deps);
    expect(local.addEntrants(LEADER, Array.from({ length: 40 }, (_, i) => `Spieler${i + 1}`))).toBeNull();
    expect(local.view(LEADER).players).toHaveLength(40);
  });
});


describe('Leitung übertragen (#203)', () => {
  const NEW = 'kennung-neues-geraet-01';

  it('nur die Hauptleitung erzeugt einen Code; Mitleitung und Spieler nicht', () => {
    const t = online({}, 2);
    expect(t.issueLeaderTransfer(token(0))).toMatchObject({ error: expect.stringMatching(/Hauptleitung/) });
    const ok = t.issueLeaderTransfer(LEADER);
    expect(ok).toMatchObject({ code: 'NEUCODE1', expiresAt: clock.now + 24 * 60 * 60 * 1000 });
  });

  it('mit dem Code wechselt die Hauptleitung; das alte Gerät verliert sie', () => {
    const t = online({}, 2);
    t.issueLeaderTransfer(LEADER);
    expect(t.takeLeadership(NEW, 'Neu', 'neucode1')).toBeNull();
    expect(t.mayDelete(NEW)).toBe(true);
    expect(t.isLeader(NEW)).toBe(true);
    expect(t.mayDelete(LEADER)).toBe(false);
    expect(t.isLeader(LEADER)).toBe(false);
    // einmalig: der Code gilt danach nicht mehr
    expect(t.takeLeadership(token(1), 'Dritter', 'NEUCODE1')).toMatch(/keine Übergabe/);
  });

  it('falscher Code zählt Versuche und sperrt nach fünf', () => {
    const t = online({}, 0);
    t.issueLeaderTransfer(LEADER);
    for (let i = 0; i < 4; i++) expect(t.takeLeadership(NEW, 'X', 'FALSCH')).toMatch(/passt nicht/);
    expect(t.takeLeadership(NEW, 'X', 'FALSCH')).toMatch(/passt nicht/);
    expect(t.takeLeadership(NEW, 'X', 'NEUCODE1')).toMatch(/keine Übergabe/);
    expect(t.mayDelete(LEADER)).toBe(true);
  });

  it('der Code läuft nach einem Tag ab', () => {
    const t = online({}, 0);
    t.issueLeaderTransfer(LEADER);
    clock.now += 24 * 60 * 60 * 1000;
    expect(t.takeLeadership(NEW, 'X', 'NEUCODE1')).toMatch(/abgelaufen/);
    expect(t.mayDelete(LEADER)).toBe(true);
  });

  it('die bisherige Leitung kann den eigenen Code nicht einlösen', () => {
    const t = online({}, 0);
    t.issueLeaderTransfer(LEADER);
    expect(t.takeLeadership(LEADER, 'L', 'NEUCODE1')).toMatch(/schon die Leitung/);
  });

  it('Nachrichten werden gelesen und über den Verteiler ausgeführt', () => {
    expect(parseTournamentMessage(JSON.stringify({ type: 'leaderCode' }))).toEqual({ type: 'leaderCode' });
    expect(parseTournamentMessage(JSON.stringify({ type: 'takeLeader', code: 'ABC' }))).toEqual({ type: 'takeLeader', code: 'ABC' });
    expect(parseTournamentMessage(JSON.stringify({ type: 'takeLeader' }))).toBeNull();
    const t = online({}, 0);
    const issued = applyTournamentMessage(t, { token: LEADER, name: 'L', avatar: '🦊' }, { type: 'leaderCode' });
    expect(issued).toMatchObject({ kind: 'ok', leaderCode: { code: 'NEUCODE1' } });
    const taken = applyTournamentMessage(t, { token: NEW, name: 'Neu', avatar: '🦊' }, { type: 'takeLeader', code: 'NEUCODE1' });
    expect(taken).toMatchObject({ kind: 'ok' });
    expect(t.mayDelete(NEW)).toBe(true);
  });
});
