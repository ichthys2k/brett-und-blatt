import { inlineBotRunner } from '@brett-und-blatt/engine';
import { gameModule as ticTacToe } from '@brett-und-blatt/game-tic-tac-toe';
import { describe, expect, it } from 'vitest';
import { PROTOCOL_VERSION, Room, parseClientMessage, type RoomDeps, type RoomMessage, type ServerMessage } from '../src';

const TOKEN = 'token-0123456789-abc';

function env() {
  const inbox = new Map<string, ServerMessage[]>();
  const deps: RoomDeps = {
    now: () => 1_000_000,
    findGame: (id) => (id === 'tic-tac-toe' ? (ticTacToe as never) : undefined),
    botRunner: inlineBotRunner([ticTacToe as never], { timeBudgetMs: 5 }),
    randomSeed: () => 'S',
    send: (connection, message) => void inbox.set(connection, [...(inbox.get(connection) ?? []), JSON.parse(JSON.stringify(message)) as ServerMessage]),
    close: () => undefined,
  };
  const room = new Room('🦊🍎🚀🎈', deps);
  const join = (name: string, extra: Record<string, unknown> = {}) => {
    room.connect(name);
    room.receive(name, JSON.stringify({ type: 'hello', protocol: PROTOCOL_VERSION, token: `token-${name}-0123456789`, name, avatar: '🦊', ...extra }));
  };
  const last = (who: string, type: string) => [...(inbox.get(who) ?? [])].reverse().find((m) => m.type === type);
  const members = () => (last('anna', 'room') as RoomMessage).members as { name: string; frame?: string }[];
  return { room, join, members, last };
}

describe('Avatar-Rahmen im Raum (#572)', () => {
  it('gültige Kennungen gehen durch, ungültige und zu lange fallen weg, ohne die Nachricht zu verwerfen', () => {
    const hello = (frame: unknown) => parseClientMessage(JSON.stringify({ type: 'hello', protocol: PROTOCOL_VERSION, token: TOKEN, name: 'A', avatar: '🦊', ...(frame === undefined ? {} : { frame }) }));
    expect(hello('gold-1')).toMatchObject({ type: 'hello', frame: 'gold-1' });
    expect(hello('a'.repeat(20))).toMatchObject({ frame: 'a'.repeat(20) });
    expect(hello('a'.repeat(21))).not.toHaveProperty('frame');
    expect(hello('Gold')).not.toHaveProperty('frame');
    expect(hello('gold_1')).not.toHaveProperty('frame');
    expect(hello('<b>')).not.toHaveProperty('frame');
    expect(hello('')).not.toHaveProperty('frame');
    expect(hello(5)).not.toHaveProperty('frame');
    expect(hello(undefined)).toMatchObject({ type: 'hello' });
    expect(hello(undefined)).not.toHaveProperty('frame');
    expect(parseClientMessage(JSON.stringify({ type: 'setName', name: 'A', avatar: '🦊', frame: 'silber' }))).toMatchObject({ frame: 'silber' });
    expect(parseClientMessage(JSON.stringify({ type: 'setName', name: 'A', avatar: '🦊', frame: 'X Y' }))).not.toHaveProperty('frame');
  });

  it('der Raum gibt den Rahmen an alle weiter; wer keinen hat, bekommt kein Feld', () => {
    const e = env();
    e.join('anna', { frame: 'gold' });
    e.join('ben');
    expect(e.members().find((m) => m.name === 'anna')!.frame).toBe('gold');
    expect(e.members().find((m) => m.name === 'ben')).not.toHaveProperty('frame');
  });

  it('setName setzt, ändert und löscht den Rahmen', () => {
    const e = env();
    e.join('anna');
    e.room.receive('anna', JSON.stringify({ type: 'setName', name: 'anna', avatar: '🦊', frame: 'silber' }));
    expect(e.members()[0]!.frame).toBe('silber');
    e.room.receive('anna', JSON.stringify({ type: 'setName', name: 'anna', avatar: '🦊', frame: '../x' }));
    expect(e.members()[0]).not.toHaveProperty('frame');
  });

  it('der Rahmen überlebt das Schlafen des Raums', () => {
    const e = env();
    e.join('anna', { frame: 'gold' });
    const snapshot = e.room.snapshot();
    expect(snapshot.members.find((m) => m.name === 'anna')!.frame).toBe('gold');
  });
});
