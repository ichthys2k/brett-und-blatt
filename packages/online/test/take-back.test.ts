import { inlineBotRunner, type AnyGameModule } from '@brett-und-blatt/engine';
import { gameModule as blackPeter } from '@brett-und-blatt/game-black-peter';
import { gameModule as ticTacToe } from '@brett-und-blatt/game-tic-tac-toe';
import { describe, expect, it } from 'vitest';
import { PROTOCOL_VERSION, Room, TAKE_BACK_GAP, TAKE_BACK_MS, parseClientMessage, type ClientMessage, type GameMessage, type RoomDeps, type ServerMessage } from '../src';

/** Tic-Tac-Toe mit Schachuhr, damit sich prüfen lässt, dass die Uhren zurückgesetzt werden. */
const clocked: AnyGameModule = {
  ...ticTacToe,
  info: { ...ticTacToe.info, id: 'ttt-uhr', name: 'Tic-Tac-Toe mit Uhr' },
  timePresets: { relaxed: { kind: 'none' }, normal: { kind: 'chessClock', baseMs: 60_000, incrementMs: 0 }, fast: { kind: 'chessClock', baseMs: 30_000, incrementMs: 0 } },
} as AnyGameModule;

const noTakeBack: AnyGameModule = { ...ticTacToe, info: { ...ticTacToe.info, id: 'ttt-ohne', name: 'Ohne', takeBack: false } } as AnyGameModule;

const modules = new Map<string, AnyGameModule>([
  [ticTacToe.info.id, ticTacToe],
  [clocked.info.id, clocked],
  [noTakeBack.info.id, noTakeBack],
  [blackPeter.info.id, blackPeter],
]);

