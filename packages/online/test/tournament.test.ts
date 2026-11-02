import { describe, expect, it } from 'vitest';
import {
  DAY_MS,
  MATCH_MIN_TIME_MS,
  READY_WINDOW_MS,
  TOURNAMENT_KEEP_MS,
  Tournament,
  groupCountFor,
  koFirstRound,
  parseTournamentMessage,
  roundRobinPairs,
  swissPairing,
  swissRoundsFor,
  parseTournamentSettings,
  type TournamentFormat,
  type TournamentMatch,
  type TournamentSettings,
} from '../src';

const token = (i: number) => `kennung-spieler-${String(i).padStart(4, '0')}`;
const LEADER = 'kennung-der-leitung-01';

function setup(players: number, format: TournamentFormat = 'world', extra: Partial<TournamentSettings> = {}) {
  const clock = { now: 1_000_000 };
  const t = Tournament.create('ABCD2345', 'seed-1', { name: 'Testcup', gameId: 'chess', format, time: 'normal', days: 7, thirdPlace: false, ...extra }, { token: LEADER, name: 'Leitung' }, { now: () => clock.now, randomClaim: () => 'NEUCODE1' });
  for (let i = 0; i < players; i++) expect(t.join(token(i), `Spieler${i}`, '🦊')).toBeNull();
  return { t, clock };
}

const tokenOf = (t: Tournament, playerId: string | null) => t.snapshot().players.find((p) => p.id === playerId)!.token;

/** Beide bereit, Raum angelegt, Ergebnis gemeldet: wie im echten Ablauf. */
function play(t: Tournament, m: { id: string; slots: TournamentMatch['slots'] }, seatWinner: 0 | 1 | null) {
  expect(t.ready(tokenOf(t, m.slots[0].player), m.id, true)).toBeNull();
  expect(t.ready(tokenOf(t, m.slots[1].player), m.id, true)).toBeNull();
  const [request] = t.pendingRooms();
  expect(request?.match).toBe(m.id);
  t.roomCreated(m.id, `raum-${m.id}`);
  expect(t.report(m.id, `raum-${m.id}`, { kind: 'played', winner: seatWinner })).toBe(true);
}

function playAllOpen(t: Tournament, winner: 0 | 1 | null = 0) {
  for (const m of t.view(LEADER).matches.filter((x) => x.status === 'open')) play(t, m, winner);
}

describe('Bausteine', () => {
  it('Gruppenzahl und Runden wie im Plan', () => {
    expect([8, 16, 32].map(groupCountFor)).toEqual([2, 4, 8]);
    expect(groupCountFor(6)).toBe(2);
    expect(groupCountFor(12)).toBe(4);
    expect([8, 16, 32].map(swissRoundsFor)).toEqual([5, 6, 7]);
    expect(swissRoundsFor(4)).toBe(3);
  });

  it('jeder gegen jeden: jede Paarung genau einmal', () => {
    for (const n of [3, 4, 5, 6]) {
      const pairs = roundRobinPairs(Array.from({ length: n }, (_, i) => i));
      expect(pairs).toHaveLength((n * (n - 1)) / 2);
      expect(new Set(pairs.map(([a, b]) => [a, b].sort().join())).size).toBe(pairs.length);
    }
  });

  it('Gruppensieger treffen auf Zweite einer anderen Gruppe', () => {
    for (const pair of koFirstRound(4)) {
      const [a, b] = pair as [{ group: number; place: number }, { group: number; place: number }];
      expect(a.place).toBe(0);
      expect(b.place).toBe(1);
      expect(a.group).not.toBe(b.group);
    }
  });

  it('Schweizer Paarung vermeidet Wiederholungen und vergibt das Freilos nur einmal', () => {
    const { pairs, bye } = swissPairing(['a', 'b', 'c', 'd', 'e'], new Set(['a|b']), new Set(['e']));
    expect(bye).toBe('d');
    expect(pairs).toEqual([['a', 'c'], ['b', 'e']]);
  });

  it('prüft eingehende Nachrichten', () => {
    expect(parseTournamentMessage('{"type":"extend","days":3}')).toEqual({ type: 'extend', days: 3 });
    expect(parseTournamentMessage('{"type":"extend","days":300}')).toBeNull();
    expect(parseTournamentMessage('{"type":"setResult","match":"g0-0","winner":2}')).toBeNull();
    expect(parseTournamentMessage('kaputt')).toBeNull();
  });
});

