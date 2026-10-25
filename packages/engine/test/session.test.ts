import { describe, expect, it } from 'vitest';
import { AWAY_AFTER_TIMEOUTS, LocalSession, inlineBotRunner, type BotRunner, type SessionConfig } from '../src';
import { nim } from './nim';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function makeSession(overrides: Partial<SessionConfig> = {}, runner: BotRunner = inlineBotRunner([nim])) {
  let time = 0;
  const config: SessionConfig = {
    gameId: 'nim',
    seats: [
      { kind: 'human', name: 'Anna' },
      { kind: 'human', name: 'Ben' },
    ],
    options: {},
    seed: 'test',
    time: { kind: 'none' },
    ...overrides,
  };
  const session = new LocalSession(nim, config, { botRunner: runner, now: () => time });
  return { session, advanceTime: (ms: number) => (time += ms) };
}

describe('LocalSession', () => {
  it('nimmt erlaubte Züge an und lehnt unerlaubte ab', () => {
    const { session } = makeSession();
    expect(session.submit(1, { take: 1 })).toBe(false);
    expect(session.submit(0, { take: 4 })).toBe(false);
    expect(session.submit(0, { take: 3 })).toBe(true);
    expect(session.state).toMatchObject({ left: 7, turn: 1 });
    expect(session.log).toHaveLength(1);
  });

  it('lässt den Bot ziehen, wenn er dran ist', async () => {
    const { session } = makeSession({
      seats: [
        { kind: 'human', name: 'Anna' },
        { kind: 'bot', name: 'Bot', level: 'hard' },
      ],
    });
    session.submit(0, { take: 1 });
    expect(session.isThinking(1)).toBe(true);
    await flush();
    // Perfektes Spiel: auf 9 lässt der Bot 8 übrig.
    expect(session.state.left).toBe(8);
    expect(session.log.at(-1)?.cause).toBe('bot');
  });

  it('nimmt mit „Zug zurück“ den letzten Menschenzug samt Bot-Antwort zurück', async () => {
    const { session } = makeSession({
      seats: [
        { kind: 'human', name: 'Anna' },
        { kind: 'bot', name: 'Bot', level: 'easy' },
      ],
    });
    session.submit(0, { take: 2 });
    await flush();
    expect(session.log).toHaveLength(2);
    expect(session.undo()).toBe(true);
    expect(session.log).toHaveLength(0);
    expect(session.state.left).toBe(10);
    expect(session.humanSeatsToAct()).toEqual([0]);
  });

  it('lässt bei Zeitablauf den Bot ziehen und übernimmt nach drei Ablaufen den Platz', async () => {
    const { session, advanceTime } = makeSession({ time: { kind: 'perMove', moveMs: 1_000 }, options: { heap: '21' } });
    for (let i = 0; i < AWAY_AFTER_TIMEOUTS * 2; i++) {
      advanceTime(1_001);
      session.tick();
      await flush();
    }
    expect(session.log.slice(0, AWAY_AFTER_TIMEOUTS * 2).every((entry) => entry.cause !== 'player')).toBe(true);
    expect(session.isAway(0)).toBe(true);
    expect(session.isAway(1)).toBe(true);
    await flush();
    await flush();
    // Abwesende Plätze spielt der Bot ohne Wartezeit zu Ende.
    for (let i = 0; i < 30 && !session.result; i++) await flush();
    expect(session.result?.kind).toBe('win');
  });

  it('wer zurückkommt, übernimmt seinen Platz wieder', async () => {
    const { session, advanceTime } = makeSession({
      time: { kind: 'perMove', moveMs: 1_000 },
      options: { heap: '21' },
      seats: [
        { kind: 'human', name: 'Anna' },
        { kind: 'bot', name: 'Bot', level: 'easy' },
      ],
    });
    // Anna lässt dreimal die Zeit ablaufen.
    for (let i = 0; i < AWAY_AFTER_TIMEOUTS && !session.isAway(0); i++) {
      advanceTime(1_001);
      session.tick();
      await flush();
      await flush();
    }
    expect(session.isAway(0)).toBe(true);
    session.pause();
    session.returnSeat(0);
    session.resume();
    await flush();
    if (!session.result) expect(session.humanSeatsToAct()).toEqual(session.currentSeats().includes(0) ? [0] : []);
  });

  it('Schachuhr: Wer die Zeit überschreitet, verliert', () => {
    const { session, advanceTime } = makeSession({ time: { kind: 'chessClock', baseMs: 5_000, incrementMs: 0 } });
    advanceTime(5_001);
    session.tick();
    expect(session.result).toEqual({ kind: 'win', winners: [1], reason: 'time' });
  });

  it('Pause hält die Uhr an', () => {
    const { session, advanceTime } = makeSession({ time: { kind: 'perMove', moveMs: 1_000 } });
    advanceTime(500);
    session.pause();
    advanceTime(10_000);
    session.tick();
    expect(session.log).toHaveLength(0);
    expect(session.submit(0, { take: 1 })).toBe(false);
    session.resume();
    expect(session.clock(0).leftMs).toBe(500);
  });

  it('Aufgeben beendet die Partie für die anderen', () => {
    const { session } = makeSession();
    session.resign(0);
    expect(session.result).toEqual({ kind: 'win', winners: [1], reason: 'resign' });
    expect(session.submit(0, { take: 1 })).toBe(false);
  });

  it('lässt sich aus einem Schnappschuss wiederherstellen', () => {
    const { session } = makeSession();
    session.submit(0, { take: 3 });
    session.submit(1, { take: 2 });
    const restored = LocalSession.restore(nim, JSON.parse(JSON.stringify(session.snapshot())), { botRunner: inlineBotRunner([nim]) });
    expect(restored.state).toEqual(session.state);
    expect(restored.log).toEqual(session.log);
  });

  it('greift auf einen Zufallszug zurück, wenn der Bot ausfällt', async () => {
    const broken: BotRunner = { requestMove: () => Promise.reject(new Error('kaputt')) };
    const { session } = makeSession({ seats: [{ kind: 'bot', name: 'A' }, { kind: 'human', name: 'B' }] }, broken);
    await flush();
    expect(session.log).toHaveLength(1);
    expect(session.humanSeatsToAct()).toEqual([1]);
  });
});

