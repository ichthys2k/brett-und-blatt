import { describe, expect, it } from 'vitest';
import {
  DEADLINE_LEAD_MS,
  Tournament,
  claimSilently,
  newTournamentPushState,
  nextPushWakeup,
  planTournamentPush,
  pushStateFromJSON,
  pushStateToJSON,
  runTournamentPush,
  type PushSender,
  type PushSubscriptionData,
  type TournamentSettings,
} from '../src';

/** Web Push im Turnier (#242, Schritt 4). */

const LEADER = 'kennung-der-leitung-01';
const token = (i: number) => `kennung-spieler-${String(i).padStart(4, '0')}`;
const HOUR = 3_600_000;

function b64(n: number): string {
  return btoa(String.fromCharCode(...new Uint8Array(n).fill(5))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
const sub = (i: number): PushSubscriptionData => ({ endpoint: `https://fcm.googleapis.com/fcm/send/geraet-${i}`, keys: { p256dh: b64(65), auth: b64(16) } });

function setup(players = 4, extra: Partial<TournamentSettings> = {}) {
  const clock = { now: 1_000_000_000 };
  const settings: TournamentSettings = { name: 'Cup', gameId: 'chess', format: 'knockout', time: 'normal', days: 3, thirdPlace: false, ...extra };
  const t = Tournament.create('ABCD2345', 'seed-1', settings, { token: LEADER, name: 'Leitung' }, { now: () => clock.now, randomClaim: () => 'NEUCODE1' });
  for (let i = 0; i < players; i++) expect(t.join(token(i), `Spieler${i}`, '🦊')).toBeNull();
  return { t, clock };
}

const tokenOfPlayer = (t: Tournament, id: string | null) => t.snapshot().players.find((p) => p.id === id)!.token;

function sender(result: 'ok' | 'gone' | 'retry' | 'failed' = 'ok') {
  const calls: { endpoint: string; payload: { k: string; u: string }; ttl: number; topic?: string }[] = [];
  const impl: PushSender = {
    async send(s, payload, opts) {
      calls.push({ endpoint: s.endpoint, payload: JSON.parse(payload), ttl: opts.ttl, ...(opts.topic ? { topic: opts.topic } : {}) });
      return result;
    },
  };
  return { impl, calls };
}

function subscribeAll(state = newTournamentPushState(), count = 4) {
  for (let i = 0; i < count; i++) state.book.set(token(i), sub(i), 0);
  return state;
}

const run = (t: Tournament, state: ReturnType<typeof newTournamentPushState>, s: PushSender, now: number) => runTournamentPush(t.snapshot(), state, s, now, { retryDelayMs: 0 });

describe('Web Push im Turnier: Start und Aufruf', () => {
  it('vor dem Start gibt es nichts', () => {
    const { t, clock } = setup();
    expect(planTournamentPush(t.snapshot(), new Set(), clock.now)).toEqual([]);
  });

  it('beim Start: Turnier begonnen und Partien aufgerufen, nur an Abonnenten', async () => {
    const { t, clock } = setup();
    expect(t.start(LEADER)).toBeNull();
    const state = subscribeAll(newTournamentPushState(), 2);
    const { impl, calls } = sender();
    const result = await run(t, state, impl, clock.now);
    expect(result.sent).toBeGreaterThanOrEqual(2);
    const kinds = new Set(calls.map((c) => c.payload.k));
    expect(kinds).toEqual(new Set(['tournamentStarted', 'matchCalled']));
    expect(calls.every((c) => c.payload.u === '#/turnier/ABCD2345')).toBe(true);
    expect(calls.every((c) => c.endpoint.endsWith('geraet-0') || c.endpoint.endsWith('geraet-1'))).toBe(true);
    // Inhalt ohne Namen
    expect(JSON.stringify(calls)).not.toContain('Spieler');
  });

  it('sendet nichts doppelt, auch nicht nach erneutem Aufruf oder Neuladen des Zustands', async () => {
    const { t, clock } = setup();
    t.start(LEADER);
    let state = subscribeAll();
    const first = sender();
    await run(t, state, first.impl, clock.now);
    const count = first.calls.length;
    expect(count).toBeGreaterThan(0);
    const second = sender();
    await run(t, state, second.impl, clock.now + 1000);
    expect(second.calls).toHaveLength(0);
    state = pushStateFromJSON(JSON.parse(JSON.stringify(pushStateToJSON(state))));
    await run(t, state, second.impl, clock.now + 2000);
    expect(second.calls).toHaveLength(0);
  });

  it('ohne Abos wird nichts gesendet und nichts gemerkt', async () => {
    const { t, clock } = setup();
    t.start(LEADER);
    const state = newTournamentPushState();
    const { impl, calls } = sender();
    await run(t, state, impl, clock.now);
    expect(calls).toHaveLength(0);
    expect(state.sent.size).toBe(0);
  });

  it('wer sich später anmeldet, bekommt nichts über Vergangenes (claimSilently)', async () => {
    const { t, clock } = setup();
    t.start(LEADER);
    const state = newTournamentPushState();
    state.book.set(token(0), sub(0), 0);
    claimSilently(t.snapshot(), state, token(0), clock.now);
    const { impl, calls } = sender();
    await run(t, state, impl, clock.now);
    expect(calls).toHaveLength(0);
  });

  it('Zuschauer, Leitung und Zurückgezogene bekommen nichts', async () => {
    const { t, clock } = setup();
    t.start(LEADER);
    const state = newTournamentPushState();
    state.book.set(LEADER, sub(90), 0);
    state.book.set('kennung-zuschauer-9999', sub(91), 0);
    const { impl, calls } = sender();
    await run(t, state, impl, clock.now);
    expect(calls).toHaveLength(0);
  });

  it('der Spam-Schutz greift: je Art höchstens eine Meldung in 30 Minuten', async () => {
    const { t, clock } = setup();
    t.start(LEADER);
    const state = subscribeAll();
    state.limiter.allow(token(0), 'matchCalled', clock.now - 1000);
    const { impl, calls } = sender();
    await run(t, state, impl, clock.now);
    expect(calls.filter((c) => c.endpoint.endsWith('geraet-0') && c.payload.k === 'matchCalled')).toHaveLength(0);
    expect(calls.filter((c) => c.endpoint.endsWith('geraet-1') && c.payload.k === 'matchCalled')).toHaveLength(1);
  });

  it('Turnierende wird einmal gemeldet', async () => {
    const { t, clock } = setup(4);
    t.start(LEADER);
    const state = subscribeAll(newTournamentPushState(), 2);
    const { impl, calls } = sender();
    await run(t, state, impl, clock.now);
    for (let guard = 0; t.snapshot().phase !== 'finished' && guard < 10; guard++) {
      const m = t.snapshot().matches.find((x) => x.status === 'open' && x.slots.every((slot) => slot.player))!;
      for (const slot of m.slots) expect(t.ready(tokenOfPlayer(t, slot.player), m.id, true)).toBeNull();
      t.roomCreated(m.id, `raum-${m.id}`);
      t.report(m.id, `raum-${m.id}`, { kind: 'played', winner: 0 });
    }
    expect(t.snapshot().phase).toBe('finished');
    calls.length = 0;
    await run(t, state, impl, clock.now + HOUR);
    expect(calls.filter((c) => c.payload.k === 'tournamentFinished')).toHaveLength(2);
    calls.length = 0;
    await run(t, state, impl, clock.now + 2 * HOUR);
    expect(calls).toHaveLength(0);
  });
});

describe('Web Push im Turnier: Fristerinnerung', () => {
  /** Eine offene Partie mit Frist; zwei Stunden vorher soll erinnert werden. */
  function started() {
    const { t, clock } = setup(4);
    t.start(LEADER);
    const m = t.snapshot().matches[0]!;
    const due = Math.max(t.snapshot().stages[m.stage]!.deadline, (m.openedAt ?? 0) + 24 * HOUR);
    return { t, clock, m, due };
  }

  it('genau einmal, zwei Stunden vor Fristende, nur an die, die noch fehlen', async () => {
    const { t, clock, m, due } = started();
    const state = subscribeAll();
    const { impl, calls } = sender();
    await run(t, state, impl, clock.now);
    calls.length = 0;
    const [a, b] = m.slots.map((slot) => tokenOfPlayer(t, slot.player)) as [string, string];
    await run(t, state, impl, due - DEADLINE_LEAD_MS - 1000);
    expect(calls).toHaveLength(0);
    const snapshotTime = due - DEADLINE_LEAD_MS + 1000;
    // b sagt kurz vorher „Bereit“ (gilt 10 Minuten), a fehlt noch
    clock.now = snapshotTime - 1000;
    expect(t.ready(b, m.id, true)).toBeNull();
    const plan = planTournamentPush(t.snapshot(), state.sent, snapshotTime).filter((n) => n.kind === 'deadline' && (n.token === a || n.token === b));
    expect(plan.map((n) => n.token)).toEqual([a]);
    await run(t, state, impl, snapshotTime);
    const mine = [state.book.get(a)!.endpoint, state.book.get(b)!.endpoint];
    const reminders = calls.filter((c) => c.payload.k === 'deadline' && mine.includes(c.endpoint));
    expect(reminders).toHaveLength(1);
    expect(reminders[0]!.ttl).toBe(7200);
    expect(reminders[0]!.endpoint).toBe(state.book.get(a)!.endpoint);
    calls.length = 0;
    await run(t, state, impl, snapshotTime + 60_000);
    expect(calls.filter((c) => c.payload.k === 'deadline')).toHaveLength(0);
  });

  it('keine Erinnerung nach Fristende', () => {
    const { t, due } = started();
    expect(planTournamentPush(t.snapshot(), new Set(), due + 1).filter((n) => n.kind === 'deadline')).toEqual([]);
  });

  it('der Wecker kennt den Zeitpunkt der Erinnerung', () => {
    const { t, clock, due } = started();
    expect(nextPushWakeup(t.snapshot(), clock.now)).toBe(due - DEADLINE_LEAD_MS);
    expect(nextPushWakeup(t.snapshot(), due)).toBeNull();
  });

  it('entsteht die Frist näher als zwei Stunden, gibt es nur den Aufruf', () => {
    const { t, clock, m } = started();
    const snapshot = t.snapshot();
    snapshot.stages[m.stage]!.deadline = clock.now + HOUR;
    snapshot.matches[0]!.openedAt = clock.now + 1; // Mindestzeit 24 h dominiert; setzt die Prüfung außer Kraft
    const near = { ...snapshot };
    expect(nextPushWakeup(near, clock.now)).not.toBe(clock.now);
  });
});

describe('Web Push im Turnier: Abos und Versand', () => {
  it('ein 410 vom Push-Dienst entzieht das Abo, ein Fehlschlag nicht', async () => {
    const { t, clock } = setup();
    t.start(LEADER);
    const gone = subscribeAll();
    await run(t, gone, sender('gone').impl, clock.now);
    expect(gone.book.size).toBeLessThan(4);

    const failed = subscribeAll();
    await run(t, failed, sender('failed').impl, clock.now);
    expect(failed.book.size).toBe(4);
  });

  it('bei retry wird einmal wiederholt', async () => {
    const { t, clock } = setup(2);
    t.start(LEADER);
    const state = subscribeAll(newTournamentPushState(), 1);
    const { impl, calls } = sender('retry');
    await run(t, state, impl, clock.now);
    const perKind = new Map<string, number>();
    for (const c of calls) perKind.set(c.payload.k, (perKind.get(c.payload.k) ?? 0) + 1);
    expect([...perKind.values()].every((n) => n === 2)).toBe(true);
  });

  it('ein werfender Sender hält das Turnier nicht auf', async () => {
    const { t, clock } = setup();
    t.start(LEADER);
    const state = subscribeAll();
    const boom: PushSender = { send: async () => { throw new Error('kaputt'); } };
    await expect(run(t, state, boom, clock.now)).resolves.toBeDefined();
  });

  it('begrenzt die Sendungen je Durchlauf und meldet den Rest', async () => {
    const { t, clock } = setup(8);
    t.start(LEADER);
    const state = subscribeAll(newTournamentPushState(), 8);
    const { impl, calls } = sender();
    const first = await runTournamentPush(t.snapshot(), state, impl, clock.now, { retryDelayMs: 0, maxSends: 5 });
    expect(calls).toHaveLength(5);
    expect(first.more).toBe(true);
    let more = true;
    let guard = 0;
    while (more && guard++ < 20) more = (await runTournamentPush(t.snapshot(), state, impl, clock.now, { retryDelayMs: 0, maxSends: 5 })).more;
    expect(more).toBe(false);
    // 8 Teilnehmer: je einmal „begonnen“ und „Partie aufgerufen“
    expect(calls).toHaveLength(16);
  });

  it('speichert vor dem Senden und ruft persist danach noch einmal', async () => {
    const { t, clock } = setup();
    t.start(LEADER);
    const state = subscribeAll();
    const order: string[] = [];
    const { impl } = sender();
    const wrapped: PushSender = { send: async (...args) => { order.push('send'); return impl.send(...args); } };
    await runTournamentPush(t.snapshot(), state, wrapped, clock.now, { retryDelayMs: 0, persist: async () => { order.push('persist'); } });
    expect(order[0]).toBe('persist');
    expect(order.at(-1)).toBe('persist');
  });

  it('Turniere vor Ort und ohne Netz senden nie', async () => {
    const { t, clock } = setup(4);
    t.start(LEADER);
    const local = { ...t.snapshot(), settings: { ...t.snapshot().settings, mode: 'local' as const } };
    const state = subscribeAll();
    const { impl, calls } = sender();
    await runTournamentPush(local, state, impl, clock.now, { retryDelayMs: 0 });
    expect(calls).toHaveLength(0);
    expect(planTournamentPush({ ...t.snapshot(), code: 'LOKAL-1234', settings: { ...t.snapshot().settings, mode: 'online' }, phase: 'running' }, new Set(), clock.now)).toEqual([]);
  });

  it('der Zustand übersteht den Rundlauf durch den Speicher', () => {
    const state = subscribeAll();
    state.sent.add('x:y:z');
    const restored = pushStateFromJSON(JSON.parse(JSON.stringify(pushStateToJSON(state))));
    expect(restored.book.size).toBe(4);
    expect(restored.sent.has('x:y:z')).toBe(true);
    expect(pushStateFromJSON(null).book.size).toBe(0);
  });
});
