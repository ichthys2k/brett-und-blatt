import { inlineBotRunner } from '@brett-und-blatt/engine';
import { gameModule as ticTacToe } from '@brett-und-blatt/game-tic-tac-toe';
import { describe, expect, it } from 'vitest';
import { MATCH_ARRIVAL_MS, MATCH_AWAY_MS, PROTOCOL_VERSION, Room, type RoomDeps, type RoomMessage, type ServerMessage } from '../src';

const A = 'kennung-spieler-a-0001';
const B = 'kennung-spieler-b-0002';

function setup() {
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
  const room = new Room('🦊🦊🦊🦊', deps, false);
  expect(room.setupMatch({ tournament: 'ABCD2345', match: 'g0-0', gameId: ticTacToe.info.id, time: 'relaxed', tokens: [A, B], label: 'Cup' })).toBe(true);
  const enter = (connection: string, token: string) => {
    room.connect(connection);
    room.receive(connection, JSON.stringify({ type: 'hello', protocol: PROTOCOL_VERSION, token, name: 'Anna', avatar: '🦊' }));
  };
  const last = (connection: string, type: ServerMessage['type']) => sent.get(connection)?.filter((m) => m.type === type).at(-1);
  return { room, clock, enter, last };
}

describe('Turnierpartie im Raum', () => {
  it('startet von selbst, sobald beide da sind, in der festen Sitzordnung und ohne Raumleitung', () => {
    const { room, enter, last } = setup();
    enter('b', B);
    expect((last('b', 'room') as RoomMessage).phase).toBe('lobby');
    expect((last('b', 'room') as RoomMessage).hostId).toBeNull();
    enter('a', A);
    const message = last('a', 'room') as RoomMessage;
    expect(message.phase).toBe('playing');
    expect(message.match?.tournament).toBe('ABCD2345');
    expect(room.snapshot().game?.seatMembers).toEqual([room.snapshot().members.find((m) => m.token === A)?.id, room.snapshot().members.find((m) => m.token === B)?.id]);
  });

  it('Zuschauer können keinen Platz nehmen', () => {
    const { room, enter, last } = setup();
    enter('s', 'kennung-zuschauer-0003');
    room.receive('s', JSON.stringify({ type: 'takeSeat', index: 0 }));
    expect(last('s', 'error')).toBeTruthy();
    expect((last('s', 'room') as RoomMessage).lobby.seats[0]).toMatchObject({ memberId: null });
  });

  it('meldet das Ergebnis genau einmal: Aufgeben gibt dem Gegner den Sieg', () => {
    const { room, enter } = setup();
    enter('a', A);
    enter('b', B);
    expect(room.matchReport()).toBeNull();
    room.receive('b', JSON.stringify({ type: 'resign' }));
    expect(room.matchReport()).toEqual({ tournament: 'ABCD2345', match: 'g0-0', report: { kind: 'played', winner: 0 } });
    room.markMatchReported();
    expect(room.matchReport()).toBeNull();
    // Keine Revanche: Es gibt keine Raumleitung.
    room.receive('a', JSON.stringify({ type: 'start' }));
    expect(room.snapshot().rounds).toBe(1);
  });

  it('kam nur einer, gewinnt er nach der Wartezeit kampflos; kam keiner, meldet der Raum das', () => {
    const one = setup();
    one.enter('b', B);
    expect(one.room.nextWakeup()).toBe(1000 + MATCH_ARRIVAL_MS);
    one.clock.now += MATCH_ARRIVAL_MS;
    one.room.tick();
    expect(one.room.matchReport()?.report).toEqual({ kind: 'noShow', winner: 1 });
    const none = setup();
    none.clock.now += MATCH_ARRIVAL_MS;
    none.room.tick();
    expect(none.room.matchReport()?.report).toEqual({ kind: 'noShow', winner: null });
  });

  it('kein Bot: Wer zu lange weg ist, verliert; wer rechtzeitig zurückkommt, spielt weiter', () => {
    const { room, clock, enter } = setup();
    enter('a', A);
    enter('b', B);
    room.disconnect('a');
    expect(room.nextWakeup()).toBe(clock.now + MATCH_AWAY_MS);
    clock.now += MATCH_AWAY_MS - 1;
    room.tick();
    expect(room.matchReport()).toBeNull();
    enter('a2', A);
    clock.now += MATCH_AWAY_MS;
    room.tick();
    expect(room.matchReport()).toBeNull();
    room.disconnect('b');
    clock.now += MATCH_AWAY_MS;
    room.tick();
    expect(room.matchReport()?.report).toEqual({ kind: 'played', winner: 0 });
  });

  it('übersteht das Schlafen und nimmt das Melden wieder auf', () => {
    const { room, clock, enter } = setup();
    enter('a', A);
    enter('b', B);
    room.receive('a', JSON.stringify({ type: 'resign' }));
    const copy = Room.restore(JSON.parse(JSON.stringify(room.snapshot())), { now: () => clock.now, findGame: () => ticTacToe, botRunner: inlineBotRunner([ticTacToe]), randomSeed: () => 'x', send: () => {}, close: () => {} });
    expect(copy.matchReport()?.report).toEqual({ kind: 'played', winner: 1 });
  });
});
