import { inlineBotRunner, type AnyGameModule } from '@brett-und-blatt/engine';
import { gameModule as blackPeter } from '@brett-und-blatt/game-black-peter';
import { gameModule as ticTacToe } from '@brett-und-blatt/game-tic-tac-toe';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  AWAY_AFTER_DISCONNECT_MS,
  CLOCK_GRACE_MS,
  HOST_HANDOVER_MS,
  PROTOCOL_VERSION,
  Room,
  SIGNAL_INTERVAL_MS,
  parseClientMessage,
  type ClientMessage,
  type GameMessage,
  type RoomDeps,
  type RoomMessage,
  type ServerMessage,
} from '../src';

const SEED = 'GEHEIMER-STARTWERT-4711';
const modules = new Map<string, AnyGameModule>([
  [ticTacToe.info.id, ticTacToe],
  [blackPeter.info.id, blackPeter],
]);

/** Ein Raum mit nachgebauten Verbindungen und einer Uhr, die man vorstellen kann. */
function setup() {
  let time = 1_000_000;
  const inbox = new Map<string, ServerMessage[]>();
  const closed = new Set<string>();
  const deps: RoomDeps = {
    now: () => time,
    findGame: (id) => modules.get(id),
    botRunner: inlineBotRunner([...modules.values()], { timeBudgetMs: 5 }),
    randomSeed: () => SEED,
    send: (connection, message) => {
      // Wie über das Netz: als JSON, damit nichts geteilt wird.
      inbox.set(connection, [...(inbox.get(connection) ?? []), JSON.parse(JSON.stringify(message)) as ServerMessage]);
    },
    close: (connection) => closed.add(connection),
  };
  let room = new Room('🦊🍎🚀🎈⭐🐶', deps);

  const client = (connection: string, token = `token-${connection}-0123456789`, name = connection) => {
    room.connect(connection);
    const c = {
      send: (message: ClientMessage | Record<string, unknown>) => room.receive(connection, JSON.stringify(message)),
      hello: () => c.send({ type: 'hello', protocol: PROTOCOL_VERSION, token, name, avatar: '🦊' }),
      all: () => inbox.get(connection) ?? [],
      last: <T extends ServerMessage['type']>(type: T) => [...c.all()].reverse().find((m) => m.type === type) as Extract<ServerMessage, { type: T }> | undefined,
      game: () => c.last('game') as GameMessage,
      room: () => c.last('room') as RoomMessage,
      clear: () => inbox.set(connection, []),
      token,
    };
    return c;
  };

  return {
    deps,
    get room() {
      return room;
    },
    replaceRoom: (next: Room) => (room = next),
    client,
    closed,
    inbox,
    advance: (ms: number) => {
      time += ms;
    },
    get now() {
      return time;
    },
  };
}

/** Lässt ausstehende Bot-Antworten (Promises) durchlaufen. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

type Env = ReturnType<typeof setup>;
type Client = ReturnType<Env['client']>;

/** Zwei Menschen am Tic-Tac-Toe-Tisch, Partie läuft. */
function twoPlayers(env: Env, time: 'relaxed' | 'normal' = 'relaxed'): [Client, Client] {
  const anna = env.client('anna');
  const ben = env.client('ben');
  anna.hello();
  ben.hello();
  anna.send({ type: 'setGame', gameId: 'tic-tac-toe' });
  anna.send({ type: 'setTime', time });
  anna.send({ type: 'takeSeat', index: 0 });
  ben.send({ type: 'takeSeat', index: 1 });
  anna.send({ type: 'start' });
  return [anna, ben];
}

describe('Nachrichten vom Browser', () => {
  it('nimmt gültige Nachrichten an und lehnt Unsinn ab', () => {
    expect(parseClientMessage('{"type":"takeSeat","index":1}')).toEqual({ type: 'takeSeat', index: 1 });
    expect(parseClientMessage('{"type":"takeSeat","index":-1}')).toBeNull();
    expect(parseClientMessage('{"type":"setSeat","index":0,"seat":{"bot":"hard"}}')).toEqual({ type: 'setSeat', index: 0, seat: { bot: 'hard' } });
    expect(parseClientMessage('{"type":"setSeat","index":0,"seat":{"bot":"god"}}')).toBeNull();
    expect(parseClientMessage('{"type":"hello","protocol":1,"token":"kurz","name":"A","avatar":"🦊"}')).toBeNull();
    expect(parseClientMessage('kein json')).toBeNull();
    expect(parseClientMessage('[1,2]')).toBeNull();
    expect(parseClientMessage('{"type":"selfDestruct"}')).toBeNull();
    expect(parseClientMessage(`{"type":"say","phrase":"${'x'.repeat(20_000)}"}`)).toBeNull();
  });
});

