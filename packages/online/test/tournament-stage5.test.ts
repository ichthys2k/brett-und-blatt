import { describe, expect, it } from 'vitest';
import { LEAGUE_KEEP_MS, TOURNAMENT_KEEP_MS, Tournament, parseTournamentMessage, parseTournamentSettings, type TournamentSettings } from '../src';

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