describe('WM-Form', () => {
  it('spielt 8 Spieler bis zum Sieger durch: 15 Partien', () => {
    const { t } = setup(8);
    expect(t.start(token(0))).toBe('Das darf nur die Leitung.');
    expect(t.start(LEADER)).toBeNull();
    const first = t.view(LEADER);
    expect(first.groups.map((g) => g.players.length)).toEqual([4, 4]);
    expect(first.matches).toHaveLength(15);
    // Der Baum ist schon in der Gruppenphase sichtbar, mit Herkunft.
    expect(first.matches.find((m) => m.id === 'k1-0')?.slots[0].from).toEqual({ kind: 'winner', match: 'k2-0' });
    for (let i = 0; i < 12 && t.phase === 'running'; i++) playAllOpen(t);
    const end = t.view(LEADER);
    expect(end.phase).toBe('finished');
    expect(end.podium).toHaveLength(2);
    expect(end.groups.every((g) => g.settled)).toBe(true);
  });

  it('der K.-o.-Baum wartet nicht auf die andere Hälfte', () => {
    const { t } = setup(8);
    t.start(LEADER);
    for (const m of t.view(LEADER).matches.filter((x) => x.group !== null)) play(t, m, 0);
    const semis = t.view(LEADER).matches.filter((m) => m.id.startsWith('k2-'));
    expect(semis.map((m) => m.status)).toEqual(['open', 'open']);
    play(t, semis[0]!, 0);
    expect(t.view(LEADER).matches.find((m) => m.id === 'k1-0')?.status).toBe('waiting');
    expect(t.view(LEADER).matches.find((m) => m.id === 'k1-0')?.slots[0].player).toBe(semis[0]!.slots[0].player);
  });

  it('spielt auf Wunsch um Platz 3', () => {
    const { t } = setup(8, 'world', { thirdPlace: true });
    t.start(LEADER);
    expect(t.view(LEADER).matches).toHaveLength(16);
    for (let i = 0; i < 12 && t.phase === 'running'; i++) playAllOpen(t);
    expect(t.view(LEADER).podium).toHaveLength(3);
  });

  it('Remis im K.-o.-Spiel: neu angesetzt, Plätze getauscht, schnelle Zeit, richtige Seite gewinnt', () => {
    const { t } = setup(8);
    t.start(LEADER);
    for (const m of t.view(LEADER).matches.filter((x) => x.group !== null)) play(t, m, 0);
    const semi = t.view(LEADER).matches.find((m) => m.id === 'k2-0')!;
    play(t, semi, null);
    const again = t.view(LEADER).matches.find((m) => m.id === 'k2-0')!;
    expect(again.status).toBe('open');
    expect(again.replays).toBe(1);
    t.ready(tokenOf(t, again.slots[0].player), again.id, true);
    t.ready(tokenOf(t, again.slots[1].player), again.id, true);
    const [request] = t.pendingRooms();
    expect(request?.tokens).toEqual([tokenOf(t, again.slots[1].player), tokenOf(t, again.slots[0].player)]);
    expect(request?.time).toBe('fast');
    t.roomCreated(again.id, 'raum-neu');
    // Platz 0 ist jetzt die zweite Seite.
    t.report(again.id, 'raum-neu', { kind: 'played', winner: 0 });
    expect(t.view(LEADER).matches.find((m) => m.id === 'k2-0')?.outcome?.winner).toBe(1);
  });

  it('Remis in der Gruppe gibt je einen Punkt', () => {
    const { t } = setup(8);
    t.start(LEADER);
    const m = t.view(LEADER).matches[0]!;
    play(t, m, null);
    const row = t.view(LEADER).groups[0]!.table.find((r) => r.player === m.slots[0].player)!;
    expect(row).toMatchObject({ played: 1, draws: 1, points: 1 });
  });
});