describe('Raum und Lobby', () => {
  let env: Env;
  beforeEach(() => {
    env = setup();
  });

  it('begrüßt neue Mitglieder; das erste leitet den Raum', () => {
    const anna = env.client('anna');
    const ben = env.client('ben');
    anna.hello();
    ben.hello();
    expect(anna.last('welcome')?.you).toBe('m1');
    expect(ben.last('welcome')?.you).toBe('m2');
    expect(ben.room().hostId).toBe('m1');
    expect(ben.room().members.map((m) => m.name)).toEqual(['anna', 'ben']);
  });

  it('verrät die geheime Kennung nie anderen Mitgliedern', () => {
    const [anna, ben] = twoPlayers(env);
    expect(JSON.stringify(ben.all())).not.toContain(anna.token);
  });

  it('ohne Anmeldung geht nichts, ein altes Protokoll wird abgewiesen', () => {
    const anna = env.client('anna');
    anna.send({ type: 'takeSeat', index: 0 });
    expect(anna.last('error')?.code).toBe('notReady');
    anna.send({ type: 'hello', protocol: 999, token: anna.token, name: 'Anna', avatar: '🦊' });
    expect(anna.last('error')?.code).toBe('protocol');
    expect(env.closed.has('anna')).toBe(true);
  });

  it('unpassende Spitznamen werden abgelehnt', () => {
    const anna = env.client('anna', undefined, 'F1ck');
    anna.hello();
    expect(anna.last('error')?.code).toBe('badName');
    expect(anna.last('welcome')).toBeUndefined();
  });

  it('nur die Raumleitung stellt das Spiel ein', () => {
    const anna = env.client('anna');
    const ben = env.client('ben');
    anna.hello();
    ben.hello();
    ben.send({ type: 'setGame', gameId: 'tic-tac-toe' });
    expect(ben.last('error')?.code).toBe('notAllowed');
    anna.send({ type: 'setGame', gameId: 'tic-tac-toe' });
    expect(ben.room().lobby.gameId).toBe('tic-tac-toe');
    expect(ben.room().lobby.seats).toHaveLength(2);
    anna.send({ type: 'setGame', gameId: 'gibt-es-nicht' });
    expect(anna.last('error')?.code).toBe('notAllowed');
  });

  it('startet erst, wenn alle Plätze besetzt sind – Bots zählen als besetzt', () => {
    const anna = env.client('anna');
    anna.hello();
    anna.send({ type: 'setGame', gameId: 'tic-tac-toe' });
    anna.send({ type: 'takeSeat', index: 0 });
    anna.send({ type: 'start' });
    expect(anna.last('error')?.code).toBe('notAllowed');
    anna.send({ type: 'setSeat', index: 1, seat: { bot: 'easy' } });
    anna.send({ type: 'start' });
    expect(anna.room().phase).toBe('playing');
    expect(anna.game().yourSeat).toBe(0);
  });

  it('wer einen Platz wechselt, gibt den alten frei', () => {
    const anna = env.client('anna');
    anna.hello();
    anna.send({ type: 'setGame', gameId: 'tic-tac-toe' });
    anna.send({ type: 'takeSeat', index: 0 });
    anna.send({ type: 'takeSeat', index: 1 });
    expect(anna.room().lobby.seats).toEqual([
      { kind: 'human', memberId: null },
      { kind: 'human', memberId: 'm1' },
    ]);
  });
});

