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

  it('en passant meldet captured: P im moved-Event', () => {
    const state = gameModule.setup(4, resolveOptions(gameModule), 'ep');
    // Brett manipulieren: Rot Bauer auf f2 (173), Blau Bauer auf e4 (144)
    state.board.fill(null);
    state.board[173] = { c: 'r', t: 'P' };
    state.board[144] = { c: 'b', t: 'P' };
    state.board[13 * 14 + 7] = { c: 'r', t: 'K' };
    state.board[7 * 14 + 0] = { c: 'b', t: 'K' };
    state.board[0 * 14 + 6] = { c: 'y', t: 'K' };
    state.board[6 * 14 + 13] = { c: 'g', t: 'K' };
    // Rot zieht Doppelschritt f2 -> f4 (173 -> 145)
    const { state: s1 } = gameModule.applyMove(state, 0, { t: 'm', p: 'r', f: 173, to: 145 });
    // Blau schlägt en passant e4 -> f3 (144 -> 159)
    const { events } = gameModule.applyMove(s1, 1, { t: 'm', p: 'b', f: 144, to: 159 });
    expect(events[0]).toMatchObject({ type: 'moved', from: 144, to: 159, color: 'b', captured: 'P' });
  });

  it('der Bot liefert erlaubte Züge im Format der Schnittstelle', () => {
    const state = gameModule.setup(4, resolveOptions(gameModule), 'bot');
    for (const level of ['easy', 'medium', 'hard'] as const) {
      const move = computeBotMove(gameModule, { gameId: 'four-player-chess', botId: 'four-player-chess', level, seat: 0, view: state, seed: level, timeBudgetMs: 10 }) as FourChessMove;
      expect(gameModule.legalMoves(state, 0)).toContainEqual(move);
    }
  });

  it('der Easy-Bot beansprucht den Sieg vorrangig', () => {
    const state = gameModule.setup(4, resolveOptions(gameModule), 'claim');
    state.active = { r: true, b: true, y: false, g: false };
    state.scores = { r: 30, b: 5, y: 0, g: 0 };
    const move = computeBotMove(gameModule, { gameId: 'four-player-chess', botId: 'four-player-chess', level: 'easy', seat: 0, view: state, seed: 'easy-claim', timeBudgetMs: 10 });
    expect(move).toEqual({ t: 'claim', p: 'r' });
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
    // Wer aufgegeben hat, kann nicht gewinnen: Es gewinnt Gelb (Platz 2) als einziger verbliebener Spieler.
    expect(session.result).toMatchObject({ kind: 'win', winners: [2], reason: 'last' });
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
  for (const check of gameContractChecks(gameModule, { randomGames: 2, botMoveLimit: 40, maxMoves: 4000 })) test(check.name, check.run, 120_000);
});
