import { inlineBotRunner } from '@brett-und-blatt/engine';
import { gameModule as describeDuel } from '@brett-und-blatt/game-describe-duel';
import { describe, expect, it } from 'vitest';
import { PROTOCOL_VERSION, Room, Tournament, formTeams, isTeamGame, parseTournamentMessage, parseTournamentSettings, validTeamSize, type RoomDeps, type RoomMessage, type ServerMessage, type TournamentSettings } from '../src';

/** Teams in Online-Turnieren (W-058 Stufe 3 Teil 4, #127). */

const LEADER = 'kennung-der-leitung-01';
const token = (i: number) => `kennung-spieler-${String(i).padStart(4, '0')}`;

function teamTournament(players: number, extra: Partial<TournamentSettings> = {}) {
  const clock = { now: 1_000_000 };
  const settings: TournamentSettings = { name: 'Cup', gameId: 'describe-duel', format: 'knockout', time: 'normal', days: 3, thirdPlace: false, teamSize: 2, ...extra };
  const t = Tournament.create('ABCD2345', 'seed-1', settings, { token: LEADER, name: 'Leitung' }, { now: () => clock.now, randomClaim: () => 'NEUCODE1' });
  for (let i = 0; i < players; i++) expect(t.join(token(i), `Spieler${i}`, '🦊')).toBeNull();
  return { t, clock };
}

describe('Einstellungen', () => {
  const duel = { id: 'describe-duel', name: 'Verboten!', players: { min: 4, max: 30 }, teams: { count: 2, names: ['A', 'B'] } };
  const find = (id: string) => (id === 'describe-duel' ? { info: duel as never, options: [] } : id === 'chess' ? { info: { id: 'chess', name: 'Schach', players: { min: 2, max: 2 } } as never, options: [] } : undefined);
  const base = { name: 'Cup', gameId: 'describe-duel', time: 'normal', days: 3, format: 'knockout' };

  it('Teamgröße nur für Teamspiele, passend zu den Plätzen', () => {
    expect(isTeamGame(duel as never)).toBe(true);
    expect(validTeamSize(duel as never, 2)).toBe(true);
    expect(validTeamSize(duel as never, 1)).toBe(false);
    expect(parseTournamentSettings({ ...base, teamSize: 3 }, find)).toMatchObject({ teamSize: 3 });
    expect(parseTournamentSettings({ ...base, teamSize: 3, bestOf: 3 }, find)?.bestOf).toBeUndefined();
    expect(parseTournamentSettings({ ...base, teamSize: 2, format: 'tables' }, find)).toBeNull();
    expect(parseTournamentSettings({ ...base, teamSize: 2, gameId: 'chess' }, find)).toBeNull();
    // Ohne Teamgröße ist Verboten! (ab vier Plätzen) kein Turnierspiel zu zweit.
    expect(parseTournamentSettings(base, find)).toBeNull();
  });
});

describe('Teamspiel mit Bedingung (Kreuzbinokel, #204)', () => {
  const binokel = { id: 'binokel', name: 'Binokel', players: { min: 3, max: 4 }, teams: { count: 2, names: ['A', 'B'], minPerTeam: 2, when: { option: 'fourTable', value: 'kreuz', seats: 4 } } };
  const find = (id: string) => (id === 'binokel' ? { info: binokel as never, options: [{ id: 'fourTable', label: 'Zu viert', choices: [{ value: 'sitOut', label: 'a' }, { value: 'kreuz', label: 'k' }], default: 'sitOut' }] } : undefined);
  const base = { name: 'Cup', gameId: 'binokel', time: 'normal', days: 3, format: 'knockout' };

  it('nur Teams zu zweit; die Kreuz-Option wird fest gesetzt', () => {
    expect(isTeamGame(binokel as never)).toBe(true);
    expect(validTeamSize(binokel as never, 2)).toBe(true);
    expect(validTeamSize(binokel as never, 3)).toBe(false);
    expect(parseTournamentSettings({ ...base, teamSize: 2 }, find)).toMatchObject({ teamSize: 2, options: { fourTable: 'kreuz' } });
    expect(parseTournamentSettings({ ...base, teamSize: 3 }, find)).toBeNull();
    expect(parseTournamentSettings(base, find)).toBeNull();
  });
});