describe('Partie', () => {
  let env: Env;
  beforeEach(() => {
    env = setup();
  });

  it('jeder bekommt nur seine eigenen Züge; ein Zug geht an alle', () => {
    const [anna, ben] = twoPlayers(env);
    const first = anna.game();
    expect(first.current).toEqual([0]);
    expect(first.legalMoves.length).toBeGreaterThan(0);
    expect(ben.game().legalMoves).toEqual([]);
    anna.send({ type: 'move', version: first.version, move: first.legalMoves[0] });
    expect(ben.game().version).toBeGreaterThan(first.version);
    expect(ben.game().current).toEqual([1]);
    expect(ben.game().legalMoves.length).toBeGreaterThan(0);
  });

  it('veraltete und unerlaubte Züge werden abgelehnt', () => {
    const [anna, ben] = twoPlayers(env);
    const first = anna.game();
    anna.send({ type: 'move', version: first.version + 5, move: first.legalMoves[0] });
    expect(anna.last('error')?.code).toBe('staleMove');
    ben.send({ type: 'move', version: first.version, move: first.legalMoves[0] });
    expect(ben.last('error')?.code).toBe('illegalMove');
    anna.send({ type: 'move', version: first.version, move: { cell: 99 } });
    expect(anna.last('error')?.code).toBe('illegalMove');
  });

  it('der Startwert verlässt nie den Server', () => {
    const [anna, ben] = twoPlayers(env);
    anna.send({ type: 'move', version: anna.game().version, move: anna.game().legalMoves[0] });
    for (const message of [...anna.all(), ...ben.all()]) expect(JSON.stringify(message)).not.toContain(SEED);
  });

  it('Geheimnisse: Beim Schwarzen Peter sieht keiner die Karten des anderen', () => {
    const anna = env.client('anna');
    const ben = env.client('ben');
    const zoe = env.client('zoe');
    [anna, ben, zoe].forEach((c) => c.hello());
    anna.send({ type: 'setGame', gameId: 'black-peter' });
    anna.send({ type: 'setSeatCount', count: 2 });
    anna.send({ type: 'takeSeat', index: 0 });
    ben.send({ type: 'takeSeat', index: 1 });
    anna.send({ type: 'start' });
    const views = [anna, ben, zoe].map((c) => JSON.stringify(c.game().view));
    // Drei verschiedene Sichten: Anna, Ben und die Zuschauerin Zoe.
    expect(new Set(views).size).toBe(3);
    expect(zoe.game().yourSeat).toBeNull();
    expect(zoe.game().legalMoves).toEqual([]);
  });

  it('ein Bot am Tisch zieht von selbst', async () => {
    const anna = env.client('anna');
    anna.hello();
    anna.send({ type: 'setGame', gameId: 'tic-tac-toe' });
    anna.send({ type: 'takeSeat', index: 0 });
    anna.send({ type: 'setSeat', index: 1, seat: { bot: 'easy' } });
    anna.send({ type: 'start' });
    anna.send({ type: 'move', version: anna.game().version, move: anna.game().legalMoves[0] });
    await flush();
    expect(anna.game().current).toEqual([0]);
    expect(anna.game().legalMoves.length).toBeGreaterThan(0);
  });

  it('Aufgeben beendet die Partie; danach führt die Raumleitung zurück in die Lobby', () => {
    const [anna, ben] = twoPlayers(env);
    ben.send({ type: 'resign' });
    expect(anna.game().result).toEqual({ kind: 'win', winners: [0], reason: 'resign' });
    expect(anna.room().phase).toBe('finished');
    anna.send({ type: 'toLobby' });
    expect(ben.room().phase).toBe('lobby');
    // Die Plätze bleiben besetzt – eine Revanche ist ein Klick.
    anna.send({ type: 'start' });
    expect(ben.room().phase).toBe('playing');
  });

  it('wer später kommt, schaut zu', () => {
    twoPlayers(env);
    const zoe = env.client('zoe');
    zoe.hello();
    expect(zoe.game().yourSeat).toBeNull();
  });
});

describe('Uhr, Verbindungsabbruch und Wiedereinstieg', () => {
  let env: Env;
  beforeEach(() => {
    env = setup();
  });

  it('Zeitablauf erst nach der Kulanz; dann zieht der Bot', async () => {
    const [anna] = twoPlayers(env, 'normal');
    const wake = env.room.nextWakeup()!;
    expect(wake).toBe(env.now + 10_000 + CLOCK_GRACE_MS + 1);
    env.advance(10_000 + CLOCK_GRACE_MS);
    env.room.tick();
    await flush();
    expect(anna.game().current).toEqual([0]);
    env.advance(1);
    env.room.tick();
    await flush();
    expect(anna.game().current).toEqual([1]);
  });

  it('ein Zug knapp nach Ablauf der Zugzeit zählt noch (Kulanz)', () => {
    const [anna, ben] = twoPlayers(env, 'normal');
    env.advance(10_500);
    anna.send({ type: 'move', version: anna.game().version, move: anna.game().legalMoves[0] });
    expect(ben.game().current).toEqual([1]);
  });

  it('ohne Verbindung übernimmt nach einer Weile ein Bot, bei Rückkehr gibt er den Platz ab', async () => {
    const [anna, ben] = twoPlayers(env);
    env.room.disconnect('anna');
    expect(ben.room().members.find((m) => m.id === 'm1')?.connected).toBe(false);
    expect(env.room.nextWakeup()).toBe(env.now + AWAY_AFTER_DISCONNECT_MS);
    env.advance(AWAY_AFTER_DISCONNECT_MS);
    env.room.tick();
    await flush();
    expect(ben.game().away).toEqual([0]);
    // Der Bot hat für Anna gezogen, jetzt ist Ben dran.
    expect(ben.game().current).toEqual([1]);

    // Anna kommt mit derselben Kennung zurück – auf neuer Verbindung.
    const again = env.client('anna-2', anna.token, 'anna');
    again.hello();
    expect(again.last('welcome')?.you).toBe('m1');
    expect(again.game().yourSeat).toBe(0);
    expect(ben.game().away).toEqual([]);
  });

  it('die Raumleitung geht nach längerer Abwesenheit an ein anderes Mitglied', () => {
    const [, ben] = twoPlayers(env);
    env.room.disconnect('anna');
    env.advance(HOST_HANDOVER_MS);
    env.room.tick();
    expect(ben.room().hostId).toBe('m2');
  });

  it('Speichern und Wiederherstellen: die Partie geht genau dort weiter', () => {
    const [anna, ben] = twoPlayers(env);
    anna.send({ type: 'move', version: anna.game().version, move: anna.game().legalMoves[0] });
    const before = ben.game();
    const snapshot = JSON.parse(JSON.stringify(env.room.snapshot()));
    const restored = Room.restore(snapshot, env.deps);
    env.replaceRoom(restored);
    restored.reattach('anna', 'm1');
    restored.reattach('ben', 'm2');
    ben.clear();
    ben.send({ type: 'move', version: before.version, move: before.legalMoves[0] });
    expect(ben.game().current).toEqual([0]);
  });
});

