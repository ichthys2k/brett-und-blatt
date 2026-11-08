import { inlineBotRunner } from '@brett-und-blatt/engine';
import { gameModule as ticTacToe } from '@brett-und-blatt/game-tic-tac-toe';
import { describe, expect, it } from 'vitest';
import {
  MATCH_AWAY_MS,
  PROTOCOL_VERSION,
  Room,
  SERIES_PAUSE_MS,
  Tournament,
  checkSeriesScore,
  newSeries,
  parseTournamentSettings,
  recordSeriesGame,
  type RoomDeps,
  type RoomMessage,
  type ServerMessage,
  type TournamentSettings,
} from '../src';

/** Best of N (W-058 Stufe 3 Teil 5, #131). */

const A = 'kennung-spieler-a-0001';
const B = 'kennung-spieler-b-0002';
const LEADER = 'kennung-der-leitung-01';
const token = (i: number) => `kennung-spieler-${String(i).padStart(4, '0')}`;

describe('Serie', () => {
  it('wer zuerst mehr als die Hälfte gewinnt, gewinnt die Begegnung', () => {
    const s = newSeries(3);
    expect(recordSeriesGame(s, 0)).toBe(false);
    expect(recordSeriesGame(s, 1)).toBe(false);
    expect(recordSeriesGame(s, 0)).toBe(true);
    expect(s).toMatchObject({ score: [2, 1], games: 3, winner: 0 });
    const quick = newSeries(5);
    for (let i = 0; i < 3; i++) recordSeriesGame(quick, 1);
    expect(quick).toMatchObject({ score: [0, 3], winner: 1 });
  });

  it('Remis wird zweimal nachgespielt, danach zählt es halb', () => {
    const s = newSeries(3);
    expect(recordSeriesGame(s, null)).toBe(false);
    expect(recordSeriesGame(s, null)).toBe(false);
    expect(s).toMatchObject({ score: [0, 0], games: 0, replays: 2 });
    recordSeriesGame(s, null);
    expect(s.score).toEqual([0.5, 0.5]);
    recordSeriesGame(s, 0);
    expect(recordSeriesGame(s, 1)).toBe(true);
    expect(s).toMatchObject({ score: [1.5, 1.5], winner: null });
  });

  it('Stand vor Ort: der Sieger hat genau die nötigen Siege', () => {
    expect(checkSeriesScore([2, 1], 3)).toBeNull();
    expect(checkSeriesScore([0, 3], 5)).toBeNull();
    expect(checkSeriesScore([3, 1], 3)).toMatch(/2 Partien/);
    expect(checkSeriesScore([1, 1], 3)).toBeTruthy();
    expect(checkSeriesScore([2, 2], 3)).toBeTruthy();
  });
});

describe('Einstellungen', () => {
  const games: Record<string, { info: never; options: [] }> = {
    chess: { info: { id: 'chess', name: 'Schach', players: { min: 2, max: 2 } } as never, options: [] },
    skat: { info: { id: 'skat', name: 'Skat', players: { min: 3, max: 4 } } as never, options: [] },
  };
  const find = (id: string) => games[id];
  const base = { name: 'Cup', gameId: 'chess', time: 'normal', days: 3 };

  it('für alle Formen, eigens für die K.-o.-Phase, nicht bei Tischrunden', () => {
    expect(parseTournamentSettings({ ...base, format: 'swiss', bestOf: 3 }, find)).toMatchObject({ bestOf: 3 });
    expect(parseTournamentSettings({ ...base, format: 'world', bestOf: 1, bestOfKo: 5 }, find)).toMatchObject({ bestOfKo: 5 });
    expect(parseTournamentSettings({ ...base, format: 'swiss', bestOfKo: 5 }, find)?.bestOfKo).toBeUndefined();
    expect(parseTournamentSettings({ ...base, format: 'knockout', bestOf: 4 }, find)?.bestOf).toBeUndefined();
    expect(parseTournamentSettings({ ...base, gameId: 'skat', format: 'tables', bestOf: 3 }, find)?.bestOf).toBeUndefined();
    // Vor Ort nur, wenn der Sieger eingetragen wird.
    const local = { name: 'Abend', mode: 'local', format: 'knockout', sport: 'Darts' };
    expect(parseTournamentSettings({ ...local, result: 'winner', bestOf: 5 }, find)).toMatchObject({ bestOf: 5 });
    expect(parseTournamentSettings({ ...local, result: 'goals', bestOf: 5 }, find)?.bestOf).toBeUndefined();
  });
});

function online(players: number, extra: Partial<TournamentSettings>) {
  const clock = { now: 1_000_000 };
  const settings: TournamentSettings = { name: 'Cup', gameId: 'chess', format: 'world', time: 'normal', days: 3, thirdPlace: false, ...extra };
  const t = Tournament.create('ABCD2345', 'seed-1', settings, { token: LEADER, name: 'Leitung' }, { now: () => clock.now, randomClaim: () => 'NEUCODE1' });
  for (let i = 0; i < players; i++) expect(t.join(token(i), `Spieler${i}`, '🦊')).toBeNull();
  return { t, clock };
}

