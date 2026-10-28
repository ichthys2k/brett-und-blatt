import { inlineBotRunner, type AnyGameModule, type GameModule } from '@brett-und-blatt/engine';
import { gameModule as blackPeter } from '@brett-und-blatt/game-black-peter';
import { gameModule as ticTacToe } from '@brett-und-blatt/game-tic-tac-toe';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  AWAY_AFTER_DISCONNECT_MS,
  CLOCK_GRACE_MS,
  CORRESPONDENCE_ROOM_TTL_MS,
  HOST_HANDOVER_MS,
  PROTOCOL_VERSION,
  Room,
  SIGNAL_INTERVAL_MS,
  SIGNAL_MAX_PER_WINDOW,
  SIGNAL_WINDOW_MS,
  parseClientMessage,
  type ClientMessage,
  type GameMessage,
  type RoomDeps,
  type RoomMessage,
  type ServerMessage,
} from '../src';

const SEED = 'GEHEIMER-STARTWERT-4711';

/** Kleinstes Spiel mit gleichzeitigem Zug: Beide wählen verdeckt eine Zahl, die höhere gewinnt. */
type PickState = { picks: (number | null)[] };
const together: GameModule<PickState, number> = {
  info: { ...ticTacToe.info, id: 'zugleich', name: 'Zugleich', patterns: ['simultaneous'], hiddenInformation: true },
  options: [],
  timePresets: ticTacToe.timePresets,
  setup: (seats) => ({ picks: Array.from({ length: seats }, () => null) }),
  currentPlayers: (state) => state.picks.flatMap((p, seat) => (p === null ? [seat] : [])),
  legalMoves: (state, actor) => (typeof actor === 'number' && state.picks[actor] === null ? [1, 2, 3] : []),
  applyMove: (state, actor, move) => ({ state: { picks: state.picks.map((p, s) => (s === actor ? move : p)) }, events: [] }),
  playerView: (state, seat) => ({ picks: state.picks.map((p, s) => (s === seat || state.picks.every((x) => x !== null) ? p : null)) }),
  result: (state) => (state.picks.every((p) => p !== null) ? { kind: 'win', winners: [state.picks[0]! >= state.picks[1]! ? 0 : 1] } : null),
  sampleHidden: (view) => ({ picks: view.picks.map((p) => p ?? 1) }),
  bots: ticTacToe.bots as unknown as GameModule<PickState, number>['bots'],
};

/** Reihum weitergeben; wer aufgibt, scheidet aus, der Letzte gewinnt. */
type RoundState = { turn: number; out: boolean[] };
type RoundMove = 'pass' | { resign: number };
const nextIn = (state: RoundState, from: number) => {
  for (let i = 1; i <= state.out.length; i++) {
    const seat = (from + i) % state.out.length;
    if (!state.out[seat]) return seat;
  }
  return from;
};
const round: GameModule<RoundState, RoundMove> = {
  info: { ...ticTacToe.info, id: 'reihum', name: 'Reihum', players: { min: 3, max: 3 } },
  options: [],
  timePresets: ticTacToe.timePresets,
  setup: (seats) => ({ turn: 0, out: Array.from({ length: seats }, () => false) }),
  currentPlayers: (state) => (state.out.filter((o) => !o).length > 1 ? [state.turn] : []),
  legalMoves: (state, actor) => (actor === state.turn && state.out.filter((o) => !o).length > 1 ? ['pass'] : []),
  applyMove: (state, actor, move) => {
    if (move === 'pass') return { state: { ...state, turn: nextIn(state, state.turn) }, events: [] };
    const out = state.out.map((o, s) => o || s === move.resign);
    const next = { turn: state.turn, out };
    return { state: { ...next, turn: out[state.turn] ? nextIn(next, state.turn) : state.turn }, events: [{ type: 'resigned', seat: actor }] };
  },
  playerView: (state) => state,
  result: (state) => (state.out.filter((o) => !o).length === 1 ? { kind: 'win', winners: [state.out.indexOf(false)] } : null),
  resignMove: (state, seat) => (state.out[seat] ? null : { resign: seat }),
  bots: ticTacToe.bots as unknown as GameModule<RoundState, RoundMove>['bots'],
};

