import { computeBotMove, type SeatId } from '@brett-und-blatt/engine';
import { gameContractChecks } from '@brett-und-blatt/engine/testing';
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
    expect(currentPlayers(applyMove(tapped, 5, { type: 'confirm' }).state)).not.toContain(5);
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
      state = applyMove(state, seat, { type: 'confirm', target }).state;
    }
    expect([3, 4]).toContain(state.departures[0]!.seat);
  });

  it('der Prüfer erfährt die Rolle sofort nach dem Bestätigen, nur er', () => {
    let state = applyMove(fixed(), 2, { type: 'confirm', target: 0 }).state;
    expect(playerView(state, 2).examinations).toEqual([{ night: 1, target: 0, role: 'wolf' }]);
    expect(playerView(state, 3).examinations).toEqual([]);
    state = applyMove(state, 3, { type: 'confirm', target: 0 }).state;
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
    let state = applyMove(fixed(), 0, { type: 'confirm', target: 7 }).state;
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

describe('Vertrag für Spielmodule', () => {
  for (const check of gameContractChecks(gameModule)) test(check.name, check.run);
});

it('die Sicht eines Lebenden verrät keine fremde Rolle über den ganzen Verlauf', () => {
  let state = fixed();
  state = night(state, 3);
  const view = playerView(state, 4);
  for (const [seat, role] of view.roles.entries()) if (seat !== 4 && state.alive[seat]) expect(role).toBeNull();
});
