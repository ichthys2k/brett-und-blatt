import { inlineBotRunner, type AnyGameModule } from '@brett-und-blatt/engine';
import { gameModule as blackPeter } from '@brett-und-blatt/game-black-peter';
import { gameModule as ticTacToe } from '@brett-und-blatt/game-tic-tac-toe';
import { describe, expect, it } from 'vitest';
import { JOIN_DENIED_MS, PROTOCOL_VERSION, Room, parseClientMessage, type ClientMessage, type RoomDeps, type RoomMessage, type ServerMessage } from '../src';

const modules = new Map<string, AnyGameModule>([
  [ticTacToe.info.id, ticTacToe],
  [blackPeter.info.id, blackPeter],
]);

function setup(isPublic = true) {
  let time = 1_000_000;
  const inbox = new Map<string, ServerMessage[]>();
  const deps: RoomDeps = {
    now: () => time,
    findGame: (id) => modules.get(id),
    botRunner: inlineBotRunner([...modules.values()], { timeBudgetMs: 5 }),
    randomSeed: () => 'ANFRAGE',
    send: (connection, message) => inbox.set(connection, [...(inbox.get(connection) ?? []), JSON.parse(JSON.stringify(message)) as ServerMessage]),
    close: () => {},
  };
  const room = new Room('🦊🍎🚀🎈', deps, isPublic);
  const client = (connection: string) => {
    room.connect(connection);
    const c = {
      send: (message: ClientMessage) => room.receive(connection, JSON.stringify(message)),
      hello: () => c.send({ type: 'hello', protocol: PROTOCOL_VERSION, token: `token-${connection}-0123456789`, name: connection, avatar: '🦊' }),
      all: () => inbox.get(connection) ?? [],
      room: () => [...c.all()].reverse().find((m) => m.type === 'room') as RoomMessage,
      error: () => [...c.all()].reverse().find((m) => m.type === 'error') as Extract<ServerMessage, { type: 'error' }> | undefined,
      id: () => c.room().members.find((m) => m.name === connection)!.id,
    };
    return c;
  };
  return { room, client, advance: (ms: number) => (time += ms) };
}

/** Anna (Raumleitung) und Ben spielen Schwarzer Peter (2–6 Plätze), Zoe sieht zu. */
function runningTable(env: ReturnType<typeof setup>) {
  const anna = env.client('anna');
  const ben = env.client('ben');
  const zoe = env.client('zoe');
  anna.hello();
  ben.hello();
  zoe.hello();
  anna.send({ type: 'setGame', gameId: 'black-peter' });
  anna.send({ type: 'takeSeat', index: 0 });
  ben.send({ type: 'takeSeat', index: 1 });
  anna.send({ type: 'start' });
  return { anna, ben, zoe };
}