const correspondenceGame: AnyGameModule = {
  ...ticTacToe,
  info: { ...ticTacToe.info, id: 'corr-game', name: 'Corr Game' },
  options: [{ id: 'correspondence', label: 'Fernpartie', choices: [{ value: 'no', label: 'Nein' }, { value: 'yes', label: 'Ja' }], default: 'no' }],
  timePresetsFor: (opts) =>
    opts.correspondence === 'yes'
      ? {
          relaxed: { kind: 'perMove', moveMs: 2 * 86_400_000 },
          normal: { kind: 'perMove', moveMs: 86_400_000 },
          fast: { kind: 'perMove', moveMs: 12 * 60 * 60 * 1000 },
        }
      : ticTacToe.timePresets,
};

const joinableGame: GameModule<RoundState, RoundMove | { join: number }> = {
  ...round,
  info: { ...round.info, id: 'offener-tisch', name: 'Offener Tisch', players: { min: 2, max: 6 }, joinMidGame: true },
  options: [{ id: 'emptySeats', label: 'Frei', hidden: true, pattern: '^[0-9,]*$', choices: [{ value: '', label: 'Keine' }], default: '' }],
  setup: (seats, opts) => {
    const empty = new Set((opts.emptySeats ?? '').split(',').filter(Boolean).map(Number));
    return { turn: 0, out: Array.from({ length: seats }, (_, i) => empty.has(i)) };
  },
  applyMove: (state, actor, move) => {
    if (move === 'pass') return { state: { ...state, turn: nextIn(state, state.turn) }, events: [] };
    if ('join' in move) {
      const out = state.out.map((o, s) => (s === move.join ? false : o));
      return { state: { ...state, out }, events: [{ type: 'joined', seat: move.join }] };
    }
    const out = state.out.map((o, s) => o || s === move.resign);
    const next = { turn: state.turn, out };
    return { state: { ...next, turn: out[state.turn] ? nextIn(next, state.turn) : state.turn }, events: [{ type: 'resigned', seat: actor }] };
  },
  seatChangeMove: (state, seat, active) => {
    if (active) return state.out[seat] ? { join: seat } : null;
    return !state.out[seat] ? { resign: seat } : null;
  },
};

