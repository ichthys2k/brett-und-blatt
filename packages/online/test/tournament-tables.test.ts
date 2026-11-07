import { describe, expect, it } from 'vitest';
import { Tournament, parseTournamentMessage, parseTournamentSettings, placePoints, placesFromScores, tableSizes, validPlaces, type TournamentSettings } from '../src';

/** Tischrunden (W-058 Stufe 3 Teil 3). */

const token = (i: number) => `kennung-spieler-${String(i).padStart(4, '0')}`;
const LEADER = 'kennung-der-leitung-01';

const games: Record<string, { info: never; options: [] }> = {
  skat: { info: { id: 'skat', name: 'Skat', players: { min: 3, max: 4 } } as never, options: [] },
  uno: { info: { id: 'uno', name: 'Eins!', players: { min: 2, max: 10 } } as never, options: [] },
  chess: { info: { id: 'chess', name: 'Schach', players: { min: 2, max: 2 } } as never, options: [] },
  poker: { info: { id: 'poker', name: 'Poker', players: { min: 2, max: 10 }, joinMidGame: true } as never, options: [] },
};
const find = (id: string) => games[id];

function online(players: number, extra: Partial<TournamentSettings> = {}) {
  const clock = { now: 1_000_000 };
  const settings: TournamentSettings = { name: 'Skatturnier', gameId: 'skat', format: 'tables', time: 'normal', days: 3, thirdPlace: false, tableSize: 4, tableMin: 3, tableMax: 4, rounds: 3, ...extra };
  const t = Tournament.create('ABCD2345', 'seed-1', settings, { token: LEADER, name: 'Leitung' }, { now: () => clock.now, randomClaim: () => 'NEUCODE1' });
  for (let i = 0; i < players; i++) expect(t.join(token(i), `Spieler${i}`, '🦊')).toBeNull();
  return { t, clock };
}

const tokenOf = (t: Tournament, id: string) => t.snapshot().players.find((p) => p.id === id)!.token;

describe('Bausteine', () => {
  it('Tischgrößen: so gleichmäßig wie möglich, im erlaubten Rahmen', () => {
    expect(tableSizes(8, 4, 3, 4)).toEqual([4, 4]);
    expect(tableSizes(10, 4, 3, 4)).toEqual([4, 3, 3]);
    expect(tableSizes(9, 4, 3, 4)).toEqual([3, 3, 3]);
    expect(tableSizes(5, 4, 3, 4)).toBeNull();
    expect(tableSizes(5, 4, 3, 10)).toEqual([5]);
    expect(tableSizes(2, 4, 3, 4)).toBeNull();
  });

  it('Punkte und Plätze', () => {
    expect(placePoints([0, 1, 2, 3])).toEqual([3, 2, 1, 0]);
    expect(placePoints([0, 0, 2])).toEqual([1, 1, 0]);
    expect(placesFromScores([120, 80, 120, -30])).toEqual([0, 2, 0, 3]);
    expect(placesFromScores([5, 12, 3], true)).toEqual([1, 2, 0]);
    expect(validPlaces([0, 0, 2], 3)).toBe(true);
    expect(validPlaces([0, 0, 1], 3)).toBe(false);
    expect(validPlaces([0, 1], 3)).toBe(false);
  });

  it('Einstellungen: nur Spiele ab drei Plätzen, Grenzen aus dem Spiel', () => {
    const base = { name: 'Abend', format: 'tables', time: 'normal', days: 3 };
    expect(parseTournamentSettings({ ...base, gameId: 'skat', tableSize: 6, rounds: 5 }, find)).toMatchObject({ tableSize: 4, tableMin: 3, tableMax: 4, rounds: 5 });
    expect(parseTournamentSettings({ ...base, gameId: 'uno' }, find)).toMatchObject({ tableSize: 4, tableMin: 3, tableMax: 8, rounds: 4 });
    expect(parseTournamentSettings({ ...base, gameId: 'chess' }, find)).toBeNull();
    expect(parseTournamentSettings({ ...base, gameId: 'poker' }, find)).toBeNull();
    expect(parseTournamentSettings({ name: 'Doko', mode: 'local', format: 'tables', sport: 'Doppelkopf', tableSize: 4, lowWins: true }, find)).toMatchObject({ tableSize: 4, tableMin: 3, tableMax: 5, lowWins: true });
    expect(parseTournamentMessage(JSON.stringify({ type: 'enterTable', table: 'r0-t0', places: [0, 1, 2] }))).toEqual({ type: 'enterTable', table: 'r0-t0', places: [0, 1, 2] });
    expect(parseTournamentMessage(JSON.stringify({ type: 'enterTable', table: 'r0-t0' }))).toBeNull();
  });
});