describe('Turnier mit Teams', () => {
  it('teilt beim Start auf Teams auf; die Zahl muss aufgehen', () => {
    const odd = teamTournament(9);
    expect(odd.t.start(LEADER)).toMatch(/nicht in Teams/);
    const { t } = teamTournament(8);
    expect(formTeams(t.snapshot())).toHaveLength(4);
    expect(t.start(LEADER)).toBeNull();
    const view = t.view(LEADER);
    expect(view.players).toHaveLength(4);
    expect(view.players.every((p) => p.members?.length === 2)).toBe(true);
    // Zu wenige Teams.
    const few = teamTournament(2);
    expect(few.t.start(LEADER)).toMatch(/mindestens/);
  });

  it('jedes Mitglied sieht den Stand des Teams; ein Mitglied sagt „Bereit“ für alle', () => {
    const { t } = teamTournament(8);
    t.start(LEADER);
    const m = t.view(LEADER).matches.find((x) => x.status === 'open')!;
    const teams = t.snapshot().players;
    const [first, second] = m.slots.map((slot) => teams.find((p) => p.id === slot.player)!);
    const partner = first!.members![1]!.token;
    expect(t.view(partner).you).toBe(first!.id);
    expect(t.ready(partner, m.id, true)).toBeNull();
    expect(t.ready(second!.members![1]!.token, m.id, true)).toBeNull();
    const request = t.pendingRooms().find((r) => r.match === m.id)!;
    expect(request.tokens).toEqual([...first!.members!.map((x) => x.token), ...second!.members!.map((x) => x.token)]);
    expect(request.teams).toEqual([0, 0, 1, 1]);
    // Siegermeldung: Seite 1 (zweites Team) gewinnt.
    t.roomCreated(m.id, 'raum-1');
    expect(t.report(m.id, 'raum-1', { kind: 'played', winner: 1 })).toBe(true);
    expect(t.view(LEADER).matches.find((x) => x.id === m.id)!.outcome).toMatchObject({ winner: 1 });
  });
});

function matchRoom(tokens: string[]) {
  const clock = { now: 1000 };
  const sent = new Map<string, ServerMessage[]>();
  const deps: RoomDeps = {
    now: () => clock.now,
    findGame: (id) => (id === describeDuel.info.id ? describeDuel : undefined),
    botRunner: inlineBotRunner([describeDuel]),
    randomSeed: () => 'seed',
    send: (id, message) => void (sent.get(id) ?? sent.set(id, []).get(id)!).push(message),
    close: () => {},
  };
  const room = new Room('🦊🦊🦊🦊', deps, false);
  expect(room.setupMatch({ tournament: 'ABCD2345', match: 'k0-0', gameId: describeDuel.info.id, time: 'relaxed', tokens, label: 'Cup', teams: [0, 0, 1, 1] })).toBe(true);
  const enter = (connection: string, tk: string) => {
    room.connect(connection);
    room.receive(connection, JSON.stringify({ type: 'hello', protocol: PROTOCOL_VERSION, token: tk, name: 'Anna', avatar: '🦊' }));
  };
  return { room, clock, enter, sent };
}

describe('Spielraum mit Teams', () => {
  const tokens = [token(0), token(1), token(2), token(3)];

  it('setzt die Teamzuordnung aus dem Auftrag und meldet das Siegerteam', () => {
    const { room, enter } = matchRoom(tokens);
    tokens.forEach((tk, i) => enter(`c${i}`, tk));
    const state = (room as unknown as { game: { session: { state: { teams: number[] } } } }).game.session.state;
    expect(state.teams).toEqual([0, 0, 1, 1]);
    expect((room.snapshot().game?.seatMembers ?? []).length).toBe(4);
    // Team 2 (Plätze 3, 4) gewinnt, wenn Team 1 aufgibt.
    room.receive('c0', JSON.stringify({ type: 'resign' }));
    const report = room.matchReport()?.report;
    expect(report?.kind).toBe('played');
  });

  it('kommt nicht jeder, gewinnt das Team mit mehr Anwesenden kampflos', () => {
    const { room, clock, enter } = matchRoom(tokens);
    enter('c0', tokens[0]!);
    enter('c1', tokens[1]!);
    enter('c2', tokens[2]!);
    clock.now += 10 * 60 * 1000;
    room.tick();
    expect(room.matchReport()?.report).toEqual({ kind: 'noShow', winner: 0 });
    void ({} as RoomMessage);
  });
});

describe('Löschen', () => {
  it('nur wer das Turnier angelegt hat, darf löschen – nicht Mitleitung, Teilnehmer oder Fremde', () => {
    const { t } = teamTournament(4);
    expect(t.mayDelete(LEADER)).toBe(true);
    expect(t.mayDelete(token(0))).toBe(false);
    expect(t.mayDelete('')).toBe(false);
    expect(t.view(LEADER).mayDelete).toBe(true);
    expect(t.view(token(0)).mayDelete).toBe(false);
    expect(t.view(null).mayDelete).toBe(false);
  });

  it('die Nachricht wird erkannt', () => {
    expect(parseTournamentMessage(JSON.stringify({ type: 'delete' }))).toEqual({ type: 'delete' });
  });
});
