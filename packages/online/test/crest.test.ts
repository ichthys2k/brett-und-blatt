import { inlineBotRunner } from '@brett-und-blatt/engine';
import { gameModule as ticTacToe } from '@brett-und-blatt/game-tic-tac-toe';
import { describe, expect, it } from 'vitest';
import { PROTOCOL_VERSION, Room, parseClientMessage, type RoomDeps, type RoomMessage, type ServerMessage } from '../src';

const GOOD = 'schild:rund;teilung:geteilt;farben:blau-silber;tier:🐻;zier:rahmen;raum:1';

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
  const members = () => ((([...(inbox.get('anna') ?? [])].reverse().find((m) => m.type === 'room') as RoomMessage).members as { name: string; crest?: string }[]));
  return { room, join, members, inbox };
}

describe('Wappen im Raum (#147)', () => {
  it('die Nachricht darf ein Wappen tragen, aber nur kurz', () => {
    const ok = parseClientMessage(JSON.stringify({ type: 'hello', protocol: PROTOCOL_VERSION, token: 'token-0123456789-abc', name: 'A', avatar: '🦊', crest: GOOD }));
    expect(ok).toMatchObject({ type: 'hello', crest: GOOD });
    const long = parseClientMessage(JSON.stringify({ type: 'hello', protocol: PROTOCOL_VERSION, token: 'token-0123456789-abc', name: 'A', avatar: '🦊', crest: 'x'.repeat(500) }));
    expect(long).not.toHaveProperty('crest');
    expect(parseClientMessage(JSON.stringify({ type: 'setName', name: 'A', avatar: '🦊', crest: GOOD }))).toMatchObject({ crest: GOOD });
  });

  it('alle sehen das gültige Wappen neben dem Namen, in Normalform', () => {
    const e = env();
    e.join('anna', { crest: 'raum:1;tier:🐻;schild:rund;teilung:geteilt;farben:blau-silber;zier:rahmen,rahmen' });
    e.join('ben');
    const members = e.members();
    expect(members.find((m) => m.name === 'anna')!.crest).toBe(GOOD);
    expect(members.find((m) => m.name === 'ben')).not.toHaveProperty('crest');
  });

  it('ungültige Beschreibungen und „nicht zeigen“ erreichen den Raum nie', () => {
    const e = env();
    e.join('anna', { crest: '<script>alert(1)</script>' });
    e.join('ben', { crest: 'schild:klassisch;tier:🦊;raum:0' });
    e.join('cleo', { crest: 'schild:klassisch;tier:hallo;zier:krone,evil' });
    const members = e.members();
    expect(members.find((m) => m.name === 'anna')).not.toHaveProperty('crest');
    expect(members.find((m) => m.name === 'ben')).not.toHaveProperty('crest');
    // ungültiges Tier fällt auf die Vorgabe zurück, unbekannte Zier fällt weg
    expect(members.find((m) => m.name === 'cleo')!.crest).toBe('schild:klassisch;teilung:quer;farben:rot-gold;tier:🎲;zier:krone;raum:1');
  });

  it('setName ändert oder entfernt das Wappen', () => {
    const e = env();
    e.join('anna', { crest: GOOD });
    e.room.receive('anna', JSON.stringify({ type: 'setName', name: 'anna', avatar: '🦊' }));
    expect(e.members().find((m) => m.name === 'anna')).not.toHaveProperty('crest');
    e.room.receive('anna', JSON.stringify({ type: 'setName', name: 'anna', avatar: '🦊', crest: GOOD }));
    expect(e.members().find((m) => m.name === 'anna')!.crest).toBe(GOOD);
  });

  it('der Speicherstand behält das Wappen', () => {
    const e = env();
    e.join('anna', { crest: GOOD });
    const snapshot = e.room.snapshot();
    expect(snapshot.members[0]!.crest).toBe(GOOD);
  });
});
