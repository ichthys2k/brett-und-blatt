import { computeBotMove, Rng, type SeatId } from '@brett-und-blatt/engine';
import { checkSecrets, gameContractChecks, playRandomGame } from '@brett-und-blatt/engine/testing';
import { describe, expect, it, test } from 'vitest';
import { buildDeck, gameModule, livingSeats, nightTargets, speakerOf, wolfCount, type Role, type WolvesSheepState } from '../src';

const { applyMove, currentPlayers, legalMoves, playerView, result, setup, timeoutMove } = gameModule;

/** Ein Stand mit festen Rollen: Plätze 0 und 1 Wölfe, Platz 2 Prüfer, der Rest Schafe. */
function fixed(seats = 8, options: Record<string, string> = { debate: '0' }): WolvesSheepState {
  const roles: Role[] = Array<Role>(seats).fill('sheep');
  roles[0] = 'wolf';
  roles[1] = 'wolf';
  roles[2] = 'examiner';
  return { ...setup(seats, options, 'fest'), roles };
}

/** Alle Lebenden bestätigen ihre Wahl; Wölfe wählen `victim`, die anderen das erste erlaubte Ziel. */
function night(state: WolvesSheepState, victim: SeatId): WolvesSheepState {
  let next = state;
  for (const seat of livingSeats(state)) {
    const target = next.roles[seat] === 'wolf' ? victim : nightTargets(next, seat)[0]!;
    next = applyMove(next, seat, { type: 'tap', target }).state;
    next = applyMove(next, seat, { type: 'confirm' }).state;
    next = applyMove(next, seat, { type: 'done' }).state;
  }
  return next;
}

/** Eröffnet den Rat und lässt abstimmen; `votes` nennt die Stimme je Platz. */
function council(state: WolvesSheepState, votes: (seat: SeatId) => SeatId | null): WolvesSheepState {
  let next = applyMove(state, speakerOf(state)!, { type: 'endDebate' }).state;
  for (const seat of livingSeats(state)) next = applyMove(next, seat, { type: 'vote', target: votes(seat) }).state;
  return next;
}

describe('Kartenmischung', () => {
  it('folgt der Tabelle im Regelheft', () => {
    const expected: [number, number][] = [[8, 2], [11, 2], [12, 3], [17, 3], [18, 4]];
    for (const [seats, wolves] of expected) {
      expect(wolfCount(seats)).toBe(wolves);
      const deck = buildDeck(seats);
      expect(deck).toHaveLength(seats);
      expect(deck.filter((role) => role === 'wolf')).toHaveLength(wolves);
      expect(deck.filter((role) => role === 'examiner')).toHaveLength(1);
    }
  });

  it('teilt jede Karte genau einmal aus und mischt je Seed anders', () => {
    const a = setup(12, {}, 'a').roles;
    expect([...a].sort()).toEqual([...buildDeck(12)].sort());
    expect(a).not.toEqual(setup(12, {}, 'b').roles);
  });
});

