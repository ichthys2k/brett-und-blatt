import { inlineBotRunner, type AnyGameModule } from '@brett-und-blatt/engine';
import { gameModule as ticTacToe } from '@brett-und-blatt/game-tic-tac-toe';
import { describe, expect, it } from 'vitest';
import {
  PROTOCOL_VERSION,
  Room,
  TTL_TURN_S,
  deliverTurnPush,
  newTournamentPushState,
  type ClientMessage,
  type GameMessage,
  type PushSender,
  type PushSubscriptionData,
  type RoomDeps,
  type ServerMessage,
} from '../src';

/** Web Push in Fernpartien (#242, Schritt 5). */

const corr: AnyGameModule = {
  ...ticTacToe,
  info: { ...ticTacToe.info, id: 'corr-game', name: 'Corr Game' },
  options: [{ id: 'correspondence', label: 'Fernpartie', choices: [{ value: 'no', label: 'Nein' }, { value: 'yes', label: 'Ja' }], default: 'no' }],
  timePresetsFor: (opts) =>
    opts.correspondence === 'yes'
      ? { relaxed: { kind: 'perMove', moveMs: 2 * 86_400_000 }, normal: { kind: 'perMove', moveMs: 86_400_000 }, fast: { kind: 'perMove', moveMs: 12 * 3_600_000 } }
      : ticTacToe.timePresets,
};
const modules = new Map<string, AnyGameModule>([[corr.info.id, corr]]);

function setup() {
  let time = 1_000_000;
  const notified: string[][] = [];
  const inbox = new Map<string, ServerMessage[]>();
  const deps: RoomDeps = {
    now: () => time,
    findGame: (id) => modules.get(id),
    botRunner: inlineBotRunner([...modules.values()], { timeBudgetMs: 5 }),
    randomSeed: () => 'GEHEIM',
    send: (c, m) => inbox.set(c, [...(inbox.get(c) ?? []), JSON.parse(JSON.stringify(m)) as ServerMessage]),
    close: () => {},
    notifyTurn: (tokens) => notified.push(tokens),
  };
  const room = new Room('🦊🍎🚀🎈', deps);
  const client = (id: string) => {
    const token = `token-${id}-0123456789`;
    room.connect(id);
    const c = {
      token,
      send: (m: ClientMessage | Record<string, unknown>) => room.receive(id, JSON.stringify(m)),
      hello: () => c.send({ type: 'hello', protocol: PROTOCOL_VERSION, token, name: id, avatar: '🦊' }),
      game: () => [...(inbox.get(id) ?? [])].reverse().find((m) => m.type === 'game') as GameMessage,
    };
    return c;
  };
  return { room, deps, inbox, client, notified, advance: (ms: number) => (time += ms) };
}

/** Anna (Platz 0) und Ben (Platz 1), Partie läuft; Anna ist am Zug. */
function started(correspondence: boolean) {
  const env = setup();
  const anna = env.client('anna');
  const ben = env.client('ben');
  anna.hello();
  ben.hello();
  anna.send({ type: 'setGame', gameId: 'corr-game' });
  if (correspondence) anna.send({ type: 'setOption', id: 'correspondence', value: 'yes' });
  anna.send({ type: 'takeSeat', index: 0 });
  ben.send({ type: 'takeSeat', index: 1 });
  anna.send({ type: 'start' });
  return { env, anna, ben };
}

const moveOf = (c: { game: () => GameMessage }) => ({ type: 'move', version: c.game().version, move: c.game().legalMoves[0] });

describe('Fernpartie: „Du bist dran“ (Raum)', () => {
  it('meldet das getrennte Mitglied, das neu am Zug ist', () => {
    const { env, anna, ben } = started(true);
    env.room.disconnect('ben');
    anna.send(moveOf(anna));
    expect(env.notified).toEqual([[ben.token]]);
  });

  it('meldet nichts, solange das Mitglied verbunden ist', () => {
    const { env, anna } = started(true);
    anna.send(moveOf(anna));
    expect(env.notified).toEqual([]);
  });

  it('meldet nichts in normalen Online-Räumen', () => {
    const { env, anna, ben } = started(false);
    expect(env.room.isCorrespondence()).toBe(false);
    env.room.disconnect('ben');
    anna.send(moveOf(anna));
    expect(env.notified).toEqual([]);
    expect(ben.token).toBeDefined();
  });

  it('meldet nicht beim Start und nicht, wer weiter am Zug bleibt', () => {
    const { env } = started(true);
    expect(env.notified).toEqual([]);
  });

  it('nach dem Wiederherstellen: kein Hinweis für den Platz, der schon vorher am Zug war, wohl für den Wechsel', () => {
    const { env, anna, ben } = started(true);
    anna.send(moveOf(anna));
    const restored = Room.restore(JSON.parse(JSON.stringify(env.room.snapshot())), env.deps);
    expect(env.notified).toEqual([]);
    // Nur Ben kommt zurück; Anna bleibt getrennt.
    env.deps.send = (c, m) => env.inbox.set(c, [...(env.inbox.get(c) ?? []), JSON.parse(JSON.stringify(m)) as ServerMessage]);
    restored.connect('ben');
    restored.receive('ben', JSON.stringify({ type: 'hello', protocol: PROTOCOL_VERSION, token: ben.token, name: 'ben', avatar: '🦊' }));
    const game = [...(env.inbox.get('ben') ?? [])].reverse().find((m) => m.type === 'game') as GameMessage;
    restored.receive('ben', JSON.stringify({ type: 'move', version: game.version, move: game.legalMoves[0] }));
    expect(env.notified).toEqual([[anna.token]]);
  });

  it('sagt den Browsern, ob der Raum eine Fernpartie ist (nur dann gibt es den Schalter)', () => {
    const corrRoom = started(true);
    const normal = started(false);
    const lastRoom = (c: { token: string }, env: ReturnType<typeof setup>) => [...(env.inbox.get(c.token.split('-')[1]!) ?? [])].reverse().find((m) => m.type === 'room') as { correspondence?: boolean } | undefined;
    expect(lastRoom(corrRoom.anna, corrRoom.env)?.correspondence).toBe(true);
    expect(lastRoom(normal.anna, normal.env)?.correspondence).toBeUndefined();
  });

  it('gibt Kennungen nur über die Adapter-Abfrage heraus', () => {
    const { env, ben } = started(true);
    expect(env.room.tokenOfConnection('ben')).toBe(ben.token);
    expect(env.room.tokenOfConnection('niemand')).toBeNull();
    expect(env.room.tokenOfMember('m2')).toBe(ben.token);
    expect(env.room.tokenOfMember('gibtsnicht')).toBeNull();
    // keine Kennung in den Nachrichten an die Mitglieder
    expect(JSON.stringify(ben.game())).not.toContain(ben.token);
  });
});