describe('LocalSession für den Server', () => {
  function serverSession(graceMs: number, botBudgetMs?: { easy: number }) {
    let time = 0;
    const requests: number[] = [];
    const runner = inlineBotRunner([nim]);
    const session = new LocalSession(
      nim,
      {
        gameId: 'nim',
        seats: [
          { kind: 'human', name: 'Anna' },
          { kind: 'bot', name: 'Bot', level: 'easy' },
        ],
        options: {},
        seed: 'test',
        time: { kind: 'perMove', moveMs: 1000, bankMs: 500 },
      },
      {
        botRunner: { requestMove: (r) => (requests.push(r.timeBudgetMs), runner.requestMove(r)) },
        now: () => time,
        graceMs,
        botBudgetMs,
      },
    );
    return { session, requests, advanceTime: (ms: number) => (time += ms) };
  }

  it('nennt den Zeitpunkt des nächsten Zeitablaufs – mit Zeitbank und Kulanz', () => {
    const { session } = serverSession(200);
    expect(session.nextDeadline()).toBe(1000 + 500 + 200 + 1);
  });

  it('Zeitablauf erst nach der Kulanz', async () => {
    const { session, advanceTime } = serverSession(200);
    advanceTime(1700);
    session.tick();
    expect(session.log).toHaveLength(0);
    advanceTime(1);
    session.tick();
    await flush();
    expect(session.log[0]?.cause).toBe('timeout');
  });

  it('markAway: Ein Bot übernimmt den Platz, bis der Mensch zurückkommt', async () => {
    const { session } = serverSession(0);
    session.markAway(0);
    expect(session.isAway(0)).toBe(true);
    expect(session.nextDeadline()).toBeNull();
    await flush();
    expect(session.log[0]?.cause).toBe('bot');
    session.returnSeat(0);
    expect(session.isAway(0)).toBe(false);
  });

  it('die Bedenkzeit der Bots lässt sich begrenzen', async () => {
    const { session, requests } = serverSession(0, { easy: 80 });
    session.submit(0, { take: 1 });
    await flush();
    expect(requests[0]).toBe(80);
  });
});
