import { describe, expect, it } from 'vitest';
import { Tournament, parseTournamentMessage, parseTournamentSettings, type TournamentFormat, type TournamentMatch } from '../src';

/** Turnierabend (W-058 Stufe 3): Minutenfristen, Rundenstart durch die Leitung, Partien starten von selbst. */

const token = (i: number) => `kennung-spieler-${String(i).padStart(4, '0')}`;
const LEADER = 'kennung-der-leitung-01';
const MIN = 60_000;

function setup(players: number, format: TournamentFormat = 'knockout', minutes = 20) {
  const clock = { now: 1_000_000 };
  const t = Tournament.create('ABCD2345', 'seed-1', { name: 'Abendcup', gameId: 'chess', format, time: 'fast', days: 1, minutes, thirdPlace: false }, { token: LEADER, name: 'Leitung' }, { now: () => clock.now, randomClaim: () => 'NEUCODE1' });
  for (let i = 0; i < players; i++) expect(t.join(token(i), `Spieler${i}`, '🦊')).toBeNull();
  return { t, clock };
}

/** Raum anlegen und Ergebnis melden: Am Turnierabend braucht es kein „Bereit“. */
function finish(t: Tournament, m: { id: string }, winner: 0 | 1 | null) {
  t.roomCreated(m.id, `raum-${m.id}`);
  expect(t.report(m.id, `raum-${m.id}`, { kind: 'played', winner })).toBe(true);
}

const tokenOf = (t: Tournament, playerId: string | null) => t.snapshot().players.find((p) => p.id === playerId)!.token;