describe('Mitspielen ab der nächsten Runde (#299)', () => {
  it('liest die neuen Nachrichten', () => {
    expect(parseClientMessage('{"type":"askToJoin"}')).toEqual({ type: 'askToJoin' });
    expect(parseClientMessage('{"type":"cancelAskToJoin"}')).toEqual({ type: 'cancelAskToJoin' });
    expect(parseClientMessage('{"type":"acceptAllJoins"}')).toEqual({ type: 'acceptAllJoins' });
    expect(parseClientMessage('{"type":"answerJoin","memberId":"m3","ok":true}')).toEqual({ type: 'answerJoin', memberId: 'm3', ok: true });
    expect(parseClientMessage('{"type":"answerJoin","memberId":"m3","ok":"ja"}')).toBeNull();
    expect(parseClientMessage('{"type":"setAcceptRequests","allowed":false}')).toEqual({ type: 'setAcceptRequests', allowed: false });
  });

  it('nimmt eine Anfrage an: vorgemerkt, Platz erst in der nächsten Runde', () => {
    const env = setup();
    const { anna, zoe } = runningTable(env);
    zoe.send({ type: 'askToJoin' });
    expect(anna.room().members.find((m) => m.name === 'zoe')?.join).toBe('asking');
    anna.send({ type: 'answerJoin', memberId: zoe.id(), ok: true });
    expect(zoe.room().members.find((m) => m.name === 'zoe')?.join).toBe('queued');
    // Am laufenden Tisch ändert sich nichts.
    expect(zoe.room().lobby.seats.filter((s) => s.kind === 'human' && s.memberId !== null)).toHaveLength(2);
    anna.send({ type: 'resign' });
    anna.send({ type: 'start' });
    const seats = anna.room().lobby.seats;
    expect(seats.filter((s) => s.kind === 'human' && s.memberId === zoe.id())).toHaveLength(1);
    expect(anna.room().members.find((m) => m.name === 'zoe')?.join).toBeUndefined();
    expect(anna.room().phase).toBe('playing');
  });

  it('lehnt ab, schickt Bescheid und sperrt die nächste Anfrage kurz', () => {
    const env = setup();
    const { anna, zoe } = runningTable(env);
    zoe.send({ type: 'askToJoin' });
    anna.send({ type: 'answerJoin', memberId: zoe.id(), ok: false });
    expect(zoe.all().some((m) => m.type === 'joinDenied')).toBe(true);
    expect(zoe.room().members.find((m) => m.name === 'zoe')?.join).toBeUndefined();
    zoe.send({ type: 'askToJoin' });
    expect(zoe.error()?.code).toBe('notAllowed');
    env.advance(JOIN_DENIED_MS + 1);
    zoe.send({ type: 'askToJoin' });
    expect(zoe.room().members.find((m) => m.name === 'zoe')?.join).toBe('asking');
  });

  it('lässt nur die Raumleitung entscheiden und Anfragen zurückziehen', () => {
    const env = setup();
    const { anna, ben, zoe } = runningTable(env);
    zoe.send({ type: 'askToJoin' });
    ben.send({ type: 'answerJoin', memberId: zoe.id(), ok: true });
    expect(ben.error()?.code).toBe('notAllowed');
    zoe.send({ type: 'cancelAskToJoin' });
    expect(anna.room().members.find((m) => m.name === 'zoe')?.join).toBeUndefined();
  });

  it('nimmt alle offenen Anfragen auf einmal an', () => {
    const env = setup();
    const { anna, zoe } = runningTable(env);
    const max = env.client('max');
    max.hello();
    zoe.send({ type: 'askToJoin' });
    max.send({ type: 'askToJoin' });
    anna.send({ type: 'acceptAllJoins' });
    expect(anna.room().members.filter((m) => m.join === 'queued').map((m) => m.name)).toEqual(['zoe', 'max']);
  });

  it('bietet es bei fester Spielerzahl, in privaten Räumen und für Sitzende nicht an', () => {
    const fixed = setup();
    const a = fixed.client('anna');
    const b = fixed.client('ben');
    const z = fixed.client('zoe');
    a.hello();
    b.hello();
    z.hello();
    a.send({ type: 'setGame', gameId: 'tic-tac-toe' });
    a.send({ type: 'takeSeat', index: 0 });
    b.send({ type: 'takeSeat', index: 1 });
    a.send({ type: 'start' });
    z.send({ type: 'askToJoin' });
    expect(z.error()?.code).toBe('notAllowed');

    const priv = setup(false);
    const t = runningTable(priv);
    t.zoe.send({ type: 'askToJoin' });
    expect(t.zoe.error()?.code).toBe('notAllowed');
    t.anna.send({ type: 'setAcceptRequests', allowed: true });
    t.zoe.send({ type: 'askToJoin' });
    expect(t.anna.room().members.find((m) => m.name === 'zoe')?.join).toBe('asking');
    t.ben.send({ type: 'askToJoin' });
    expect(t.ben.error()?.code).toBe('notAllowed');
  });

  it('nimmt Anfragen zurück, wenn die Raumleitung sie verbietet', () => {
    const env = setup();
    const { anna, zoe } = runningTable(env);
    zoe.send({ type: 'askToJoin' });
    anna.send({ type: 'setAcceptRequests', allowed: false });
    expect(anna.room().members.find((m) => m.name === 'zoe')?.join).toBeUndefined();
    expect(anna.room().lobby.acceptRequests).toBe(false);
  });

  it('steht laufend in „Offene Runden“ mit dem Zusatz „läuft“', () => {
    const env = setup();
    runningTable(env);
    expect(env.room.publicListing()).toMatchObject({ gameId: 'black-peter', running: true, totalSeats: 2, filledSeats: 2 });
    const priv = setup(false);
    runningTable(priv);
    expect(priv.room.publicListing()).toBeNull();
  });

  it('merkt sich Anfragen über ein Speichern hinweg und zählt Vorgemerkte bei der Abstimmung mit', () => {
    const env = setup();
    const { anna, zoe } = runningTable(env);
    zoe.send({ type: 'askToJoin' });
    anna.send({ type: 'answerJoin', memberId: zoe.id(), ok: true });
    const saved = JSON.parse(JSON.stringify(env.room.snapshot()));
    expect(saved.members.find((m: { name: string }) => m.name === 'zoe')).toMatchObject({ join: 'queued' });
    anna.send({ type: 'resign' });
    const after = [...zoe.all()].reverse().find((m) => m.type === 'afterGame') as { after: { voters: number; canVote: boolean } | null };
    expect(after.after).toMatchObject({ voters: 3, canVote: true });
  });
});