describe('Turnier', () => {
  it('Raumauftrag nennt die Partien je Begegnung, die K.-o.-Phase eigens', () => {
    const { t } = online(6, { bestOf: 3, bestOfKo: 5 });
    expect(t.start(LEADER)).toBeNull();
    const m = t.view(LEADER).matches.find((x) => x.status === 'open')!;
    const tokens = m.slots.map((slot) => t.snapshot().players.find((p) => p.id === slot.player)!.token);
    for (const [i, tk] of tokens.entries()) expect(t.ready(tk, m.id, true)).toBeNull(), void i;
    const request = t.pendingRooms().find((r) => r.match === m.id)!;
    expect(request.bestOf).toBe(3);
    // Stand aus dem Raum landet als Spielstand bei der Partie.
    t.roomCreated(m.id, 'raum-1');
    expect(t.report(m.id, 'raum-1', { kind: 'played', winner: 1, score: [1, 2] })).toBe(true);
    expect(t.view(LEADER).matches.find((x) => x.id === m.id)!.outcome).toMatchObject({ winner: 1, score: [1, 2] });
    // Die Endrunde der WM-Form spielt Best of 5.
    const s = t.snapshot();
    const koStage = s.stages.findIndex((stage) => stage.kind === 'ko');
    expect(koStage).toBeGreaterThan(0);
  });

  it('vor Ort: Stand wird gegen Best of N geprüft', () => {
    const t = Tournament.create('ABCD2345', 'seed-1', { name: 'Darts', gameId: '', format: 'knockout', time: 'normal', days: 1, thirdPlace: false, mode: 'local', sport: 'Darts', result: 'winner', bestOf: 3 }, { token: LEADER, name: 'Leitung' }, { now: () => 1, randomClaim: () => 'NEUCODE1' });
    expect(t.addEntrants(LEADER, ['Anna', 'Ben', 'Clara', 'Dora'])).toBeNull();
    expect(t.start(LEADER)).toBeNull();
    const m = t.view(LEADER).matches.find((x) => x.status !== 'waiting')!;
    expect(t.enterResult(LEADER, m.id, { score: [3, 1] })).toMatch(/2 Partien/);
    expect(t.enterResult(LEADER, m.id, { score: [1, 2] })).toBeNull();
    expect(t.view(LEADER).matches.find((x) => x.id === m.id)!.outcome).toMatchObject({ winner: 1, score: [1, 2] });
  });
});

function room(bestOf: number) {
  const clock = { now: 1000 };
  const sent = new Map<string, ServerMessage[]>();
  const deps: RoomDeps = {
    now: () => clock.now,
    findGame: (id) => (id === ticTacToe.info.id ? ticTacToe : undefined),
    botRunner: inlineBotRunner([ticTacToe]),
    randomSeed: () => 'seed',
    send: (id, message) => void (sent.get(id) ?? sent.set(id, []).get(id)!).push(message),
    close: () => {},
  };
  const r = new Room('🦊🦊🦊🦊', deps, false);
  expect(r.setupMatch({ tournament: 'ABCD2345', match: 'k0-0', gameId: ticTacToe.info.id, time: 'relaxed', tokens: [A, B], label: 'Cup', bestOf })).toBe(true);
  const enter = (connection: string, tk: string) => {
    r.connect(connection);
    r.receive(connection, JSON.stringify({ type: 'hello', protocol: PROTOCOL_VERSION, token: tk, name: 'Anna', avatar: '🦊' }));
  };
  const last = (connection: string) => sent.get(connection)?.filter((m) => m.type === 'room').at(-1) as RoomMessage;
  enter('a', A);
  enter('b', B);
  return { room: r, clock, last };
}

describe('Serie im Spielraum', () => {
  it('spielt bis zur Entscheidung, Farben wechseln, gemeldet wird erst am Ende mit Stand', () => {
    const { room: r, clock, last } = room(3);
    const memberOf = (tk: string) => r.snapshot().members.find((m) => m.token === tk)!.id;
    r.receive('b', JSON.stringify({ type: 'resign' }));
    expect(r.matchReport()).toBeNull();
    expect(last('a').match?.series).toMatchObject({ bestOf: 3, score: [1, 0], done: false });
    clock.now += SERIES_PAUSE_MS;
    r.tick();
    expect(last('a').phase).toBe('playing');
    // Farbwechsel: B sitzt jetzt auf Platz 1.
    expect(r.snapshot().game?.seatMembers).toEqual([memberOf(B), memberOf(A)]);
    expect(last('a').match?.series?.score).toEqual([0, 1]);
    r.receive('a', JSON.stringify({ type: 'resign' }));
    expect(r.matchReport()).toBeNull();
    clock.now += SERIES_PAUSE_MS;
    r.tick();
    expect(r.snapshot().game?.seatMembers).toEqual([memberOf(A), memberOf(B)]);
    r.receive('b', JSON.stringify({ type: 'resign' }));
    expect(r.matchReport()).toEqual({ tournament: 'ABCD2345', match: 'k0-0', report: { kind: 'played', winner: 0, score: [2, 1] } });
    expect(r.nextWakeup()).not.toBe(null);
  });

  it('wer wegbleibt, verliert die ganze Begegnung', () => {
    const { room: r, clock } = room(5);
    r.disconnect('b');
    clock.now += MATCH_AWAY_MS;
    r.tick();
    expect(r.matchReport()?.report).toEqual({ kind: 'noShow', winner: 0 });
  });
});
