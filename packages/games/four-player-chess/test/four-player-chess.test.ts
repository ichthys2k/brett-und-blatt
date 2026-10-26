import { computeBotMove, inlineBotRunner, LocalSession, resolveOptions, type SessionConfig } from '@brett-und-blatt/engine';
import { gameContractChecks } from '@brett-und-blatt/engine/testing';
import { describe, expect, it, test } from 'vitest';
import { gameModule, type FourChessMove, type FourChessState } from '../src';

describe('Anbindung an die Schnittstelle', () => {
  it('Rot beginnt und hat 20 Eröffnungszüge', () => {
    const state = gameModule.setup(4, resolveOptions(gameModule), 'test');
    expect(gameModule.currentPlayers(state)).toEqual([0]);
    expect(gameModule.legalMoves(state, 0)).toHaveLength(20);
    expect(gameModule.legalMoves(state, 1)).toHaveLength(0);
  });

  it('ein Zug ändert den alten Spielstand nicht und gibt an Blau weiter', () => {
    const state = gameModule.setup(4, resolveOptions(gameModule), 'test');
    const before = JSON.stringify(state);
    const move = gameModule.legalMoves(state, 0)[0]!;
    const { state: next, events } = gameModule.applyMove(state, 0, move);
    expect(JSON.stringify(state)).toBe(before);
    expect(gameModule.currentPlayers(next)).toEqual([1]);
    expect(events[0]).toMatchObject({ type: 'moved' });
  });

  it('der Bot liefert erlaubte Züge im Format der Schnittstelle', () => {
    const state = gameModule.setup(4, resolveOptions(gameModule), 'bot');
    for (const level of ['easy', 'medium', 'hard'] as const) {
      const move = computeBotMove(gameModule, { gameId: 'four-player-chess', botId: 'four-player-chess', level, seat: 0, view: state, seed: level, timeBudgetMs: 10 }) as FourChessMove;
      expect(gameModule.legalMoves(state, 0)).toContainEqual(move);
    }
  });
});

function hotSeat(mode: 'ffa' | 'teams') {
  const config: SessionConfig = {
    gameId: 'four-player-chess',
    seats: ['Rot', 'Blau', 'Gelb', 'Grün'].map((name) => ({ kind: 'human' as const, name })),
    options: { mode },
    seed: 'aufgeben',
    time: { kind: 'none' },
  };
  return new LocalSession(gameModule, config, { botRunner: inlineBotRunner([gameModule]) });
}

describe('Aufgeben', () => {
  it('lässt im Modus „Jeder gegen jeden“ nur die eigene Farbe ausscheiden', () => {
    const session = hotSeat('ffa');
    // Blau gibt auf, obwohl Rot am Zug ist.
    session.resign(1);
    expect(session.result).toBeNull();
    const state = session.state as FourChessState;
    expect(state.active).toEqual({ r: true, b: false, y: true, g: true });
    expect(state.out.b).toBe('resign');
    expect(session.canResign(1)).toBe(false);
    expect(session.canResign(0)).toBe(true);
    // Rot zieht, danach ist Gelb dran – Blau wird übersprungen.
    expect(session.submit(0, session.legalMoves(0)[0]!)).toBe(true);
    expect(session.currentSeats()).toEqual([2]);
  });

  it('wer am Zug aufgibt, gibt den Zug weiter; mit dem Letzten endet die Partie', () => {
    const session = hotSeat('ffa');
    session.resign(0);
    expect(session.currentSeats()).toEqual([1]);
    session.resign(1);
    expect(session.result).toBeNull();
    session.resign(3);
    // Es gewinnt, wer die meisten Punkte hat – hier steht es überall 0, also alle.
    expect(session.result).toMatchObject({ kind: 'win', winners: [0, 1, 2, 3], reason: 'last' });
  });

  it('lässt sich nachspielen und zurücknehmen', () => {
    const session = hotSeat('ffa');
    session.resign(2);
    const restored = LocalSession.restore(gameModule, session.snapshot(), { botRunner: inlineBotRunner([gameModule]) });
    expect((restored.state as FourChessState).active.y).toBe(false);
    expect(session.undo()).toBe(true);
    expect((session.state as FourChessState).active.y).toBe(true);
  });

  it('im Teammodus verliert das ganze Team', () => {
    const session = hotSeat('teams');
    session.resign(1);
    expect(session.result).toMatchObject({ kind: 'win', winners: [0, 2], reason: 'resign' });
  });

  it('steht nicht in den erlaubten Zügen, damit Bots nie aufgeben', () => {
    const state = gameModule.setup(4, resolveOptions(gameModule), 'test');
    expect(gameModule.legalMoves(state, 0).some((m) => m.t === 'resign')).toBe(false);
    expect(() => gameModule.applyMove(state, 0, { t: 'resign', p: 'b' })).toThrow();
  });
});

describe('Zeitablauf mit Schachuhr', () => {
  function clocked(mode: 'ffa' | 'teams') {
    let time = 0;
    const config: SessionConfig = {
      gameId: 'four-player-chess',
      seats: ['Rot', 'Blau', 'Gelb', 'Grün'].map((name) => ({ kind: 'human' as const, name })),
      options: { mode },
      seed: 'zeit',
      time: { kind: 'chessClock', baseMs: 1_000, incrementMs: 0 },
    };
    const session = new LocalSession(gameModule, config, { botRunner: inlineBotRunner([gameModule]), now: () => time });
    return { session, advance: (ms: number) => (time += ms) };
  }

  it('lässt im Modus „Jeder gegen jeden“ nur die eigene Farbe ausscheiden', () => {
    const { session, advance } = clocked('ffa');
    advance(1_500);
    session.tick();
    expect(session.result).toBeNull();
    expect(session.forfeit).toBeNull();
    const state = session.state as FourChessState;
    expect(state.out.r).toBe('time');
    expect(session.currentSeats()).toEqual([1]);
    expect(session.log.at(-1)).toMatchObject({ actor: 0, cause: 'timeout', move: { t: 'resign', p: 'r', time: true } });
  });

  it('im Teammodus verliert das ganze Team wegen Zeit', () => {
    const { session, advance } = clocked('teams');
    advance(1_500);
    session.tick();
    expect(session.result).toMatchObject({ kind: 'win', winners: [1, 3], reason: 'time' });
  });
});

describe('Vertrag für Spielmodule', () => {
  for (const check of gameContractChecks(gameModule, { randomGames: 2, botMoveLimit: 40, maxMoves: 4000 })) test(check.name, check.run);
});