describe('Fernpartie: Versand', () => {
  function b64(n: number): string {
    return btoa(String.fromCharCode(...new Uint8Array(n).fill(3))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  const sub = (i: number): PushSubscriptionData => ({ endpoint: `https://fcm.googleapis.com/fcm/send/geraet-${i}`, keys: { p256dh: b64(65), auth: b64(16) } });
  function sender(result: 'ok' | 'gone' | 'retry' | 'failed' = 'ok') {
    const calls: { endpoint: string; payload: { k: string; u: string }; ttl: number; topic?: string }[] = [];
    const impl: PushSender = { send: async (s, payload, opts) => (calls.push({ endpoint: s.endpoint, payload: JSON.parse(payload), ttl: opts.ttl, ...(opts.topic ? { topic: opts.topic } : {}) }), result) };
    return { impl, calls };
  }

  it('sendet an Abonnenten, ohne Namen, mit Raumlink', async () => {
    const state = newTournamentPushState();
    state.book.set('t1', sub(1), 0);
    const { impl, calls } = sender();
    const sent = await deliverTurnPush(state, ['t1', 't2'], 'ABCD', impl, 1000, { retryDelayMs: 0 });
    expect(sent).toBe(1);
    expect(calls).toEqual([{ endpoint: sub(1).endpoint, payload: { k: 'yourTurn', u: '#/raum/ABCD' }, ttl: TTL_TURN_S, topic: 'y-ABCD' }]);
  });

  it('höchstens eine Meldung in 30 Minuten je Person', async () => {
    const state = newTournamentPushState();
    state.book.set('t1', sub(1), 0);
    const { impl, calls } = sender();
    await deliverTurnPush(state, ['t1'], 'ABCD', impl, 1000, { retryDelayMs: 0 });
    await deliverTurnPush(state, ['t1'], 'ABCD', impl, 1000 + 60_000, { retryDelayMs: 0 });
    expect(calls).toHaveLength(1);
    await deliverTurnPush(state, ['t1'], 'ABCD', impl, 1000 + 31 * 60_000, { retryDelayMs: 0 });
    expect(calls).toHaveLength(2);
  });

  it('410 entzieht das Abo und speichert; ein Fehlschlag nicht', async () => {
    const gone = newTournamentPushState();
    gone.book.set('t1', sub(1), 0);
    let saved = 0;
    await deliverTurnPush(gone, ['t1'], 'ABCD', sender('gone').impl, 1000, { retryDelayMs: 0, persist: async () => void saved++ });
    expect(gone.book.has('t1')).toBe(false);
    expect(saved).toBe(1);
    const failed = newTournamentPushState();
    failed.book.set('t1', sub(1), 0);
    await deliverTurnPush(failed, ['t1'], 'ABCD', sender('failed').impl, 1000, { retryDelayMs: 0 });
    expect(failed.book.has('t1')).toBe(true);
  });

  it('wiederholt bei retry einmal und übersteht einen werfenden Sender', async () => {
    const state = newTournamentPushState();
    state.book.set('t1', sub(1), 0);
    const { impl, calls } = sender('retry');
    await deliverTurnPush(state, ['t1'], 'ABCD', impl, 1000, { retryDelayMs: 0 });
    expect(calls).toHaveLength(2);
    const boom: PushSender = { send: async () => { throw new Error('kaputt'); } };
    state.limiter.forget(10 ** 12);
    await expect(deliverTurnPush(state, ['t1'], 'ABCD', boom, 10 ** 12, { retryDelayMs: 0 })).resolves.toBe(0);
  });
});