describe('Signale und Raumleitung', () => {
  let env: Env;
  beforeEach(() => {
    env = setup();
  });

  it('Emoji-Reaktionen gehen an alle, aber nur erlaubte und nicht im Dauerfeuer', () => {
    const [anna, ben] = twoPlayers(env);
    anna.send({ type: 'react', emoji: '👏' });
    expect(ben.last('signal')).toEqual({ type: 'signal', from: 'm1', kind: 'react', value: '👏' });
    ben.clear();
    anna.send({ type: 'react', emoji: '🎉' });
    expect(ben.last('signal')).toBeUndefined();
    env.advance(SIGNAL_INTERVAL_MS);
    anna.send({ type: 'react', emoji: '💩' });
    expect(anna.last('error')?.code).toBe('notAllowed');
    anna.send({ type: 'say', phrase: 'goodGame' });
    expect(ben.last('signal')?.value).toBe('goodGame');
  });

  it('wer entfernt wurde, kommt nicht wieder herein', () => {
    const anna = env.client('anna');
    const ben = env.client('ben');
    anna.hello();
    ben.hello();
    anna.send({ type: 'kick', memberId: 'm2' });
    expect(ben.last('kicked')).toBeDefined();
    expect(env.closed.has('ben')).toBe(true);
    expect(anna.room().members).toHaveLength(1);
    const again = env.client('ben-2', ben.token, 'ben');
    again.hello();
    expect(again.last('kicked')).toBeDefined();
    expect(again.last('welcome')).toBeUndefined();
  });

  it('wer geht, gibt seinen Platz frei – im Spiel übernimmt der Bot', async () => {
    const [anna, ben] = twoPlayers(env);
    ben.send({ type: 'leave' });
    await flush();
    expect(anna.room().members.map((m) => m.id)).toEqual(['m1']);
    expect(anna.game().away).toEqual([1]);
  });
});

describe('Schlafen und Aufwachen', () => {
  it('die Uhr des laufenden Zugs läuft nach dem Wiederherstellen weiter statt neu zu beginnen', () => {
    const env = setup();
    twoPlayers(env, 'normal');
    const wake = env.room.nextWakeup();
    env.advance(4000);
    const restored = Room.restore(JSON.parse(JSON.stringify(env.room.snapshot())), env.deps);
    restored.reattach('anna', 'm1');
    restored.reattach('ben', 'm2');
    expect(restored.nextWakeup()).toBe(wake);
  });
});

describe('Neustart des Servers', () => {
  it('wer nach dem Neustart nicht zurückkommt, wird vom Bot vertreten', async () => {
    const env = setup();
    const [anna] = twoPlayers(env);
    anna.send({ type: 'move', version: anna.game().version, move: anna.game().legalMoves[0] });
    const restored = Room.restore(JSON.parse(JSON.stringify(env.room.snapshot())), env.deps);
    env.replaceRoom(restored);
    // Nur Anna verbindet sich neu (neue Verbindung, gleiche Kennung).
    const again = env.client('anna-neu', anna.token, 'anna');
    again.hello();
    expect(restored.nextWakeup()).toBe(env.now + AWAY_AFTER_DISCONNECT_MS);
    // Zwischendurch schläft der Server und wacht wieder auf: Die Frist läuft trotzdem weiter.
    env.advance(AWAY_AFTER_DISCONNECT_MS / 2);
    const woken = Room.restore(JSON.parse(JSON.stringify(restored.snapshot())), env.deps);
    env.replaceRoom(woken);
    woken.reattach('anna-neu', 'm1');
    env.advance(AWAY_AFTER_DISCONNECT_MS / 2);
    woken.tick();
    await flush();
    expect(again.game().away).toEqual([1]);
    expect(again.game().current).toEqual([0]);
  });
});