describe('Schweizer System', () => {
  it('spielt alle Runden ohne Wiederholung, bei ungerader Zahl mit Freilos', () => {
    const { t } = setup(7, 'swiss');
    t.start(LEADER);
    for (let i = 0; i < 12 && t.phase === 'running'; i++) playAllOpen(t);
    const end = t.view(LEADER);
    expect(end.phase).toBe('finished');
    expect(end.stages).toHaveLength(swissRoundsFor(7));
    const pairs = end.matches.filter((m) => m.slots[1].player).map((m) => [m.slots[0].player, m.slots[1].player].sort().join());
    expect(new Set(pairs).size).toBe(pairs.length);
    expect(end.matches.filter((m) => m.outcome?.bye)).toHaveLength(swissRoundsFor(7));
    expect(end.podium).toHaveLength(3);
    expect(end.swissTable[0]!.points).toBeGreaterThanOrEqual(end.swissTable[1]!.points);
  });
});

describe('Bereit und Stichtag', () => {
  it('„Bereit“ verfällt: Ein Spieler von gestern wird nicht in die Partie gezogen', () => {
    const { t, clock } = setup(8);
    t.start(LEADER);
    const m = t.view(LEADER).matches[0]!;
    t.ready(tokenOf(t, m.slots[0].player), m.id, true);
    clock.now += READY_WINDOW_MS;
    t.ready(tokenOf(t, m.slots[1].player), m.id, true);
    expect(t.pendingRooms()).toEqual([]);
  });

  it('„Bereit“ gilt nur für eine Partie, und nicht während einer laufenden', () => {
    const { t } = setup(8);
    t.start(LEADER);
    const matches = t.view(LEADER).matches;
    const player = matches[0]!.slots[0].player!;
    const [first, second] = matches.filter((m) => m.slots.some((s) => s.player === player));
    const me = tokenOf(t, player);
    t.ready(me, first!.id, true);
    t.ready(me, second!.id, true);
    const after = t.view(LEADER).matches;
    const ownReady = (id: string) => after.find((m) => m.id === id)!.readyAt.filter((at) => at !== null).length;
    expect([ownReady(first!.id), ownReady(second!.id)]).toEqual([0, 1]);
    const side = second!.slots.findIndex((s) => s.player !== player);
    t.ready(tokenOf(t, second!.slots[side]!.player), second!.id, true);
    expect(t.ready(me, first!.id, true)).toBe('Du spielst gerade eine andere Partie.');
  });

  it('nur fremde Partien lassen sich nicht bestätigen', () => {
    const { t } = setup(8);
    t.start(LEADER);
    const m = t.view(LEADER).matches[0]!;
    const stranger = t.view(LEADER).players.find((p) => !m.slots.some((s) => s.player === p.id))!;
    expect(t.ready(tokenOf(t, stranger.id), m.id, true)).toBe('Das ist nicht deine Partie.');
  });

  it('am Stichtag: kampflos für den, der bereit war; sonst verlieren beide', () => {
    const { t, clock } = setup(8);
    t.start(LEADER);
    const [a, b] = t.view(LEADER).matches;
    t.ready(tokenOf(t, a!.slots[1].player), a!.id, true);
    clock.now += 7 * DAY_MS + 1;
    expect(t.nextWakeup()).toBeLessThan(clock.now);
    expect(t.tick()).toBe(true);
    const view = t.view(LEADER);
    expect(view.matches.find((m) => m.id === a!.id)?.outcome).toMatchObject({ winner: 1, walkover: true });
    expect(view.matches.find((m) => m.id === b!.id)?.outcome).toMatchObject({ winner: null, draw: false, walkover: true });
    // Beide raus: Niemand bekommt Punkte.
    expect(view.groups[b!.group!]!.table.find((r) => r.player === b!.slots[0].player)?.losses).toBeGreaterThan(0);
  });

  it('eine laufende Partie verfällt am Stichtag nicht', () => {
    const { t, clock } = setup(8);
    t.start(LEADER);
    const m = t.view(LEADER).matches[0]!;
    t.ready(tokenOf(t, m.slots[0].player), m.id, true);
    t.ready(tokenOf(t, m.slots[1].player), m.id, true);
    t.roomCreated(m.id, 'raum');
    clock.now += 7 * DAY_MS + 1;
    t.tick();
    expect(t.view(LEADER).matches.find((x) => x.id === m.id)?.status).toBe('running');
    expect(t.report(m.id, 'anderer-raum', { kind: 'played', winner: 0 })).toBe(false);
    expect(t.report(m.id, 'raum', { kind: 'played', winner: 0 })).toBe(true);
  });

  it('kam nur einer in den Raum, gewinnt er kampflos; kam keiner, ist die Partie wieder offen', () => {
    const { t } = setup(8);
    t.start(LEADER);
    const [a, b] = t.view(LEADER).matches;
    for (const m of [a!, b!]) {
      t.ready(tokenOf(t, m.slots[0].player), m.id, true);
      t.ready(tokenOf(t, m.slots[1].player), m.id, true);
      t.roomCreated(m.id, `r-${m.id}`);
    }
    t.report(a!.id, `r-${a!.id}`, { kind: 'noShow', winner: 1 });
    t.report(b!.id, `r-${b!.id}`, { kind: 'noShow', winner: null });
    const view = t.view(LEADER);
    expect(view.matches.find((m) => m.id === a!.id)?.outcome).toMatchObject({ winner: 1, walkover: true });
    expect(view.matches.find((m) => m.id === b!.id)).toMatchObject({ status: 'open', roomCode: null, outcome: null });
  });

  it('eine spät spielbare Partie behält eine Mindestzeit', () => {
    const { t, clock } = setup(8);
    t.start(LEADER);
    const m = t.view(LEADER).matches[0]!;
    t.ready(tokenOf(t, m.slots[0].player), m.id, true);
    t.ready(tokenOf(t, m.slots[1].player), m.id, true);
    t.roomCreated(m.id, 'raum');
    clock.now += 7 * DAY_MS + 1;
    t.report(m.id, 'raum', { kind: 'played', winner: 0 });
    // Alles andere verfällt, die K.-o.-Runde öffnet erst jetzt.
    t.tick();
    const semi = t.view(LEADER).matches.find((x) => x.id === 'k2-0')!;
    expect(semi.openedAt).toBe(clock.now);
    expect(t.view(LEADER).stages[1]!.deadline).toBeGreaterThan(clock.now);
    expect(t.nextWakeup()).toBeGreaterThanOrEqual(clock.now + MATCH_MIN_TIME_MS);
  });
});

