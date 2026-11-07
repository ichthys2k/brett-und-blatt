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
  firstRoundSlots,
  roundRobinPairs,
  seedOrder,
  swissPairing,
  swissRoundsFor,
  parseTournamentSettings,
  FORMATS,
  defaultScoring,
  standings,
  type TournamentSnapshotV1,
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

describe('K.-o.', () => {
  it('Setzliste: Die Besten treffen sich zuletzt', () => {
    expect(seedOrder(4)).toEqual([0, 3, 1, 2]);
    const slots = firstRoundSlots(['a', 'b', 'c', 'd', 'e']);
    expect(slots).toHaveLength(4);
    expect(slots.filter(([, b]) => b.player === null)).toHaveLength(3);
    expect(slots.every(([a]) => a.player !== null)).toBe(true);
  });

  for (const players of [4, 5, 7, 8, 13, 32]) {
    it(`spielt ${players} Spieler durch: ${players - 1} echte Partien, ein Sieger`, () => {
      const { t } = setup(players, 'knockout');
      t.start(LEADER);
      for (let i = 0; i < 12 && t.phase === 'running'; i++) playAllOpen(t);
      const end = t.view(LEADER);
      expect(end.phase).toBe('finished');
      expect(end.matches.filter((m) => !m.outcome?.bye)).toHaveLength(players - 1);
      expect(end.podium).toHaveLength(2);
    });
  }

  it('ein Freilos ist kein kampfloser Sieg gegen jemanden und spielt um Platz 3 auf Wunsch', () => {
    const { t } = setup(5, 'knockout', { thirdPlace: true });
    t.start(LEADER);
    const byes = t.view(LEADER).matches.filter((m) => m.outcome?.bye);
    expect(byes).toHaveLength(3);
    for (let i = 0; i < 12 && t.phase === 'running'; i++) playAllOpen(t);
    expect(t.view(LEADER).podium).toHaveLength(3);
  });

  it('Remis gibt ein Entscheidungsspiel', () => {
    const { t } = setup(4, 'knockout');
    t.start(LEADER);
    const m = t.view(LEADER).matches[0]!;
    play(t, m, null);
    expect(t.view(LEADER).matches[0]).toMatchObject({ status: 'open', replays: 1 });
    expect(t.setResult(LEADER, m.id, 'draw')).toBe('Im K.-o.-Spiel braucht es einen Sieger.');
  });
});

