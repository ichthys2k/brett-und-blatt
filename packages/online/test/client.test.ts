import { inlineBotRunner, type ClockReading } from '@brett-und-blatt/engine';
import { gameModule as ticTacToe } from '@brett-und-blatt/game-tic-tac-toe';
import { describe, expect, it } from 'vitest';
import { OnlineSession, PROTOCOL_VERSION, Room, extrapolateClock, type ClientMessage, type GameMessage, type ServerMessage } from '../src';

/** Ein Raum und zwei Browser mit OnlineSession – verbunden ohne Netz. */
function setup() {
  let time = 5_000_000;
  const sessions = new Map<string, OnlineSession>();
  const runner = inlineBotRunner([ticTacToe], { timeBudgetMs: 5 });
  const room = new Room('🦊🍎🚀🎈', {
    now: () => time,
    findGame: (id) => (id === 'tic-tac-toe' ? ticTacToe : undefined),
    botRunner: runner,
    randomSeed: () => 'seed',
    send: (connection: string, message: ServerMessage) => {
      if (message.type !== 'game') return;
      const copy = JSON.parse(JSON.stringify(message)) as GameMessage;
      const existing = sessions.get(connection);
      if (existing?.id === `🦊🍎🚀🎈/${copy.round}`) existing.update(copy);
      else
        sessions.set(
          connection,
          new OnlineSession(copy, { module: ticTacToe, roomCode: '🦊🍎🚀🎈', send: (m: ClientMessage) => room.receive(connection, JSON.stringify(m)), botRunner: runner, now: () => time }),
        );
    },
    close: () => {},
  });
  for (const name of ['anna', 'ben']) {
    room.connect(name);
    room.receive(name, JSON.stringify({ type: 'hello', protocol: PROTOCOL_VERSION, token: `token-${name}-0123456789`, name, avatar: '🦊' }));
  }
  const say = (connection: string, message: ClientMessage) => room.receive(connection, JSON.stringify(message));
  say('anna', { type: 'setGame', gameId: 'tic-tac-toe' });
  say('anna', { type: 'setTime', time: 'normal' });
  say('anna', { type: 'takeSeat', index: 0 });
  say('ben', { type: 'takeSeat', index: 1 });
  say('anna', { type: 'start' });
  return { anna: () => sessions.get('anna')!, ben: () => sessions.get('ben')!, say, advance: (ms: number) => (time += ms) };
}

describe('OnlineSession', () => {
  it('kennt nur den eigenen Platz und dessen Züge', () => {
    const { anna, ben } = setup();
    expect(anna().yourSeat).toBe(0);
    expect(anna().humanSeatsToAct()).toEqual([0]);
    expect(ben().humanSeatsToAct()).toEqual([]);
    expect(anna().legalMoves(1)).toEqual([]);
    expect(anna().config.seats.map((s) => s.name)).toEqual(['anna', 'ben']);
    expect(anna().canUndo()).toBe(false);
  });

  it('ein Zug geht über den Server; bis zur Antwort ist kein zweiter möglich', () => {
    const { anna, ben } = setup();
    const session = anna();
    const [first, second] = session.legalMoves(0);
    const changes: number[] = [];
    session.subscribe(() => changes.push(session.version));
    // Hier antwortet der Raum sofort – also gleich danach wieder Bens Zug.
    expect(session.submit(0, first)).toBe(true);
    expect(ben().humanSeatsToAct()).toEqual([1]);
    expect(session.submit(0, second)).toBe(false);
    expect(changes.length).toBeGreaterThanOrEqual(2);
  });

  it('unerlaubte Züge gehen gar nicht erst raus', () => {
    const { anna } = setup();
    expect(anna().submit(0, { cell: 99 })).toBe(false);
    expect(anna().submit(1, anna().legalMoves(0)[0])).toBe(false);
  });

  it('die Uhr zählt zwischen zwei Nachrichten selbst weiter', () => {
    const { anna, advance } = setup();
    expect(anna().clock(0).leftMs).toBe(10_000);
    advance(2500);
    expect(anna().clock(0).leftMs).toBe(7500);
    expect(anna().clock(1).running).toBe(false);
  });

  it('Aufgeben und Tipp', async () => {
    const { anna, ben } = setup();
    const hint = await anna().hint(0);
    expect(anna().legalMoves(0)).toContainEqual(hint);
    expect(await ben().hint(1)).toBeNull();
    ben().resign(1);
    expect(anna().result).toMatchObject({ kind: 'win', winners: [0] });
    expect(anna().currentSeats()).toEqual([]);
  });
});

describe('Uhr weiterzählen', () => {
  const running = (leftMs: number, bankLeftMs: number | null, usingBank = false): ClockReading => ({ kind: 'perMove', running: true, leftMs, bankLeftMs, fraction: 1, usingBank, expired: false });

  it('Zugzeit, dann Zeitbank, dann abgelaufen', () => {
    const control = { kind: 'perMove' as const, moveMs: 10_000, bankMs: 5000 };
    expect(extrapolateClock(running(4000, 5000), control, 1000)).toMatchObject({ leftMs: 3000, usingBank: false });
    expect(extrapolateClock(running(4000, 5000), control, 6000)).toMatchObject({ leftMs: 0, bankLeftMs: 3000, usingBank: true, expired: false });
    expect(extrapolateClock(running(4000, 5000), control, 9500)).toMatchObject({ bankLeftMs: 0, expired: true });
    expect(extrapolateClock(running(0, 2000, true), control, 500)).toMatchObject({ bankLeftMs: 1500 });
  });

  it('Schachuhr und stehende Uhren', () => {
    const chess = { kind: 'chessClock' as const, baseMs: 60_000, incrementMs: 0 };
    const reading: ClockReading = { kind: 'chessClock', running: true, leftMs: 30_000, bankLeftMs: null, fraction: 0.5, usingBank: false, expired: false };
    expect(extrapolateClock(reading, chess, 10_000)).toMatchObject({ leftMs: 20_000, fraction: 20_000 / 60_000 });
    expect(extrapolateClock({ ...reading, running: false }, chess, 10_000)).toMatchObject({ leftMs: 30_000 });
  });
});