describe('Leitung', () => {
  it('kann Stichtage verschieben und Ergebnisse festlegen', () => {
    const { t, clock } = setup(8);
    t.start(LEADER);
    const before = t.view(LEADER).stages[0]!.deadline;
    expect(t.extend(token(0), 3)).toBe('Das darf nur die Leitung.');
    expect(t.extend(LEADER, 3)).toBeNull();
    expect(t.view(LEADER).stages[0]!.deadline).toBe(before + 3 * DAY_MS);
    clock.now += 7 * DAY_MS + 1;
    expect(t.tick()).toBe(false);
    const m = t.view(LEADER).matches[0]!;
    expect(t.setResult(LEADER, m.id, 1)).toBeNull();
    expect(t.view(LEADER).matches[0]!.outcome).toMatchObject({ winner: 1, byLeader: true });
  });

  it('Rückzug: offene Partien gehen an den Gegner, auch im Baum', () => {
    const { t } = setup(8);
    t.start(LEADER);
    const id = t.view(LEADER).players[0]!.id;
    expect(t.withdraw(LEADER, id)).toBeNull();
    const own = t.view(LEADER).matches.filter((m) => m.slots.some((s) => s.player === id));
    expect(own).toHaveLength(3);
    for (const m of own) expect(m.outcome?.walkover).toBe(true);
    for (let i = 0; i < 12 && t.phase === 'running'; i++) playAllOpen(t);
    const end = t.view(LEADER);
    expect(end.phase).toBe('finished');
    expect(end.matches.filter((m) => m.group === null).some((m) => m.slots.some((s) => s.player === id))).toBe(false);
  });

  it('kein Sieger, wenn das Finale niemand antritt, und das Turnier endet trotzdem', () => {
    const { t, clock } = setup(8);
    t.start(LEADER);
    for (let i = 0; i < 6 && t.phase === 'running'; i++) {
      clock.now += 30 * DAY_MS;
      t.tick();
    }
    expect(t.phase).toBe('finished');
    expect(t.view(LEADER).podium).toEqual([]);
    expect(t.expiresAt()).toBe(clock.now + TOURNAMENT_KEEP_MS);
  });

  it('Einmalcode: neues Gerät übernimmt, das alte ist draußen, der Code gilt nur einmal', () => {
    const { t } = setup(8);
    t.start(LEADER);
    const player = t.view(LEADER).players[0]!;
    const oldToken = tokenOf(t, player.id);
    const issued = t.reissue(LEADER, player.id);
    expect(issued).toEqual({ code: 'NEUCODE1' });
    expect(t.reissue(token(1), player.id)).toEqual({ error: 'Das darf nur die Leitung.' });
    const fresh = 'kennung-neues-geraet-01';
    expect(t.maySee(fresh)).toBe(false);
    expect(t.claim(fresh, 'neucode1')).toBeNull();
    expect(t.view(fresh).you).toBe(player.id);
    expect(t.maySee(oldToken)).toBe(false);
    expect(t.claim('kennung-noch-ein-geraet', 'NEUCODE1')).toBe('Dieser Code passt nicht.');
  });
});