const modules = new Map<string, AnyGameModule>([
  [round.info.id, round],
  [ticTacToe.info.id, ticTacToe],
  [blackPeter.info.id, blackPeter],
  [together.info.id, together],
  [correspondenceGame.info.id, correspondenceGame],
  [joinableGame.info.id, joinableGame],
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
  let room = new Room('🦊🍎🚀🎈', deps);

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

  it('freie Plätze fallen beim Start weg, solange genug Spieler übrig sind', () => {
    const anna = env.client('anna');
    const ben = env.client('ben');
    anna.hello();
    ben.hello();
    anna.send({ type: 'setGame', gameId: 'black-peter' });
    anna.send({ type: 'setSeatCount', count: 4 });
    anna.send({ type: 'takeSeat', index: 1 });
    ben.send({ type: 'takeSeat', index: 3 });
    anna.send({ type: 'start' });
    expect(anna.room().phase).toBe('playing');
    expect(anna.game().seats.map((s) => s.memberId)).toEqual(['m1', 'm2']);
    expect(anna.game().yourSeat).toBe(0);
    expect(ben.game().yourSeat).toBe(1);
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

  it('fillSeats verteilt alle verbundenen Mitglieder ohne Platz und erweitert bei Bedarf die Platzzahl', () => {
    const anna = env.client('anna');
    const ben = env.client('ben');
    const cleo = env.client('cleo');
    [anna, ben, cleo].forEach((c) => c.hello());
    anna.send({ type: 'setGame', gameId: 'black-peter' });
    // Standardmäßig hat Schwarzer Peter 2 Plätze (min = 2, max = 6)
    expect(anna.room().lobby.seats).toHaveLength(2);
    // Nicht-Raumleitung darf fillSeats nicht aufrufen
    ben.send({ type: 'fillSeats' });
    expect(ben.last('error')?.code).toBe('notAllowed');
    // Raumleitung verteilt alle 3 Mitglieder -> Plätze wachsen auf 3
    anna.send({ type: 'fillSeats' });
    expect(anna.room().lobby.seats).toEqual([
      { kind: 'human', memberId: 'm1' },
      { kind: 'human', memberId: 'm2' },
      { kind: 'human', memberId: 'm3' },
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

  it('gleichzeitige Züge: Ein Zug mit älterer Version gilt, wenn der Platz seitdem nicht gezogen hat', () => {
    const anna = env.client('anna');
    const ben = env.client('ben');
    anna.hello();
    ben.hello();
    anna.send({ type: 'setGame', gameId: 'zugleich' });
    anna.send({ type: 'takeSeat', index: 0 });
    ben.send({ type: 'takeSeat', index: 1 });
    anna.send({ type: 'start' });
    const seen = ben.game().version;
    expect(anna.game().current).toEqual([0, 1]);
    anna.send({ type: 'move', version: anna.game().version, move: 3 });
    expect(ben.game().version).toBeGreaterThan(seen);
    // Passt ein Zug mit älterer Version nicht mehr, war jemand schneller – kein „nicht erlaubt“.
    ben.send({ type: 'move', version: seen, move: 99 });
    expect(ben.last('error')?.code).toBe('tooLate');
    ben.clear();
    // Ben hat den Stand vor Annas Zug gesehen – sein Zug zählt trotzdem.
    ben.send({ type: 'move', version: seen, move: 2 });
    expect(ben.last('error')).toBeUndefined();
    expect(ben.game().result).toEqual({ kind: 'win', winners: [0] });
    // Ein zweiter Zug mit derselben alten Version wäre doppelt: abgelehnt.
    anna.send({ type: 'move', version: seen, move: 1 });
    expect(anna.last('error')?.code).toBe('staleMove');
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

  it('Raumleitung kann direkt nach Spielende eine Revanche starten (ohne Lobby) mit Platzwechsel', () => {
    const [anna, ben] = twoPlayers(env);
    expect(anna.room().lobby.seats[0]).toEqual({ kind: 'human', memberId: 'm1' });
    expect(anna.room().lobby.seats[1]).toEqual({ kind: 'human', memberId: 'm2' });
    ben.send({ type: 'resign' });
    expect(anna.room().phase).toBe('finished');

    // Direkt Revanche starten mit rotate: true
    anna.send({ type: 'start', rotate: true });
    expect(anna.room().phase).toBe('playing');
    expect(anna.game().round).toBe(2);
    // Plätze wurden getauscht (Ben beginnt, Anna auf Platz 1)
    expect(anna.room().lobby.seats[0]).toEqual({ kind: 'human', memberId: 'm2' });
    expect(anna.room().lobby.seats[1]).toEqual({ kind: 'human', memberId: 'm1' });
    expect(anna.game().yourSeat).toBe(1);
    expect(ben.game().yourSeat).toBe(0);
  });

  it('Raumleitung kann während laufender Partie direkt neu starten (ohne Platzwechsel)', () => {
    const [anna, ben] = twoPlayers(env);
    expect(anna.room().phase).toBe('playing');
    expect(anna.game().round).toBe(1);
    anna.send({ type: 'start', rotate: false });
    expect(anna.room().phase).toBe('playing');
    expect(anna.game().round).toBe(2);
    expect(anna.room().lobby.seats[0]).toEqual({ kind: 'human', memberId: 'm1' });
    expect(anna.room().lobby.seats[1]).toEqual({ kind: 'human', memberId: 'm2' });
  });

  it('Nicht-Raumleitung darf keine Partie starten', () => {
    const [anna, ben] = twoPlayers(env);
    ben.send({ type: 'resign' });
    expect(anna.room().phase).toBe('finished');
    ben.send({ type: 'start' });
    expect(ben.last('error')?.code).toBe('notAllowed');
    expect(anna.room().phase).toBe('finished');
  });

  it('Aufgeben im Spiel mit resignMove: nur dieser Platz scheidet aus', () => {
    const anna = env.client('anna');
    const ben = env.client('ben');
    const cleo = env.client('cleo');
    for (const c of [anna, ben, cleo]) c.hello();
    anna.send({ type: 'setGame', gameId: 'reihum' });
    anna.send({ type: 'takeSeat', index: 0 });
    ben.send({ type: 'takeSeat', index: 1 });
    cleo.send({ type: 'takeSeat', index: 2 });
    anna.send({ type: 'start' });
    expect(ben.game().canResign).toBe(true);
    // Ben gibt auf, während Anna am Zug ist.
    ben.send({ type: 'resign' });
    expect(anna.game().result).toBeNull();
    expect(anna.room().phase).toBe('playing');
    expect(ben.game().canResign).toBe(false);
    expect(cleo.game().events).toContainEqual({ type: 'resigned', seat: 1 });
    anna.send({ type: 'move', version: anna.game().version, move: 'pass' });
    expect(cleo.game().current).toEqual([2]);
    cleo.send({ type: 'resign' });
    expect(anna.game().result).toEqual({ kind: 'win', winners: [0] });
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

  it('ein verlassener Raum weckt nicht im Dauertakt', () => {
    const anna = env.client('anna');
    anna.hello();
    env.room.disconnect('anna');
    // Niemand da, der die Leitung übernehmen könnte: erst zum Löschen wieder wecken.
    expect(env.room.nextWakeup()).toBe(env.room.expiresAt());
    env.advance(HOST_HANDOVER_MS);
    env.room.tick();
    expect(env.room.nextWakeup()!).toBeGreaterThan(env.now);
    // Kommt jemand Neues, zählt die Frist für den Wechsel wieder.
    env.client('ben').hello();
    expect(env.room.nextWakeup()).toBeLessThanOrEqual(env.now);
    env.room.tick();
    expect(env.room.nextWakeup()!).toBeGreaterThan(env.now);
  });

  it('ein abgelaufener Raum mit Verbindung wird nicht sofort wieder geweckt', () => {
    const anna = env.client('anna');
    anna.hello();
    env.advance(env.room.expiresAt() - env.now + 1);
    expect(env.room.nextWakeup()!).toBeGreaterThan(env.now);
  });

  it('Fernpartien: 30 Tage Lebensdauer und kein Bot-Ersatz nach kurzem Verbindungsabbruch', () => {
    const anna = env.client('anna');
    const ben = env.client('ben');
    anna.hello();
    ben.hello();
    anna.send({ type: 'setGame', gameId: 'corr-game' });
    anna.send({ type: 'setOption', id: 'correspondence', value: 'yes' });
    anna.send({ type: 'takeSeat', index: 0 });
    ben.send({ type: 'takeSeat', index: 1 });
    expect(env.room.isCorrespondence()).toBe(true);
    expect(env.room.expiresAt()).toBe(env.now + CORRESPONDENCE_ROOM_TTL_MS);

    anna.send({ type: 'start' });

    // Anna trennt die Verbindung (schließt den Tab)
    env.room.disconnect('anna');
    // Nach 25 Sekunden (mehr als die üblichen 20s AWAY_AFTER_DISCONNECT_MS)
    env.advance(25_000);
    env.room.tick();
    // Anna darf nicht als abwesend markiert werden
    expect(env.room.snapshot().members.find((m) => m.name === 'anna')?.awayByDisconnect).toBe(false);
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

  it('Signale sind pro Zeitfenster begrenzt (Spam-Schutz)', () => {
    const [anna, ben] = twoPlayers(env);
    for (let i = 0; i < SIGNAL_MAX_PER_WINDOW; i++) {
      if (i > 0) env.advance(SIGNAL_INTERVAL_MS);
      ben.clear();
      anna.send({ type: 'react', emoji: '👍' });
      expect(ben.last('signal')?.value).toBe('👍');
    }
    // Das nächste Signal im selben Fenster wird verworfen
    env.advance(SIGNAL_INTERVAL_MS);
    ben.clear();
    anna.send({ type: 'react', emoji: '🎉' });
    expect(ben.last('signal')).toBeUndefined();

    // Sobald das älteste Signal aus dem 60-Sekunden-Fenster fällt, ist wieder eins erlaubt
    env.advance(SIGNAL_WINDOW_MS);
    anna.send({ type: 'react', emoji: '🎉' });
    expect(ben.last('signal')?.value).toBe('🎉');
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

describe('Offene Spiele (publicListing)', () => {
  it('liefert null ohne gewähltes Spiel oder wenn niemand verbunden ist', () => {
    const env = setup();
    expect(env.room.publicListing()).toBeNull();
    const anna = env.client('anna');
    anna.hello();
    // Noch kein Spiel gewählt
    expect(env.room.publicListing()).toBeNull();
  });

  it('liefert ein Listing, sobald ein Spiel gewählt ist und freie Plätze existieren', () => {
    const env = setup();
    const anna = env.client('anna');
    anna.hello();
    anna.send({ type: 'setGame', gameId: 'tic-tac-toe' });
    const listing = env.room.publicListing();
    expect(listing).not.toBeNull();
    expect(listing?.gameId).toBe('tic-tac-toe');
    expect(listing?.gameName).toBe(ticTacToe.info.name);
    expect(listing?.hostName).toBe('anna');
    expect(listing?.totalSeats).toBe(2);
    expect(listing?.filledSeats).toBe(0);
  });

  it('liefert null, wenn der Raum privat geschaltet wird', () => {
    const env = setup();
    const anna = env.client('anna');
    anna.hello();
    anna.send({ type: 'setGame', gameId: 'tic-tac-toe' });
    expect(env.room.publicListing()).not.toBeNull();

    anna.send({ type: 'setPublic', isPublic: false });
    expect(env.room.publicListing()).toBeNull();

    anna.send({ type: 'setPublic', isPublic: true });
    expect(env.room.publicListing()).not.toBeNull();
  });

  it('liefert null, sobald das Spiel gestartet wurde oder alle Plätze belegt sind', () => {
    const env = setup();
    const anna = env.client('anna');
    const ben = env.client('ben');
    anna.hello();
    ben.hello();
    anna.send({ type: 'setGame', gameId: 'tic-tac-toe' });
    anna.send({ type: 'takeSeat', index: 0 });
    ben.send({ type: 'takeSeat', index: 1 });
    // Alle Plätze belegt
    expect(env.room.publicListing()).toBeNull();

    // Platz wieder frei
    ben.send({ type: 'leaveSeat' });
    expect(env.room.publicListing()).not.toBeNull();

    // Ben nimmt wieder Platz und Spiel startet
    ben.send({ type: 'takeSeat', index: 1 });
    anna.send({ type: 'start' });
    expect(env.room.publicListing()).toBeNull();
  });

  it('liefert null, wenn alle Mitglieder die Verbindung trennen', () => {
    const env = setup();
    const anna = env.client('anna');
    anna.hello();
    anna.send({ type: 'setGame', gameId: 'tic-tac-toe' });
    expect(env.room.publicListing()).not.toBeNull();

    env.room.disconnect('anna');
    expect(env.room.publicListing()).toBeNull();

    env.room.reattach('anna', 'm1');
    expect(env.room.publicListing()).not.toBeNull();
  });

  it('erlaubt bei Spielen mit joinMidGame (z. B. Poker) das Hinsetzen und Aufstehen im laufenden Betrieb', () => {
    const env = setup();
    const anna = env.client('anna');
    const ben = env.client('ben');
    const clara = env.client('clara');
    anna.hello();
    ben.hello();

    anna.send({ type: 'setGame', gameId: 'offener-tisch' });
    // Standardmäßig werden 6 Plätze geöffnet
    expect(anna.room().lobby.seats).toHaveLength(6);

    anna.send({ type: 'takeSeat', index: 0 });
    ben.send({ type: 'takeSeat', index: 1 });
    anna.send({ type: 'start' });

    expect(anna.room().phase).toBe('playing');
    // Freie Plätze 2..5 sind weiterhin offen; der Raum bleibt im publicListing sichtbar!
    const listing = env.room.publicListing();
    expect(listing).not.toBeNull();
    expect(listing?.totalSeats).toBe(6);
    expect(listing?.filledSeats).toBe(2);

    // Clara kommt während der laufenden Partie in den Raum und setzt sich auf Platz 2.
    clara.hello();
    expect(clara.game().yourSeat).toBeNull();
    clara.send({ type: 'takeSeat', index: 2 });
    expect(clara.game().yourSeat).toBe(2);
    expect(env.room.publicListing()?.filledSeats).toBe(3);

    // Clara steht wieder vom Tisch auf -> Platz 2 wird wieder frei.
    clara.send({ type: 'leaveSeat' });
    expect(clara.game().yourSeat).toBeNull();
    expect(env.room.publicListing()?.filledSeats).toBe(2);
  });
});

