import { inlineBotRunner, type AnyGameModule } from '@brett-und-blatt/engine';
import { gameModule as blackPeter } from '@brett-und-blatt/game-black-peter';
import { gameModule as ticTacToe } from '@brett-und-blatt/game-tic-tac-toe';
import { describe, expect, it } from 'vitest';
import { AFTER_GAME_MS, PROTOCOL_VERSION, Room, parseClientMessage, type AfterGameInfo, type ClientMessage, type RoomDeps, type RoomMessage, type ServerMessage } from '../src';

/** Ein zweites Zweispieler-Spiel, damit „anderes Spiel“ etwas zur Wahl hat. */
const other: AnyGameModule = { ...ticTacToe, info: { ...ticTacToe.info, id: 'ttt-zwei', name: 'Zwei' } } as AnyGameModule;
const modules = new Map<string, AnyGameModule>([
  [ticTacToe.info.id, ticTacToe],
  [other.info.id, other],
  [blackPeter.info.id, blackPeter],
]);

function setup() {
  let time = 1_000_000;
  const inbox = new Map<string, ServerMessage[]>();
  const deps: RoomDeps = {
    now: () => time,
    findGame: (id) => modules.get(id),
    listGames: () => [...modules.values()],
    random: () => 0,
    botRunner: inlineBotRunner([...modules.values()], { timeBudgetMs: 5 }),
    randomSeed: () => 'NOCHMAL',
    send: (connection, message) => inbox.set(connection, [...(inbox.get(connection) ?? []), JSON.parse(JSON.stringify(message)) as ServerMessage]),
    close: () => {},
  };
  const room = new Room('🦊🍎🚀🎈', deps);
  const client = (connection: string) => {
    room.connect(connection);
    const c = {
      send: (message: ClientMessage) => room.receive(connection, JSON.stringify(message)),
      hello: () => c.send({ type: 'hello', protocol: PROTOCOL_VERSION, token: `token-${connection}-0123456789`, name: connection, avatar: '🦊' }),
      all: () => inbox.get(connection) ?? [],
      room: () => [...c.all()].reverse().find((m) => m.type === 'room') as RoomMessage,
      after: (): AfterGameInfo | null | undefined => ([...c.all()].reverse().find((m) => m.type === 'afterGame') as { after: AfterGameInfo | null } | undefined)?.after,
      error: () => [...c.all()].reverse().find((m) => m.type === 'error') as Extract<ServerMessage, { type: 'error' }> | undefined,
    };
    return c;
  };
  return { room, client, advance: (ms: number) => (time += ms) };
}

/** Anna und Ben spielen Tic-Tac-Toe, Zoe sieht zu; Anna gibt sofort auf, damit die Partie zu Ende ist. */
function finishedTable(env: ReturnType<typeof setup>) {
  const anna = env.client('anna');
  const ben = env.client('ben');
  const zoe = env.client('zoe');
  anna.hello();
  ben.hello();
  zoe.hello();
  anna.send({ type: 'setGame', gameId: 'tic-tac-toe' });
  anna.send({ type: 'takeSeat', index: 0 });
  ben.send({ type: 'takeSeat', index: 1 });
  anna.send({ type: 'start' });
  anna.send({ type: 'resign' });
  return { anna, ben, zoe };
}