describe('Spieloptionen und Regelstand', () => {
  const game = {
    info: { players: { min: 2, max: 2 } },
    options: [
      { id: 'size', label: 'Größe', choices: [{ value: '9', label: '9' }, { value: '13', label: '13' }], default: '9' },
      { id: 'secret', label: 'Geheim', choices: [{ value: 'a', label: 'A' }], default: 'a', hidden: true },
    ],
  } as never;
  const body = { name: 'Cup', gameId: 'go', format: 'world', time: 'normal', days: 7 };

  it('nimmt nur erlaubte Werte sichtbarer Optionen an', () => {
    const find = (id: string) => (id === 'go' ? game : undefined);
    expect(parseTournamentSettings({ ...body, options: { size: '13' } }, find)?.options).toEqual({ size: '13' });
    expect(parseTournamentSettings({ ...body, options: { size: '99' } }, find)).toBeNull();
    expect(parseTournamentSettings({ ...body, options: { secret: 'a' } }, find)).toBeNull();
    expect(parseTournamentSettings({ ...body, gameId: 'unbekannt' }, find)).toBeNull();
    expect(parseTournamentSettings(body, find)?.options).toBeUndefined();
  });

  it('gibt die Optionen an jeden Spielraum weiter', () => {
    const { t } = setup(8, 'world', { options: { size: '13' } });
    t.start(LEADER);
    const m = t.view(LEADER).matches[0]!;
    t.ready(tokenOf(t, m.slots[0].player), m.id, true);
    t.ready(tokenOf(t, m.slots[1].player), m.id, true);
    expect(t.pendingRooms()[0]?.options).toEqual({ size: '13' });
  });

  it('meldet, wenn sich die Regeln seit dem Start geändert haben', () => {
    let version = 3;
    const t = Tournament.create('ABCD2345', 's', { name: 'Cup', gameId: 'chess', format: 'swiss', time: 'normal', days: 7, thirdPlace: false }, { token: LEADER, name: 'L' }, { now: () => 1, randomClaim: () => 'X', ruleVersion: () => version });
    for (let i = 0; i < 4; i++) t.join(token(i), `S${i}`, '🦊');
    t.start(LEADER);
    expect(t.view(LEADER).rulesChanged).toBe(false);
    version = 4;
    expect(t.view(LEADER).rulesChanged).toBe(true);
  });
});

describe('Zugang und Geheimnisse', () => {
  it('nach dem Start sehen nur Eingeschriebene und Leitung die Seite', () => {
    const { t } = setup(8);
    expect(t.maySee('kennung-fremdes-geraet')).toBe(true);
    t.start(LEADER);
    expect(t.maySee('kennung-fremdes-geraet')).toBe(false);
    expect(t.maySee(token(3))).toBe(true);
    expect(t.maySee(LEADER)).toBe(true);
  });

  it('die Sicht enthält keine Kennungen und keinen Seed', () => {
    const { t } = setup(8);
    t.start(LEADER);
    const text = JSON.stringify(t.view(token(0)));
    expect(text).not.toContain('kennung-');
    expect(text).not.toContain('seed-1');
    expect(t.view(token(0)).isLeader).toBe(false);
    expect(t.view(LEADER).isLeader).toBe(true);
  });

  it('übersteht Speichern und Wiederherstellen', () => {
    const { t, clock } = setup(8);
    t.start(LEADER);
    const copy = Tournament.restore(JSON.parse(JSON.stringify(t.snapshot())), { now: () => clock.now, randomClaim: () => 'X' });
    expect(copy.view(LEADER)).toEqual(t.view(LEADER));
  });
});