describe('Nacht', () => {
  it('alle Lebenden müssen bestätigen, unabhängig von der Rolle', () => {
    const state = fixed();
    expect(currentPlayers(state)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    const tapped = applyMove(state, 5, { type: 'tap', target: 0 }).state;
    expect(currentPlayers(tapped)).toContain(5);
    const locked = applyMove(tapped, 5, { type: 'confirm' }).state;
    expect(currentPlayers(locked)).toContain(5);
    expect(currentPlayers(applyMove(locked, 5, { type: 'done' }).state)).not.toContain(5);
  });

  it('Wölfe können kein Rudelmitglied und niemand sich selbst wählen', () => {
    const state = fixed();
    expect(() => applyMove(state, 0, { type: 'tap', target: 1 })).toThrow();
    expect(() => applyMove(state, 3, { type: 'tap', target: 3 })).toThrow();
  });

  it('die Wahl darf bis zur Bestätigung geändert werden', () => {
    let state = applyMove(fixed(), 3, { type: 'tap', target: 4 }).state;
    state = applyMove(state, 3, { type: 'tap', target: 5 }).state;
    expect(state.picks[3]).toBe(5);
    state = applyMove(state, 3, { type: 'confirm' }).state;
    expect(() => applyMove(state, 3, { type: 'tap', target: 6 })).toThrow();
  });

  it('das Opfer scheidet aus und deckt auf, danach folgt die Beratung', () => {
    const state = night(fixed(), 3);
    expect(state.alive[3]).toBe(false);
    expect(state.departures).toEqual([{ seat: 3, role: 'sheep', cause: 'wolves', day: 1 }]);
    expect(state.phase).toBe('debate');
  });

  it('bei uneinigen Wölfen entscheidet das Los zwischen ihren Zielen', () => {
    let state = fixed();
    for (const seat of livingSeats(state)) {
      const target = seat === 0 ? 3 : seat === 1 ? 4 : nightTargets(state, seat)[0]!;
      state = applyMove(state, seat, { type: 'confirm', target, finish: true }).state;
    }
    expect([3, 4]).toContain(state.departures[0]!.seat);
  });

  it('der Prüfer erfährt die Rolle sofort nach dem Bestätigen, nur er', () => {
    let state = applyMove(fixed(), 2, { type: 'confirm', target: 0 }).state;
    expect(playerView(state, 2).examinations).toEqual([{ night: 1, target: 0, role: 'wolf' }]);
    expect(playerView(state, 3).examinations).toEqual([]);
    state = applyMove(state, 2, { type: 'done' }).state;
    expect(state.examinations).toHaveLength(1);
  });
});

describe('Herdenrat', () => {
  it('die meisten Stimmen scheiden aus und decken auf', () => {
    const state = council(night(fixed(), 3), (seat) => (seat === 7 ? 0 : 7));
    expect(state.history[0]!.out).toBe(7);
    expect(state.departures.at(-1)).toEqual({ seat: 7, role: 'sheep', cause: 'council', day: 1 });
    expect(state.phase).toBe('night');
  });

  it('niemand darf für sich selbst stimmen', () => {
    const state = applyMove(night(fixed(), 3), 0, { type: 'endDebate' }).state;
    expect(() => applyMove(state, 4, { type: 'vote', target: 4 })).toThrow();
  });

  it('bei Gleichstand scheidet niemand aus, und es wird Nacht', () => {
    const ballot: Record<number, SeatId> = { 0: 4, 1: 4, 2: 4, 4: 5, 6: 5, 7: 5, 5: 0 };
    const state = council(night(fixed(), 3), (seat) => ballot[seat]!);
    expect(state.history[0]!.out).toBeNull();
    expect(state.alive[4] && state.alive[5]).toBe(true);
    expect(state.phase).toBe('night');
    expect(state.day).toBe(2);
  });

  it('Stimmen bleiben bis zur Auflösung geheim und sind danach öffentlich', () => {
    let state = applyMove(night(fixed(), 3), 0, { type: 'endDebate' }).state;
    state = applyMove(state, 4, { type: 'vote', target: 0 }).state;
    expect(playerView(state, 5).votes[4]).toBeNull();
    expect(playerView(state, 4).votes[4]).toBe(0);
    for (const seat of [0, 1, 2, 5, 6, 7]) state = applyMove(state, seat, { type: 'vote', target: seat === 0 ? 7 : 0 }).state;
    expect(playerView(state, 5).history[0]!.votes[4]).toBe(0);
  });

  it('ein Zeitablauf schließt die Nacht des Platzes in einem Zug ab', () => {
    const state = fixed();
    expect(currentPlayers(applyMove(state, 5, timeoutMove!(state, 5)).state)).not.toContain(5);
  });

  it('ein Zeitablauf im Rat ist eine Enthaltung', () => {
    const state = applyMove(night(fixed(), 3), 0, { type: 'endDebate' }).state;
    const move = timeoutMove!(state, 4);
    expect(move).toEqual({ type: 'vote', target: null });
    expect(currentPlayers(applyMove(state, 4, move).state)).not.toContain(4);
  });
});

describe('Sieg', () => {
  it('die Herde gewinnt, wenn alle Wölfe weg sind', () => {
    let state = council(night(fixed(), 3), (seat) => (seat === 0 ? 1 : 0));
    expect(state.alive[0]).toBe(false);
    expect(result(state)).toBeNull();
    state = council(night(state, 4), (seat) => (seat === 1 ? 2 : 1));
    expect(state.phase).toBe('done');
    expect(result(state)).toMatchObject({ kind: 'win', winners: [2, 3, 4, 5, 6, 7] });
  });

  it('die Wölfe gewinnen erst, wenn das letzte Schaf weg ist', () => {
    let state = fixed();
    for (const victim of [2, 3, 4, 5, 6]) {
      state = night(state, victim);
      expect(result(state)).toBeNull();
      state = council(state, () => null);
    }
    // Zwei Wölfe gegen ein Schaf: Wie im Regelheft geht es weiter, bis das Schaf weg ist.
    expect(state.alive[7]).toBe(true);
    expect(result(night(state, 7))).toMatchObject({ kind: 'win', winners: [0, 1] });
  });
});

describe('Sichten', () => {
  it('fremde Rollen bleiben verborgen, Wölfe kennen einander', () => {
    const state = fixed();
    expect(playerView(state, 3).roles.filter((role) => role !== null)).toEqual(['sheep']);
    expect(playerView(state, 0).roles.slice(0, 3)).toEqual(['wolf', 'wolf', null]);
    expect(playerView(state, 'spectator').roles.every((role) => role === null)).toBe(true);
  });

  it('nur das Rudel sieht die vorläufige Wahl der Wölfe', () => {
    const state = applyMove(fixed(), 0, { type: 'tap', target: 3 }).state;
    expect(playerView(state, 1).picks[0]).toBe(3);
    expect(playerView(state, 3).picks[0]).toBeNull();
    expect(playerView(state, 'spectator').picks[0]).toBeNull();
  });

  it('ausgeschiedene Karten sind für alle offen, Ausgeschiedene sehen alles', () => {
    const state = night(fixed(), 3);
    expect(playerView(state, 'spectator').roles[3]).toBe('sheep');
    expect(playerView(state, 3).roles).toEqual(state.roles);
    expect(playerView(state, 4).roles[0]).toBeNull();
  });
});

describe('Aufgeben', () => {
  it('kostet nur den Platz und deckt seine Karte auf', () => {
    const state = applyMove(fixed(), 4, { type: 'leave' }).state;
    expect(state.alive[4]).toBe(false);
    expect(state.departures[0]).toMatchObject({ seat: 4, cause: 'left' });
    expect(result(state)).toBeNull();
    expect(currentPlayers(state)).not.toContain(4);
  });

  it('schließt die Runde ab, wenn nur noch der Gehende fehlte', () => {
    let state = applyMove(night(fixed(), 3), 0, { type: 'endDebate' }).state;
    for (const seat of [0, 1, 2, 4, 5, 6]) state = applyMove(state, seat, { type: 'vote', target: seat < 2 ? 2 : 0 }).state;
    state = applyMove(state, 7, { type: 'leave' }).state;
    expect(state.history[0]!.out).toBe(0);
    expect(state.phase).toBe('night');
  });

  it('Stimmen und Wolfswahl auf den Gehenden müssen neu abgegeben werden', () => {
    let state = applyMove(fixed(), 0, { type: 'confirm', target: 7, finish: true }).state;
    state = applyMove(state, 7, { type: 'leave' }).state;
    expect(currentPlayers(state)).toContain(0);
    expect(state.picks[0]).toBeNull();
  });

  it('wer den letzten Wolf gehen lässt, beendet die Partie', () => {
    let state = applyMove(fixed(), 0, { type: 'leave' }).state;
    expect(result(state)).toBeNull();
    state = applyMove(state, 1, { type: 'leave' }).state;
    expect(result(state)).toMatchObject({ kind: 'win', winners: [2, 3, 4, 5, 6, 7] });
  });
});

describe('Beratung', () => {
  it('mit Zeit wartet die Spielleitung, ohne Zeit nur der Knopf', () => {
    const timed = night(fixed(8, { debate: '120' }), 3);
    expect(currentPlayers(timed)).toContain('system');
    expect(gameModule.systemDelayMs!(timed)).toBe(120_000);
    const open = night(fixed(8, { debate: '0' }), 3);
    expect(currentPlayers(open)).toEqual([0]);
    expect(legalMoves(open, 'system')).toEqual([]);
  });
});

describe('Bot', () => {
  it('der schwere Prüfer und das Rudel handeln nach ihrem Wissen', () => {
    let state = applyMove(night(fixed(), 3), 0, { type: 'endDebate' }).state;
    state = { ...state, examinations: [{ night: 1, target: 0, role: 'wolf' }] };
    const vote = computeBotMove(gameModule, { gameId: 'wolves-sheep', botId: 'wolves-sheep', level: 'hard', seat: 2, view: playerView(state, 2), seed: 'b', timeBudgetMs: 10 });
    expect(vote).toEqual({ type: 'vote', target: 0 });
    const wolfVote = computeBotMove(gameModule, { gameId: 'wolves-sheep', botId: 'wolves-sheep', level: 'hard', seat: 1, view: playerView(state, 1), seed: 'b', timeBudgetMs: 10 }) as { target: SeatId };
    expect(wolfVote.target).not.toBe(0);
  });
});

const ALL_ON = { debate: '0', shepherd: 'on', hound: 'on', binder: 'on', lamb: 'on', stray: 'on', leader: 'on' };

/** Ein Stand mit festen Rollen aus der angegebenen Liste; die Vorrunde ist schon vorbei. */
function cast(roles: Role[], options: Record<string, string> = {}): WolvesSheepState {
  const base = setup(roles.length, { debate: '0', ...options }, 'besetzt');
  return { ...base, roles, middle: [], strayHolder: null, phase: 'night' };
}

/** Spielt die Nacht durch und den Hirten, falls er noch dran ist. */
function dawnAll(state: WolvesSheepState): WolvesSheepState {
  let next = state;
  for (const seat of livingSeats(state)) {
    const moves = legalMoves(next, seat);
    if (moves[0]?.type === 'shepherd') next = applyMove(next, seat, { type: 'shepherd', save: false, expel: null }).state;
    if (next.phase === 'dawn') next = applyMove(next, seat, { type: 'done' }).state;
  }
  return next;
}

describe('Kartenmischung mit Sonderrollen', () => {
  it('jede Sonderrolle ersetzt ein Schaf, das Zugelaufene Schaf bringt zwei Karten mehr', () => {
    const rolesInPlay = { shepherd: true, hound: true, binder: true, lamb: true, stray: true, leader: true };
    const deck = buildDeck(8, rolesInPlay);
    expect(deck).toHaveLength(10);
    expect(deck.filter((role) => role === 'sheep')).toHaveLength(2);
    const state = setup(8, ALL_ON, 'alle');
    expect(state.roles).toHaveLength(8);
    expect(state.middle).toHaveLength(2);
    expect(state.phase).toBe('preround');
  });
});

describe('Zugelaufenes Schaf', () => {
  const stray = (middle: Role[]): WolvesSheepState => {
    const roles: Role[] = ['stray', 'wolf', 'examiner', 'sheep', 'sheep', 'sheep', 'sheep', 'sheep'];
    return { ...setup(8, { debate: '0', stray: 'on' }, 'x'), roles, middle, strayHolder: 0 };
  };

  it('darf tauschen oder bleiben und sieht als Einziger die Karten', () => {
    const state = stray(['wolf', 'sheep']);
    expect(legalMoves(state, 0)).toContainEqual({ type: 'swap', card: null });
    expect(playerView(state, 0).middle).toEqual(['wolf', 'sheep']);
    expect(playerView(state, 3).middle).toEqual([null, null]);
    const swapped = applyMove(state, 0, { type: 'swap', card: 0 }).state;
    expect(swapped.roles[0]).toBe('wolf');
    expect(swapped.middle[0]).toBe('stray');
  });

  it('muss tauschen, wenn beide Karten Wölfe sind', () => {
    const state = stray(['wolf', 'wolf']);
    expect(legalMoves(state, 0)).not.toContainEqual({ type: 'swap', card: null });
    expect(() => applyMove(state, 0, { type: 'swap', card: null })).toThrow();
  });

  it('Wölfe kennen einander erst in der Nacht, und ihre Auswahl verrät in der Vorrunde nichts', () => {
    const state = { ...stray(['sheep', 'sheep']), roles: ['stray', 'wolf', 'wolf', 'sheep', 'sheep', 'sheep', 'sheep', 'examiner'] as Role[] };
    expect(playerView(state, 1).roles[2]).toBeNull();
    expect(legalMoves(state, 1)).toContainEqual({ type: 'tap', target: 2 });
  });
});

describe('Bandstifter und Verbundene', () => {
  const roles: Role[] = ['binder', 'wolf', 'wolf', 'sheep', 'sheep', 'examiner', 'sheep', 'sheep'];
  const bound = (a: number, b: number): WolvesSheepState => ({ ...cast(roles), bound: [a, b] });

  it('auch sich selbst, und erst nach der Vorrunde erfahren es die zwei', () => {
    let state: WolvesSheepState = { ...setup(8, { debate: '0', binder: 'on' }, 'x'), roles };
    expect(legalMoves(state, 0)).toContainEqual({ type: 'bind', a: 0, b: 4 });
    state = applyMove(state, 0, { type: 'bind', a: 4, b: 3 }).state;
    expect(state.bound).toEqual([3, 4]);
    expect(playerView(state, 0).bound).toEqual([3, 4]);
    expect(playerView(state, 3).bound).toBeNull();
    expect(playerView({ ...state, phase: 'night' }, 3).bound).toEqual([3, 4]);
    expect(playerView({ ...state, phase: 'night' }, 6).bound).toBeNull();
  });

  it('die Rolle des anderen bleibt den Verbundenen verborgen', () => {
    expect(playerView(bound(1, 3), 3).roles[1]).toBeNull();
  });

  it('scheidet einer aus, geht der andere mit', () => {
    const state = night(bound(3, 4), 3);
    expect(state.alive[3]).toBe(false);
    expect(state.alive[4]).toBe(false);
    expect(state.departures.map((entry) => entry.cause)).toEqual(['wolves', 'grief']);
  });

  it('niemand darf im Rat für den Verbundenen stimmen', () => {
    const state = { ...bound(3, 4), phase: 'vote' as const };
    expect(legalMoves(state, 3)).not.toContainEqual({ type: 'vote', target: 4 });
    expect(() => applyMove(state, 3, { type: 'vote', target: 4 })).toThrow();
  });

  it('ein Wolf und ein Schaf gewinnen nur allein übrig, nicht mit ihrer Seite', () => {
    let state = bound(1, 3);
    state = { ...state, alive: state.alive.map((_, seat) => [1, 2, 3].includes(seat)) };
    // Der andere Wolf wählt den Verbundenen nicht aus Rücksicht, sondern scheidet im Rat aus.
    state = { ...state, phase: 'vote' };
    for (const seat of [1, 3]) state = applyMove(state, seat, { type: 'vote', target: 2 }).state;
    state = applyMove(state, 2, { type: 'vote', target: 3 }).state;
    expect(result(state)).toMatchObject({ kind: 'win', winners: [1, 3] });
  });

  it('die Herde gewinnt ohne die gemischten Verbundenen', () => {
    let state: WolvesSheepState = { ...bound(1, 3), phase: 'vote' };
    state = { ...state, alive: state.alive.map((_, seat) => seat !== 2) };
    for (const seat of [0, 4, 5, 6, 7]) state = applyMove(state, seat, { type: 'vote', target: 1 }).state;
    for (const seat of [1, 3]) state = applyMove(state, seat, { type: 'vote', target: 4 }).state;
    expect(result(state)).toMatchObject({ kind: 'win', winners: [0, 4, 5, 6, 7] });
  });
});

describe('Hirte', () => {
  const roles: Role[] = ['wolf', 'wolf', 'shepherd', 'examiner', 'sheep', 'sheep', 'sheep', 'sheep'];
  const withShepherd = () => cast(roles, { shepherd: 'on' });

  it('nur er sieht das Opfer, und niemand fällt schon vor seiner Entscheidung', () => {
    const state = night(withShepherd(), 4);
    expect(state.phase).toBe('dawn');
    expect(state.alive[4]).toBe(true);
    expect(playerView(state, 2).nightVictim).toBe(4);
    expect(playerView(state, 3).nightVictim).toBeNull();
  });

  it('rettet das Opfer genau einmal', () => {
    let state = night(withShepherd(), 4);
    state = applyMove(state, 2, { type: 'shepherd', save: true, expel: null }).state;
    state = dawnAll(state);
    expect(state.alive[4]).toBe(true);
    expect(state.saveUsed).toBe(true);
    state = night(council(state, () => null), 5);
    expect(legalMoves(state, 2).some((move) => move.type === 'shepherd' && move.save)).toBe(false);
  });

  it('kann in einer Nacht retten und ausweisen, auch sich selbst', () => {
    let state = night(withShepherd(), 2);
    state = applyMove(state, 2, { type: 'shepherd', save: true, expel: 5 }).state;
    state = dawnAll(state);
    expect(state.alive[2]).toBe(true);
    expect(state.alive[5]).toBe(false);
    expect(state.departures.at(-1)!.cause).toBe('wolves');
  });

  it('die Runde im Morgengrauen läuft auch, wenn er nichts tut', () => {
    const state = dawnAll(night(withShepherd(), 4));
    expect(state.alive[4]).toBe(false);
    expect(state.phase).toBe('debate');
  });

  it('das Morgengrauen entfällt erst, wenn der Hirte aufgedeckt fort ist', () => {
    const state = cast(roles, { shepherd: 'on' });
    const gone = { ...state, alive: state.alive.map((_, seat) => seat !== 2) };
    expect(night(gone, 4).phase).toBe('debate');
  });
});

describe('Hütehund und Warteschlange', () => {
  const roles: Role[] = ['wolf', 'wolf', 'hound', 'examiner', 'sheep', 'sheep', 'sheep', 'sheep'];

  it('nimmt beim Ausscheiden jemanden mit, bevor es weitergeht', () => {
    let state = night(cast(roles, { hound: 'on' }), 2);
    expect(state.phase).toBe('pending');
    expect(currentPlayers(state)).toEqual([2]);
    state = applyMove(state, 2, { type: 'shoot', target: 0 }).state;
    expect(state.alive[0]).toBe(false);
    expect(state.departures.at(-1)).toMatchObject({ seat: 0, cause: 'hound' });
    expect(state.phase).toBe('debate');
  });

  it('kennt beim Schuss noch keine fremden Rollen', () => {
    const state = night(cast(roles, { hound: 'on' }), 2);
    expect(playerView(state, 2).roles[0]).toBeNull();
    expect(playerView(applyMove(state, 2, { type: 'shoot', target: 3 }).state, 2).roles[0]).toBe('wolf');
  });

  it('der Sieg zählt erst nach dem Schuss', () => {
    let state = cast(['wolf', 'hound', 'sheep', 'sheep', 'sheep', 'sheep', 'sheep', 'sheep'], { hound: 'on' });
    state = { ...state, alive: state.alive.map((_, seat) => seat < 2) };
    state = night(state, 1);
    expect(state.phase).toBe('pending');
    state = applyMove(state, 1, { type: 'shoot', target: 0 }).state;
    expect(state.winner).toBe('none');
  });

  it('schießt auch, wenn er mit dem Verbundenen geht', () => {
    let state: WolvesSheepState = { ...cast(roles, { hound: 'on' }), bound: [2, 4] };
    state = night(state, 4);
    expect(state.alive[2]).toBe(false);
    expect(currentPlayers(state)).toEqual([2]);
    expect(applyMove(state, 2, { type: 'shoot', target: 5 }).state.alive[5]).toBe(false);
  });

  it('wer aufgibt, schießt nicht', () => {
    const state = applyMove(cast(roles, { hound: 'on' }), 2, { type: 'leave' }).state;
    expect(state.pending).toEqual([]);
    expect(state.phase).toBe('night');
  });
});

describe('Leithammel', () => {
  const roles: Role[] = ['wolf', 'wolf', 'sheep', 'examiner', 'sheep', 'sheep', 'sheep', 'sheep'];
  const elected = () => {
    let state = night(cast(roles, { leader: 'on' }), 7);
    expect(state.phase).toBe('election');
    for (const seat of livingSeats(state)) state = applyMove(state, seat, { type: 'elect', target: 2 }).state;
    return state;
  };

  it('wird am ersten Morgen gewählt und eröffnet den Rat', () => {
    const state = elected();
    expect(state.leader).toBe(2);
    expect(state.phase).toBe('debate');
    expect(currentPlayers(state)).toEqual([2]);
  });

  it('bei Gleichstand wird am nächsten Morgen neu gewählt', () => {
    let state = night(cast(roles, { leader: 'on' }), 7);
    for (const seat of livingSeats(state)) state = applyMove(state, seat, { type: 'elect', target: seat === 6 ? null : seat % 2 === 0 ? 2 : 3 }).state;
    expect(state.leader).toBeNull();
    state = night(council(state, () => null), 6);
    expect(state.phase).toBe('election');
  });

  it('zählt im Rat doppelt', () => {
    const ballot: Record<number, SeatId> = { 2: 4, 0: 5, 1: 5, 3: 0, 4: 0, 5: 0, 6: 0 };
    // Der Leithammel stimmt zweifach: 4 bekommt 2, 5 bekommt 2, 0 bekommt 4.
    const state = council(elected(), (seat) => ballot[seat]!);
    expect(state.history[0]!.out).toBe(0);
    const tieBallot: Record<number, SeatId> = { 2: 4, 0: 4, 1: 5, 3: 5, 4: 5, 5: 4, 6: 3 };
    // 4 hat 2 + 1 + 1 = 4 Stimmen, 5 hat 3, 3 hat 1: Ohne doppelte Stimme wäre es Gleichstand.
    expect(council(elected(), (seat) => tieBallot[seat]!).history[0]!.out).toBe(4);
  });

  it('gibt beim Ausscheiden die Glocke weiter', () => {
    let state = council(elected(), (seat) => (seat === 2 ? 3 : 2));
    expect(state.phase).toBe('pending');
    expect(currentPlayers(state)).toEqual([2]);
    state = applyMove(state, 2, { type: 'passBell', target: 3 }).state;
    expect(state.leader).toBe(3);
    expect(state.phase).toBe('night');
  });

  it('wer aufgibt, gibt die Glocke an den ersten Lebenden', () => {
    const state = applyMove(elected(), 2, { type: 'leave' }).state;
    expect(state.leader).toBe(0);
  });
});

describe('Neugieriges Lamm', () => {
  const roles: Role[] = ['wolf', 'wolf', 'lamb', 'examiner', 'sheep', 'sheep', 'sheep', 'sheep'];
  const withLamb = (rng?: WolvesSheepState['rng']) => {
    const state = cast(roles, { lamb: 'on' });
    return rng ? { ...state, rng } : state;
  };

  it('sieht einen Wolf, nur einmal je Nacht und nur es selbst', () => {
    const state = applyMove(withLamb(), 2, { type: 'peek' }).state;
    expect(playerView(state, 2).lambSights).toHaveLength(1);
    expect(roles[playerView(state, 2).lambSights[0]!.target]).toBe('wolf');
    expect(playerView(state, 3).lambSights).toEqual([]);
    expect(() => applyMove(state, 2, { type: 'peek' })).toThrow();
  });

  it('wird es erwischt, trifft es das Lamm statt des Opfers', () => {
    let state = applyMove(withLamb(), 2, { type: 'peek' }).state;
    state = night({ ...state, lambCaught: true }, 4);
    expect(state.alive[2]).toBe(false);
    expect(state.alive[4]).toBe(true);
    expect(state.departures.at(-1)!.cause).toBe('wolves');
  });

  it('das Erwischen bleibt bis zum Morgen verborgen und trifft etwa jedes dritte Mal', () => {
    let caught = 0;
    for (let i = 0; i < 300; i++) {
      const state = applyMove({ ...withLamb(), rng: Rng.fromSeed(`lamm${i}`).state }, 2, { type: 'peek' }).state;
      if (state.lambCaught) caught++;
      expect(playerView(state, 2).lambCaught).toBe(false);
    }
    expect(caught).toBeGreaterThan(70);
    expect(caught).toBeLessThan(130);
  });
});

describe('Erzähler', () => {
  const withNarrator = () => setup(9, { debate: '0', narrator: 'on' }, 'erzähler');

  it('hat keine Karte im Spiel: acht Spieler wie sonst auch', () => {
    const state = withNarrator();
    expect(state.narrator).toBe(0);
    expect(state.deck).toHaveLength(8);
    expect(state.roles[0]).toBe('narrator');
    expect(livingSeats(state)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(currentPlayers(state)).not.toContain(0);
  });

  it('erst ab 9 Plätzen, damit mindestens 8 mitspielen', () => {
    const state = setup(8, { narrator: 'on' }, 'x');
    expect(state.narrator).toBeNull();
    expect(state.deck).toHaveLength(8);
  });

  it('sieht alle Rollen, die anderen sehen seine Sicht nicht', () => {
    const state = withNarrator();
    expect(playerView(state, 0).roles).toEqual(state.roles);
    expect(playerView(state, 'spectator').roles.slice(1).every((role) => role === null)).toBe(true);
  });

  it('eröffnet den Rat, gehört aber nicht zu den Gewinnern', () => {
    let state = withNarrator();
    const wolf = state.roles.indexOf('wolf');
    const prey = state.roles.findIndex((role) => role === 'sheep');
    state = night(state, prey);
    expect(currentPlayers(state)).toEqual([0]);
    state = applyMove(state, 0, { type: 'endDebate' }).state;
    expect(state.phase).toBe('vote');
    expect(wolf).toBeGreaterThan(0);
    const wolves = state.roles.flatMap((role, seat) => (role === 'wolf' ? [seat] : []));
    const others = livingSeats(state).filter((seat) => !wolves.includes(seat));
    const voted = wolves.reduce((current, target) => ({ ...current, alive: current.alive.map((alive, seat) => alive && seat !== target) }), state);
    state = { ...voted, phase: 'vote' };
    for (const seat of others.slice(1)) state = applyMove(state, seat, { type: 'vote', target: others[0]! }).state;
    state = applyMove(state, others[0]!, { type: 'vote', target: others[1]! }).state;
    expect(result(state)).toMatchObject({ kind: 'win' });
    expect((result(state) as { winners: SeatId[] }).winners).not.toContain(0);
  });
});

describe('Alle Rollen zusammen', () => {
  it('Zufallspartien enden regelgerecht und verraten nichts', () => {
    for (const seats of [8, 12, 18]) {
      for (let game = 0; game < 8; game++) playRandomGame(gameModule, seats, ALL_ON, `alle/${seats}/${game}`);
      for (let game = 0; game < 2; game++) checkSecrets(gameModule, seats, ALL_ON, `geheim/${seats}/${game}`);
    }
  });

  it('die Bots spielen ganze Partien auf jeder Stufe', () => {
    for (const level of ['easy', 'medium', 'hard'] as const) {
      for (let game = 0; game < 2; game++) {
        let state = setup(8, ALL_ON, `bots/${level}/${game}`);
        for (let step = 0; !result(state); step++) {
          expect(step).toBeLessThan(2000);
          const seat = currentPlayers(state)[0] as SeatId;
          const move = computeBotMove(gameModule, { gameId: 'wolves-sheep', botId: 'wolves-sheep', level, seat, view: playerView(state, seat), seed: `${game}/${step}`, timeBudgetMs: 10 });
          state = applyMove(state, seat, move as never).state;
        }
      }
    }
  });
});

const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;

// Ausgewogenheit: PRUEFSTAND=1 corepack pnpm exec vitest run packages/games/wolves-sheep --disable-console-intercept
describe.runIf(env.PRUEFSTAND)('Siegquoten', () => {
  const MIXES: Record<string, Record<string, string>> = {
    Einsteiger: {},
    Hirte: { shepherd: 'on' },
    Hütehund: { hound: 'on' },
    Bandstifter: { binder: 'on' },
    Lamm: { lamb: 'on' },
    Zugelaufen: { stray: 'on' },
    Leithammel: { leader: 'on' },
    Alle: { shepherd: 'on', hound: 'on', binder: 'on', lamb: 'on', stray: 'on', leader: 'on' },
  };
  it('Bots gegen Bots je Rollenmischung', { timeout: 300_000 }, () => {
    for (const seats of [8, 12, 18]) {
      for (const [label, options] of Object.entries(MIXES)) {
        const wins: Record<string, number> = {};
        let lengths = 0;
        const games = 150;
        for (let game = 0; game < games; game++) {
          let state = setup(seats, { debate: '0', ...options }, `quote/${seats}/${label}/${game}`);
          for (let step = 0; !result(state); step++) {
            const seat = currentPlayers(state)[0] as SeatId;
            const move = computeBotMove(gameModule, { gameId: 'wolves-sheep', botId: 'wolves-sheep', level: 'medium', seat, view: playerView(state, seat), seed: `${game}/${step}`, timeBudgetMs: 5 });
            state = applyMove(state, seat, move as never).state;
          }
          wins[state.winner!] = (wins[state.winner!] ?? 0) + 1;
          lengths += state.day;
        }
        const pct = (key: string) => `${Math.round(((wins[key] ?? 0) / games) * 100)} %`.padStart(5);
        console.log(`${String(seats).padStart(2)} Plätze ${label.padEnd(12)} Wölfe ${pct('wolves')}  Herde ${pct('flock')}  Paar ${pct('pair')}  Nächte ${(lengths / games).toFixed(1)}`);
      }
    }
  });
});

describe('Vertrag für Spielmodule', () => {
  // Bei 19 Plätzen prüft die Geheimnis-Prüfung je Stichprobe 20 Sichten, das treibt sie an die Zeitgrenze.
  // Volle Tische mit allen Rollen deckt „Alle Rollen zusammen“ ab (18 Plätze).
  for (const check of gameContractChecks(gameModule, { seatCounts: [8, 12] })) test(check.name, check.run);
});

it('die Sicht eines Lebenden verrät keine fremde Rolle über den ganzen Verlauf', () => {
  let state = fixed();
  state = night(state, 3);
  const view = playerView(state, 4);
  for (const [seat, role] of view.roles.entries()) if (seat !== 4 && state.alive[seat]) expect(role).toBeNull();
});