describe('Tischrunden online', () => {
  it('Tische, Räume mit allen Sitzen, Platzierung zählt, nach der Tabelle neu gesetzt', () => {
    const { t } = online(8);
    expect(t.start(LEADER)).toBeNull();
    let view = t.view(LEADER);
    expect(view.tableGames).toHaveLength(2);
    expect(view.tableGames.every((g) => g.seats.length === 4)).toBe(true);
    for (let round = 0; round < 3; round++) {
      for (const table of t.view(LEADER).tableGames.filter((g) => g.stage === round)) {
        for (const id of table.seats) expect(t.ready(tokenOf(t, id), table.id, true)).toBeNull();
      }
      const requests = t.pendingRooms();
      expect(requests).toHaveLength(2);
      expect(requests.every((r) => r.tokens.length === 4 && r.gameId === 'skat')).toBe(true);
      for (const r of requests) {
        t.roomCreated(r.match, `raum-${r.match}`);
        expect(t.report(r.match, `raum-${r.match}`, { kind: 'placed', places: [0, 1, 1, 3] })).toBe(true);
      }
      view = t.view(LEADER);
      if (round < 2) {
        // Neu gesetzt: Die beiden Tischsieger der Runde sitzen jetzt an Tisch 1.
        const next = view.tableGames.filter((g) => g.stage === round + 1);
        expect(next).toHaveLength(2);
        expect(next[0]!.seats.slice(0, 2).map((id) => view.table.findIndex((row) => row.player === id))).toEqual([0, 1]);
      }
    }
    expect(view.phase).toBe('finished');
    expect(view.table[0]!.points).toBeGreaterThanOrEqual(view.table[7]!.points);
    expect(view.table.reduce((sum, row) => sum + row.played, 0)).toBe(24);
    expect(view.podium).toHaveLength(3);
  });

  it('Frist: Wer nie bereit war, landet hinten', () => {
    const { t, clock } = online(3, { days: 1 });
    t.start(LEADER);
    const [table] = t.view(LEADER).tableGames;
    t.ready(tokenOf(t, table!.seats[0]!), table!.id, true);
    clock.now += 3 * 24 * 60 * 60 * 1000;
    t.tick();
    const done = t.view(LEADER).tableGames.find((g) => g.id === table!.id)!;
    expect(done.places).toEqual([0, 1, 1]);
    expect(done.walkover).toBe(true);
  });

  it('mit zu wenigen Spielern für Tische lässt sich nicht starten', () => {
    const { t } = online(5);
    expect(t.start(LEADER)).toBe('So viele Spieler lassen sich nicht auf Tische verteilen.');
  });
});

describe('Tischrunden vor Ort', () => {
  function local(names: string[], extra: Partial<TournamentSettings> = {}) {
    const clock = { now: 1_000_000 };
    const settings: TournamentSettings = { name: 'Doko-Abend', gameId: '', format: 'tables', time: 'normal', days: 1, thirdPlace: false, mode: 'local', sport: 'Doppelkopf', tableSize: 4, tableMin: 3, tableMax: 5, rounds: 2, ...extra };
    const t = Tournament.create('ABCD2345', 'seed-1', settings, { token: LEADER, name: 'Leitung' }, { now: () => clock.now, randomClaim: () => 'NEUCODE1' });
    expect(t.addEntrants(LEADER, names)).toBeNull();
    return { t, clock };
  }

  it('Punkte im Spiel eintragen, Plätze daraus, Gleichstand nach Spielpunkten', () => {
    const { t } = local(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
    expect(t.start(LEADER)).toBeNull();
    const [first, second] = t.view(LEADER).tableGames;
    expect(t.enterTable(LEADER, first!.id, { scores: [30, -10, 50, 0] })).toBeNull();
    expect(t.view(LEADER).tableGames[0]!.places).toEqual([1, 3, 0, 2]);
    expect(t.enterTable(LEADER, second!.id, { places: [0, 1, 1] })).toBe('Diese Plätze passen nicht.');
    expect(t.enterTable(LEADER, second!.id, { places: [0, 1, 1, 3] })).toBeNull();
    // Runde 2 ist gesetzt.
    expect(t.view(LEADER).tableGames.filter((g) => g.stage === 1)).toHaveLength(2);
    expect(t.enterTable('kennung-fremder-geraet-1', second!.id, { places: [0, 1, 2, 3] })).toBe('Das dürfen nur Leitung und Helfer.');
  });

  it('niedrige Punkte gewinnen, wenn eingestellt', () => {
    const { t } = local(['A', 'B', 'C'], { lowWins: true, tableSize: 3, tableMin: 3, tableMax: 3 });
    t.start(LEADER);
    const [table] = t.view(LEADER).tableGames;
    t.enterTable(LEADER, table!.id, { scores: [12, 3, 7] });
    expect(t.view(LEADER).tableGames[0]!.places).toEqual([2, 0, 1]);
  });

  it('Turnierabend: Runde startet die Leitung, dann laufen alle Tische ohne Bereit', () => {
    const { t, clock } = online(6, { days: 1, minutes: 20, tableSize: 3 });
    expect(t.start(LEADER)).toBeNull();
    expect(t.view(LEADER).startableStage).toBe(0);
    expect(t.pendingRooms()).toEqual([]);
    expect(t.startRound(LEADER)).toBeNull();
    const view = t.view(LEADER);
    expect(view.startableStage).toBeNull();
    expect(view.stages[0]!.deadline).toBe(clock.now + 20 * 60_000);
    expect(view.tableGames.every((g) => g.status === 'running')).toBe(true);
    expect(t.pendingRooms()).toHaveLength(2);
  });
});
