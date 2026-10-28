import { resolveOptions } from '@brett-und-blatt/engine';
import { describe, expect, it } from 'vitest';
import { gameModule, type FourChessMove, type FourChessState } from '../src';
import { checks, replayStates, trophies } from '../src/ui/history';

/** Zufallspartie mit festem Ablauf (einfacher Zähl-Zufall), inklusive Aufgeben. */
function playRandom(mode: 'ffa' | 'teams', plies: number, seed = 7): FourChessState {
  let state = gameModule.setup(4, { ...resolveOptions(gameModule), mode }, 'chronik');
  let x = seed;
  const rnd = () => {
    x = (x * 1103515245 + 12345) % 2147483648;
    return x / 2147483648;
  };
  for (let i = 0; i < plies && !gameModule.result(state); i++) {
    const seat = gameModule.currentPlayers(state)[0] as number;
    if (i === 40 && mode === 'ffa') {
      // Grün gibt mittendrin auf – auch das muss der Rückblick nachspielen.
      const resign = gameModule.resignMove!(state, 3);
      if (resign) state = gameModule.applyMove(state, 3, resign).state;
      continue;
    }
    const moves = gameModule.legalMoves(state, seat) as FourChessMove[];
    // Schlagzüge bevorzugen, damit es etwas zu sehen gibt.
    const captures = moves.filter((m) => m.t === 'm' && state.board[m.to]);
    const pool = captures.length && rnd() < 0.7 ? captures : moves;
    const move = pool[Math.floor(rnd() * pool.length)]!;
    state = gameModule.applyMove(state, seat, move).state;
  }
  return state;
}

describe('Chronik und Rückblick', () => {
  for (const mode of ['ffa', 'teams'] as const) {
    it(`spielt jede Stellung nach (${mode})`, () => {
      const state = playRandom(mode, 160);
      const states = replayStates(state);
      expect(states).not.toBeNull();
      const lastWithAction = states!.findLast((s) => s !== null)!;
      expect(lastWithAction.board).toEqual(state.board);
      expect(lastWithAction.scores).toEqual(state.scores);
      expect(lastWithAction.turn).toEqual(state.turn);
    });
  }

  it('merkt sich, wer welche Figur geschlagen hat', () => {
    const state = playRandom('ffa', 120);
    const won = trophies(state.log);
    const total = Object.values(won).reduce((n, list) => n + list.length, 0);
    expect(total).toBeGreaterThan(0);
    const hits = state.log.filter((e) => e.type === 'move' && e.text.includes('×'));
    expect(total).toBe(hits.length);
  });

  it('ältere Spielstände ohne Aktionen haben keinen Rückblick', () => {
    const state = playRandom('ffa', 10);
    for (const entry of state.log) delete entry.action;
    expect(replayStates(state)).toBeNull();
  });

  it('nennt den Angreifer bei Schach', () => {
    const state = gameModule.setup(4, resolveOptions(gameModule), 'schach');
    state.board.fill(null);
    state.board[13 * 14 + 7] = { c: 'r', t: 'K' };
    state.board[7 * 14 + 0] = { c: 'b', t: 'K' };
    state.board[0 * 14 + 6] = { c: 'y', t: 'K' };
    state.board[8 * 14 + 13] = { c: 'g', t: 'K' };
    // Blaue Dame auf h8 greift den roten König auf h1 senkrecht an.
    state.board[6 * 14 + 7] = { c: 'b', t: 'Q' };
    const found = checks(state);
    expect(found).toEqual([{ color: 'r', king: 13 * 14 + 7, attackers: [{ sq: 6 * 14 + 7, c: 'b', t: 'Q' }] }]);
  });
});