describe('Doppel-K.-o.', () => {
  /** Wie oft jeder echt verloren hat. */
  const losses = (t: Tournament) => {
    const count = new Map<string, number>();
    for (const m of t.view(LEADER).matches) {
      const o = m.outcome;
      if (!o || o.winner === null || o.bye) continue;
      const loser = m.slots[1 - o.winner]!.player!;
      count.set(loser, (count.get(loser) ?? 0) + 1);
    }
    return count;
  };

  for (const players of [4, 5, 6, 7, 8, 11, 16, 32]) {
    it(`${players} Spieler: Ausscheiden erst bei der zweiten Niederlage`, () => {
      const { t } = setup(players, 'double');
      t.start(LEADER);
      for (let i = 0; i < 80 && t.phase === 'running'; i++) playAllOpen(t);
      const end = t.view(LEADER);
      expect(end.phase).toBe('finished');
      const count = losses(t);
      const champion = end.podium[0]!;
      expect(count.get(champion) ?? 0).toBe(0);
      expect([...count.values()].every((n) => n <= 2)).toBe(true);
      // Hier gewinnt immer die obere Seite: Alle außer dem Sieger haben genau zwei Niederlagen.
      expect([...count.values()].filter((n) => n === 2)).toHaveLength(players - 1);
      expect(end.podium).toHaveLength(3);
      expect(new Set(end.podium).size).toBe(3);
      expect(end.matches.filter((m) => !m.outcome?.bye)).toHaveLength(2 * players - 2);
    });
  }

  it('gewinnt der Herausforderer das Große Finale, folgt eine Entscheidungspartie', () => {
    const { t } = setup(4, 'double');
    t.start(LEADER);
    for (let i = 0; i < 12; i++) {
      const open = t.view(LEADER).matches.filter((m) => m.status === 'open' && m.id !== 'gf');
      if (open.length === 0) break;
      for (const m of open) play(t, m, 0);
    }
    const final = t.view(LEADER).matches.find((m) => m.id === 'gf')!;
    expect(final.status).toBe('open');
    play(t, final, 1);
    expect(t.phase).toBe('running');
    const decider = t.view(LEADER).matches.find((m) => m.id === 'gf2')!;
    expect(decider.slots.map((s) => s.player)).toEqual(final.slots.map((s) => s.player));
    expect(t.setResult(LEADER, 'gf', 0)).toBe('Daran hängen schon weitere Partien.');
    play(t, decider, 1);
    const end = t.view(LEADER);
    expect(end.phase).toBe('finished');
    expect(end.podium[0]).toBe(final.slots[1].player);
    expect(end.podium[1]).toBe(final.slots[0].player);
  });

  it('gewinnt der Ungeschlagene, ist sofort Schluss', () => {
    const { t } = setup(4, 'double');
    t.start(LEADER);
    for (let i = 0; i < 12 && t.phase === 'running'; i++) playAllOpen(t);
    expect(t.view(LEADER).matches.some((m) => m.id === 'gf2')).toBe(false);
    expect(t.phase).toBe('finished');
  });

  it('nach einer Niederlage geht es in der Verliererrunde weiter', () => {
    const { t } = setup(8, 'double');
    t.start(LEADER);
    const w1 = t.view(LEADER).matches.filter((m) => m.id.startsWith('w1-'));
    for (const m of w1) play(t, m, 0);
    const after = t.view(LEADER).matches;
    expect(after.find((m) => m.id === 'l1-0')?.slots.map((s) => s.player)).toEqual([w1[0]!.slots[1].player, w1[1]!.slots[1].player]);
    expect(after.find((m) => m.id === 'w2-0')?.slots.map((s) => s.player)).toEqual([w1[0]!.slots[0].player, w1[1]!.slots[0].player]);
    expect(after.find((m) => m.id === 'l1-0')?.status).toBe('open');
  });

  it('Rückzug und Stichtage bringen das Turnier trotzdem zu Ende', () => {
    const { t, clock } = setup(6, 'double');
    t.start(LEADER);
    t.withdraw(LEADER, t.view(LEADER).players[0]!.id);
    for (let i = 0; i < 12 && t.phase === 'running'; i++) {
      clock.now += 30 * DAY_MS;
      t.tick();
    }
    expect(t.phase).toBe('finished');
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

  it('schreibt sich öffentlich aus, solange man sich einschreiben kann', () => {
    const { t } = setup(3, 'swiss');
    expect(t.publicListing()).toMatchObject({ code: 'ABCD2345', tournament: true, gameName: 'Testcup', filledSeats: 3, hostName: 'Leitung' });
    expect(setup(3, 'swiss', { isPublic: false }).t.publicListing()).toBeNull();
    const full = setup(4, 'swiss');
    expect(full.t.start(LEADER)).toBeNull();
    expect(full.t.publicListing()).toBeNull();
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

describe('Umbau (W-058 Stufe 0)', () => {
  it('ein gespeichertes Turnier von Version 1 spielt unverändert weiter', () => {
    const { t, clock } = setup(8, 'swiss');
    t.start(LEADER);
    playAllOpen(t, 0);
    const { version: _v, scoring: _s, ...rest } = JSON.parse(JSON.stringify(t.snapshot()));
    const old: TournamentSnapshotV1 = { ...rest, version: 1 };
    const copy = Tournament.restore(old, { now: () => clock.now, randomClaim: () => 'X' });
    expect(copy.snapshot().version).toBe(2);
    expect(copy.snapshot().scoring).toEqual(defaultScoring('swiss'));
    expect(copy.view(LEADER)).toEqual(t.view(LEADER));
    playAllOpen(copy, 1);
    playAllOpen(t, 1);
    expect(copy.view(LEADER)).toEqual(t.view(LEADER));
  });

  it('jede Form nennt ihre Mindestzahl', () => {
    expect(Object.fromEntries(Object.entries(FORMATS).map(([id, f]) => [id, f.minPlayers]))).toEqual({ world: 6, knockout: 4, double: 4, swiss: 4, league: 3 });
  });

  it('die Wertung kennt Spielstand, Tordifferenz und erzielte Tore', () => {
    const match = (id: string, a: string, b: string, score: [number, number]): TournamentMatch => ({
      id, stage: 0, group: 0, slots: [{ player: a }, { player: b }], status: 'done', openedAt: 0, readyAt: [null, null], everReady: [true, true], roomCode: null, replays: 0,
      outcome: { winner: score[0] > score[1] ? 0 : score[0] < score[1] ? 1 : null, draw: score[0] === score[1], walkover: false, score },
    });
    // a und b gewinnen je eine Partie und spielen unentschieden; a mit höherer Differenz, c verliert alles.
    const matches = [match('1', 'a', 'c', [5, 0]), match('2', 'b', 'c', [2, 1]), match('3', 'a', 'b', [1, 1])];
    const rules = { win: 3, draw: 1, loss: 0, tiebreaks: ['difference' as const, 'scored' as const] };
    const table = standings(['b', 'c', 'a'], matches, 'seed', rules);
    expect(table.map((r) => r.player)).toEqual(['a', 'b', 'c']);
    expect(table[0]).toMatchObject({ points: 4, scored: 6, conceded: 1 });
    expect(table[2]).toMatchObject({ points: 0, scored: 1, conceded: 7 });
  });
});