describe('Abstimmung am Rundenende', () => {
  it('liest die neuen Nachrichten', () => {
    expect(parseClientMessage('{"type":"afterVote","choice":"again"}')).toEqual({ type: 'afterVote', choice: 'again' });
    expect(parseClientMessage('{"type":"afterVote","choice":"leave"}')).toBeNull();
    expect(parseClientMessage('{"type":"afterPropose","gameId":"ttt-zwei"}')).toEqual({ type: 'afterPropose', gameId: 'ttt-zwei' });
    expect(parseClientMessage('{"type":"afterPropose","gameId":"random"}')).toBeNull();
    expect(parseClientMessage('{"type":"afterPick","gameId":"random"}')).toEqual({ type: 'afterPick', gameId: 'random' });
  });

  it('beginnt mit dem Ergebnis; nur Menschen mit Platz dürfen abstimmen', () => {
    const env = setup();
    const { anna, zoe } = finishedTable(env);
    expect(anna.room().phase).toBe('finished');
    expect(anna.after()).toMatchObject({ voters: 2, voted: 0, canVote: true, candidates: [{ gameId: 'random', votes: 0 }] });
    expect(zoe.after()).toMatchObject({ canVote: false });
    zoe.send({ type: 'afterVote', choice: 'again' });
    expect(zoe.error()?.code).toBe('notAllowed');
    expect(anna.after()?.voted).toBe(0);
  });

  it('zeigt nur Zähler und die eigene Stimme', () => {
    const env = setup();
    const { anna, ben } = finishedTable(env);
    anna.send({ type: 'afterVote', choice: 'again' });
    expect(anna.after()).toMatchObject({ voted: 1, again: 1, other: 0, you: { choice: 'again' } });
    expect(ben.after()).toMatchObject({ voted: 1, again: 1, you: {} });
    expect(ben.after()?.you?.choice).toBeUndefined();
  });

  it('startet bei zweimal „Nochmal“ sofort neu, bei zwei Plätzen mit Platzwechsel', () => {
    const env = setup();
    const { anna, ben } = finishedTable(env);
    anna.send({ type: 'afterVote', choice: 'again' });
    ben.send({ type: 'afterVote', choice: 'again' });
    expect(anna.room().phase).toBe('playing');
    expect(anna.room().lobby.seats.map((s) => (s.kind === 'human' ? s.memberId : null))).toEqual([ben.room().members.find((m) => m.name === 'ben')!.id, anna.room().members.find((m) => m.name === 'anna')!.id]);
    expect(anna.after()).toBeNull();
  });

  it('nimmt bei Gleichstand „Nochmal“', () => {
    const env = setup();
    const { anna, ben } = finishedTable(env);
    anna.send({ type: 'afterVote', choice: 'again' });
    ben.send({ type: 'afterPropose', gameId: 'ttt-zwei' });
    // Beide haben abgestimmt: 1 : 1, also Nochmal mit gleichem Spiel.
    expect(anna.room().phase).toBe('playing');
    expect(anna.room().lobby.gameId).toBe('tic-tac-toe');
  });

  it('wechselt bei Mehrheit zum vorgeschlagenen Spiel und behält die Plätze', () => {
    const env = setup();
    const { anna, ben } = finishedTable(env);
    anna.send({ type: 'afterPropose', gameId: 'ttt-zwei' });
    expect(anna.after()?.candidates.map((c) => c.gameId)).toEqual(['ttt-zwei', 'random']);
    ben.send({ type: 'afterPick', gameId: 'ttt-zwei' });
    const room = anna.room();
    expect(room.phase).toBe('lobby');
    expect(room.lobby.gameId).toBe('ttt-zwei');
    expect(room.lobby.seats.filter((s) => s.kind === 'human' && s.memberId !== null)).toHaveLength(2);
    expect(anna.after()).toBeNull();
  });

  it('lehnt unpassende Vorschläge ab', () => {
    const env = setup();
    const { anna } = finishedTable(env);
    anna.send({ type: 'afterPropose', gameId: 'tic-tac-toe' }); // dasselbe Spiel
    expect(anna.error()?.code).toBe('notAllowed');
    anna.send({ type: 'afterPropose', gameId: 'gibt-es-nicht' });
    expect(anna.after()?.candidates).toEqual([{ gameId: 'random', votes: 0 }]);
    anna.send({ type: 'afterPick', gameId: 'ttt-zwei' }); // kein Kandidat
    expect(anna.after()?.voted).toBe(0);
  });

  it('zieht bei „Zufällig“ ein passendes Spiel', () => {
    const env = setup();
    const { anna, ben } = finishedTable(env);
    anna.send({ type: 'afterPick', gameId: 'random' });
    ben.send({ type: 'afterPick', gameId: 'random' });
    expect(anna.room().phase).toBe('lobby');
    expect(['ttt-zwei', 'black-peter']).toContain(anna.room().lobby.gameId);
    expect(anna.room().lobby.gameId).not.toBe('tic-tac-toe');
  });

  it('entscheidet nach der Frist mit den abgegebenen Stimmen', () => {
    const env = setup();
    const { anna, ben } = finishedTable(env);
    anna.send({ type: 'afterVote', choice: 'again' });
    env.advance(AFTER_GAME_MS - 1);
    env.room.tick();
    expect(ben.room().phase).toBe('finished');
    env.advance(2);
    env.room.tick();
    expect(ben.room().phase).toBe('playing');
  });

  it('lässt den Raum ohne Stimmen nach der Frist am Spielfeld stehen', () => {
    const env = setup();
    const { anna } = finishedTable(env);
    expect(env.room.nextWakeup()).toBeLessThanOrEqual(1_000_000 + AFTER_GAME_MS);
    env.advance(AFTER_GAME_MS + 1);
    env.room.tick();
    expect(anna.room().phase).toBe('finished');
    expect(anna.after()).toBeNull();
  });

  it('zählt Aussteigende nicht mehr mit und überlebt ein Speichern', () => {
    const env = setup();
    const { anna, ben } = finishedTable(env);
    anna.send({ type: 'afterVote', choice: 'again' });
    const restored = Room.restore(JSON.parse(JSON.stringify(env.room.snapshot())), { now: () => 1_000_000, findGame: (id) => modules.get(id), botRunner: inlineBotRunner([...modules.values()], { timeBudgetMs: 5 }), randomSeed: () => 'x', send: () => {}, close: () => {} });
    expect(restored.snapshot().after).toMatchObject({ votes: expect.any(Object) });
    ben.send({ type: 'leave' });
    expect(anna.after()).toBeNull();
  });

  it('zeigt keine Abstimmung bei einem einzigen Menschen', () => {
    const env = setup();
    const anna = env.client('anna');
    anna.hello();
    anna.send({ type: 'setGame', gameId: 'tic-tac-toe' });
    anna.send({ type: 'takeSeat', index: 0 });
    anna.send({ type: 'setSeat', index: 1, seat: { bot: 'easy' } });
    anna.send({ type: 'start' });
    anna.send({ type: 'resign' });
    expect(anna.room().phase).toBe('finished');
    expect(anna.after()).toBeUndefined();
  });
});