describe('Turnierabend', () => {
  it('Einstellungen: Minuten statt Tage, nur aus der Liste', () => {
    const find = () => ({ info: { id: 'chess', name: 'Schach', players: { min: 2, max: 2 } } as never, options: [] });
    const base = { name: 'Abend', gameId: 'chess', format: 'swiss', time: 'fast' };
    expect(parseTournamentSettings({ ...base, minutes: 20 }, find)).toMatchObject({ minutes: 20, days: 1 });
    expect(parseTournamentSettings({ ...base, minutes: 7 }, find)).toBeNull();
    expect(parseTournamentSettings({ ...base, days: 3 }, find)?.minutes).toBeUndefined();
    expect(parseTournamentMessage(JSON.stringify({ type: 'extend', minutes: 10 }))).toEqual({ type: 'extend', days: 0, minutes: 10 });
    expect(parseTournamentMessage(JSON.stringify({ type: 'startRound' }))).toEqual({ type: 'startRound' });
  });

  it('Runde wartet auf die Leitung, dann starten alle Partien zugleich', () => {
    const { t, clock } = setup(8);
    expect(t.start(LEADER)).toBeNull();
    let view = t.view(LEADER);
    expect(view.startableStage).toBe(0);
    expect(t.pendingRooms()).toEqual([]);
    const first = view.matches.find((m) => m.status === 'open')!;
    expect(t.ready(tokenOf(t, first.slots[0].player), first.id, true)).toBe('Die Runde hat noch nicht begonnen.');
    // Ohne Rundenstart läuft keine Frist ab.
    clock.now += 3 * 24 * 60 * MIN;
    expect(t.view(LEADER).matches.every((m) => m.outcome === null)).toBe(true);
    expect(t.startRound(token(0))).toBe('Das darf nur die Leitung.');
    expect(t.startRound(LEADER)).toBeNull();
    view = t.view(LEADER);
    expect(view.startableStage).toBeNull();
    expect(view.stages[0]!.deadline).toBe(clock.now + 20 * MIN);
    expect(t.pendingRooms()).toHaveLength(4);
    for (const m of view.matches.filter((x) => x.stage === 0)) finish(t, m, 0);
    // Halbfinale: wieder erst nach dem Start.
    view = t.view(LEADER);
    expect(view.startableStage).toBe(1);
    expect(t.pendingRooms()).toEqual([]);
    expect(t.startRound(LEADER)).toBeNull();
    expect(t.pendingRooms()).toHaveLength(2);
  });

  it('Frist in Minuten: Wer nach Nichterscheinen nicht bereit ist, verliert am Ende der Runde', () => {
    const { t, clock } = setup(4);
    t.start(LEADER);
    t.startRound(LEADER);
    const [m] = t.view(LEADER).matches.filter((x) => x.stage === 0) as TournamentMatch[];
    t.roomCreated(m!.id, 'raum-a');
    // Keiner kam: neu angesetzt, aber nicht von selbst gestartet.
    t.report(m!.id, 'raum-a', { kind: 'noShow', winner: null });
    expect(t.view(LEADER).matches.find((x) => x.id === m!.id)!.status).toBe('open');
    expect(t.pendingRooms().some((r) => r.match === m!.id)).toBe(false);
    expect(t.nextWakeup()).toBeLessThanOrEqual(clock.now + 20 * MIN);
    // Verlängern verschiebt die Frist um Minuten.
    expect(t.extend(LEADER, 0, 10)).toBeNull();
    clock.now += 25 * MIN;
    t.tick();
    expect(t.view(LEADER).matches.find((x) => x.id === m!.id)!.outcome).toBeNull();
    clock.now += 10 * MIN;
    t.tick();
    expect(t.view(LEADER).matches.find((x) => x.id === m!.id)!.outcome?.walkover).toBe(true);
  });

  it('Gruppenphase: Frist für alle Partien eines Spielers, nächste Partie startet, sobald beide frei sind', () => {
    const { t, clock } = setup(6, 'world', 15);
    t.start(LEADER);
    t.startRound(LEADER);
    const view = t.view(LEADER);
    // Sechs Spieler in zwei Gruppen zu drei: jeder hat zwei Partien.
    expect(view.stages[0]!.deadline).toBe(clock.now + 2 * 15 * MIN);
    const running = view.matches.filter((m) => m.status === 'running');
    const players = running.flatMap((m) => m.slots.map((s) => s.player));
    expect(new Set(players).size).toBe(players.length);
    const before = t.pendingRooms().length;
    finish(t, running[0]!, 0);
    expect(t.pendingRooms().length).toBeGreaterThanOrEqual(before - 1);
  });

  it('Turniere über Tage bleiben, wie sie waren', () => {
    const clock = { now: 1_000_000 };
    const t = Tournament.create('ABCD2345', 'seed-1', { name: 'Cup', gameId: 'chess', format: 'knockout', time: 'normal', days: 7, thirdPlace: false }, { token: LEADER, name: 'Leitung' }, { now: () => clock.now, randomClaim: () => 'NEUCODE1' });
    for (let i = 0; i < 4; i++) t.join(token(i), `S${i}`, '🦊');
    t.start(LEADER);
    expect(t.view(LEADER).startableStage).toBeNull();
    expect(t.startRound(LEADER)).toBe('Gerade gibt es keine Runde zu starten.');
    expect(t.extend(LEADER, 0, 10)).toBe('Hier gelten Tage, keine Minuten.');
  });
});

describe('Brett-&-Blatt-Spiel vor Ort', () => {
  const games: Record<string, { info: never; options: [] }> = {
    chess: { info: { id: 'chess', name: 'Schach', players: { min: 2, max: 2 } } as never, options: [] },
    poker: { info: { id: 'poker', name: 'Poker', players: { min: 2, max: 10 }, joinMidGame: true } as never, options: [] },
  };
  const find = (id: string) => games[id];
  const base = { name: 'Schachabend', mode: 'local', format: 'swiss' };

  it('übernimmt den Spielnamen als Sportart', () => {
    expect(parseTournamentSettings({ ...base, gameId: 'chess', sport: 'egal' }, find)).toMatchObject({ gameId: 'chess', sport: 'Schach', mode: 'local' });
    expect(parseTournamentSettings({ ...base, sport: 'Tischkicker' }, find)).toMatchObject({ gameId: '', sport: 'Tischkicker' });
  });

  it('lehnt unbekannte und nicht turniertaugliche Spiele ab', () => {
    expect(parseTournamentSettings({ ...base, gameId: 'gibtsnicht', sport: 'x' }, find)).toBeNull();
    expect(parseTournamentSettings({ ...base, gameId: 'poker' }, find)).toBeNull();
  });
});