function setup() {
  let time = 1_000_000;
  const inbox = new Map<string, ServerMessage[]>();
  const deps: RoomDeps = {
    now: () => time,
    findGame: (id) => modules.get(id),
    botRunner: inlineBotRunner([...modules.values()], { timeBudgetMs: 5 }),
    randomSeed: () => 'STARTWERT-ZURUECK',
    send: (connection, message) => inbox.set(connection, [...(inbox.get(connection) ?? []), JSON.parse(JSON.stringify(message)) as ServerMessage]),
    close: () => {},
  };
  let room = new Room('🦊🍎🚀🎈', deps);
  const client = (connection: string) => {
    room.connect(connection);
    const c = {
      send: (message: ClientMessage) => room.receive(connection, JSON.stringify(message)),
      hello: () => c.send({ type: 'hello', protocol: PROTOCOL_VERSION, token: `token-${connection}-0123456789`, name: connection, avatar: '🦊' }),
      all: () => inbox.get(connection) ?? [],
      game: () => [...c.all()].reverse().find((m) => m.type === 'game') as GameMessage,
      error: () => [...c.all()].reverse().find((m) => m.type === 'error') as Extract<ServerMessage, { type: 'error' }> | undefined,
      /** Den ersten erlaubten Zug machen (oder ein bestimmtes Feld). */
      play: (cell?: number) => c.send({ type: 'move', version: c.game().version, move: cell === undefined ? c.game().legalMoves[0] : { type: 'place', cell } }),
    };
    return c;
  };
  return {
    deps,
    get room() {
      return room;
    },
    restore: () => (room = Room.restore(JSON.parse(JSON.stringify(room.snapshot())), deps)),
    client,
    advance: (ms: number) => (time += ms),
  };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function table(env: ReturnType<typeof setup>, options: { gameId?: string; time?: 'relaxed' | 'normal'; botSecond?: boolean; takeBack?: boolean } = {}) {
  const anna = env.client('anna');
  const ben = env.client('ben');
  const zoe = env.client('zoe');
  anna.hello();
  ben.hello();
  zoe.hello();
  anna.send({ type: 'setGame', gameId: options.gameId ?? 'tic-tac-toe' });
  if (options.time) anna.send({ type: 'setTime', time: options.time });
  if (options.takeBack === false) anna.send({ type: 'setTakeBack', allowed: false });
  anna.send({ type: 'takeSeat', index: 0 });
  if (options.botSecond) anna.send({ type: 'setSeat', index: 1, seat: { bot: 'easy' } });
  else ben.send({ type: 'takeSeat', index: 1 });
  anna.send({ type: 'start' });
  return { anna, ben, zoe };
}

describe('Zurücknehmen mit Zustimmung', () => {
  it('liest die neuen Nachrichten', () => {
    expect(parseClientMessage('{"type":"takeBack"}')).toEqual({ type: 'takeBack' });
    expect(parseClientMessage('{"type":"answerTakeBack","accept":true}')).toEqual({ type: 'answerTakeBack', accept: true });
    expect(parseClientMessage('{"type":"answerTakeBack","accept":"ja"}')).toBeNull();
    expect(parseClientMessage('{"type":"setTakeBack","allowed":false}')).toEqual({ type: 'setTakeBack', allowed: false });
  });

  it('nimmt nach Zustimmung den eigenen Zug und die Antwort danach zurück', () => {
    const env = setup();
    const { anna, ben, zoe } = table(env);
    expect(anna.game().canTakeBack).toBe(false);
    anna.play();
    ben.play();
    expect(anna.game().canTakeBack).toBe(true);
    expect(zoe.game().canTakeBack).toBe(false);
    anna.send({ type: 'takeBack' });
    const pending = ben.game().takeBack!;
    expect(pending).toMatchObject({ seat: 0, status: 'pending', moves: 2, waiting: [1] });
    // Während der Abstimmung ruht die Partie.
    expect(ben.game().legalMoves).toEqual([]);
    expect(anna.game().canTakeBack).toBe(false);
    // Zuschauer stimmen nicht ab.
    zoe.send({ type: 'answerTakeBack', accept: false });
    expect(zoe.error()?.code).toBe('notAllowed');
    ben.send({ type: 'answerTakeBack', accept: true });
    const after = anna.game();
    expect(after.takeBack).toMatchObject({ seat: 0, status: 'accepted' });
    expect(after.current).toEqual([0]);
    expect(after.view).toEqual(zoe.game().view);
    expect(after.events).toContainEqual({ type: 'takeBack', status: 'accepted', seat: 0 });
    expect((after.view as { board: unknown[] }).board.every((cell) => cell === null)).toBe(true);
    // Der Hinweis verschwindet mit dem nächsten Zug.
    anna.play();
    expect(ben.game().takeBack).toBeNull();
  });

  it('lehnt ab, wenn jemand ablehnt – dann ist erst nach einigen eigenen Zügen eine neue Bitte möglich', () => {
    const env = setup();
    const { anna, ben } = table(env);
    anna.play(4);
    const before = ben.game().view;
    anna.send({ type: 'takeBack' });
    ben.send({ type: 'answerTakeBack', accept: false });
    expect(anna.game().takeBack).toMatchObject({ status: 'declined', by: 1 });
    expect(anna.game().view).toEqual(before);
    expect(ben.game().legalMoves.length).toBeGreaterThan(0);
    // Gesperrt, bis Anna TAKE_BACK_GAP weitere eigene Züge gemacht hat (Felder so, dass niemand gewinnt).
    const moves: [number, number][] = [[0, 8], [2, 1], [7, 6]];
    expect(moves.length).toBe(TAKE_BACK_GAP);
    for (const [benCell, annaCell] of moves) {
      ben.play(benCell);
      expect(anna.game().canTakeBack).toBe(false);
      anna.play(annaCell);
    }
    expect(anna.game().result).toBeNull();
    expect(anna.game().canTakeBack).toBe(true);
    anna.send({ type: 'takeBack' });
    // Kein zweites Ja: Wer nicht abstimmen muss, wird abgewiesen.
    anna.send({ type: 'answerTakeBack', accept: true });
    expect(anna.error()?.code).toBe('notAllowed');
  });

  it('gilt nach 30 s ohne Antwort als abgelehnt; Züge warten so lange', () => {
    const env = setup();
    const { anna, ben } = table(env);
    anna.play();
    anna.send({ type: 'takeBack' });
    expect(env.room.nextWakeup()).toBeLessThanOrEqual(ben.game().takeBack!.deadline!);
    ben.send({ type: 'move', version: ben.game().version, move: { type: 'place', cell: 4 } });
    expect(ben.error()?.code).toBe('notAllowed');
    env.advance(TAKE_BACK_MS - 1);
    env.room.tick();
    expect(ben.game().takeBack?.status).toBe('pending');
    env.advance(1);
    env.room.tick();
    expect(ben.game().takeBack?.status).toBe('expired');
    expect(ben.game().legalMoves.length).toBeGreaterThan(0);
  });

  it('Bots stimmen sofort zu', async () => {
    const env = setup();
    const { anna } = table(env, { botSecond: true });
    anna.play();
    await flush();
    await flush();
    expect(anna.game().current).toEqual([0]);
    anna.send({ type: 'takeBack' });
    await flush();
    const after = anna.game();
    expect(after.takeBack).toMatchObject({ status: 'accepted', moves: 2 });
    expect((after.view as { board: unknown[] }).board.every((cell) => cell === null)).toBe(true);
    expect(after.current).toEqual([0]);
  });

  it('setzt die Uhren auf den Stand vor dem Zug; während der Abstimmung stehen sie', () => {
    const env = setup();
    const { anna, ben } = table(env, { gameId: 'ttt-uhr', time: 'normal' });
    env.advance(10_000);
    anna.play();
    env.advance(5_000);
    ben.play();
    anna.send({ type: 'takeBack' });
    expect(ben.game().clocks.every((clock) => !clock.running)).toBe(true);
    env.advance(20_000);
    ben.send({ type: 'answerTakeBack', accept: true });
    const clocks = anna.game().clocks;
    expect(clocks[0]).toMatchObject({ running: true, leftMs: 60_000 });
    expect(clocks[1]).toMatchObject({ running: false, leftMs: 60_000 });
  });

  it('übersteht eine offene Abstimmung beim Schlafenlegen des Servers', () => {
    const env = setup();
    const { anna } = table(env);
    anna.play();
    anna.send({ type: 'takeBack' });
    env.restore();
    const ben = env.client('ben2');
    // Ben verbindet sich mit derselben Kennung neu.
    ben.send({ type: 'hello', protocol: PROTOCOL_VERSION, token: 'token-ben-0123456789', name: 'ben', avatar: '🦊' });
    expect(ben.game().takeBack?.status).toBe('pending');
    expect(ben.game().legalMoves).toEqual([]);
    ben.send({ type: 'answerTakeBack', accept: true });
    expect(ben.game().takeBack?.status).toBe('accepted');
    expect(ben.game().current).toEqual([0]);
  });

  it('gibt es nicht bei Spielen ohne takeBack, mit verdeckten Karten oder wenn die Raumleitung es ausschaltet', () => {
    for (const options of [{ gameId: 'ttt-ohne' }, { gameId: 'black-peter' }, { takeBack: false }]) {
      const env = setup();
      const { anna, ben } = table(env, options);
      const first = anna.game().current.includes(0) ? anna : ben;
      first.play();
      expect(first.game().canTakeBack).toBe(false);
      first.send({ type: 'takeBack' });
      expect(first.error()?.code).toBe('notAllowed');
      expect(first.game().takeBack ?? null).toBeNull();
    }
  });

  it('nur die Raumleitung schaltet es in der Lobby um', () => {
    const env = setup();
    const anna = env.client('anna');
    const ben = env.client('ben');
    anna.hello();
    ben.hello();
    ben.send({ type: 'setTakeBack', allowed: false });
    expect(ben.error()?.code).toBe('notAllowed');
    anna.send({ type: 'setTakeBack', allowed: false });
    const room = [...anna.all()].reverse().find((m) => m.type === 'room') as Extract<ServerMessage, { type: 'room' }>;
    expect(room.lobby.takeBack).toBe(false);
  });
});
