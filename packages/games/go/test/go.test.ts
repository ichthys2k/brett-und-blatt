import { computeBotMove, resolveOptions, type BotLevel, type Options } from '@brett-und-blatt/engine';
import { gameContractChecks } from '@brett-und-blatt/engine/testing';
import { describe, expect, it, test } from 'vitest';
import { gameModule, loadFromSgf, parseSgf, scoreOf, toSgf, tryPlace, type GoMove, type GoState } from '../src';
import { BLACK, EMPTY, positionHash, WHITE } from '../src/board';

const at = (row: number, col: number, size = 9) => row * size + col;
const place = (point: number): GoMove => ({ type: 'place', point });

function start(options: Options = {}): GoState {
  return gameModule.setup(2, resolveOptions(gameModule, options), 'test');
}

/** Stellung aus Text: x Schwarz, o Weiß, . frei. */
function position(rows: string[], turn = 0, options: Options = {}): GoState {
  const state = start({ size: String(rows.length), ...options });
  const board = rows.join('').split('').map((ch) => (ch === 'x' ? BLACK : ch === 'o' ? WHITE : EMPTY));
  return { ...state, board, turn, history: [positionHash(board)] };
}

function play(state: GoState, moves: GoMove[]): GoState {
  for (const move of moves) {
    const actor = gameModule.currentPlayers(state)[0]!;
    state = gameModule.applyMove(state, actor as number, move).state;
  }
  return state;
}

describe('Regeln', () => {
  it('schlägt einen Einzelstein in der Ecke', () => {
    const state = position(['o........', 'x........', '.........', '.........', '.........', '.........', '.........', '.........', '.........']);
    const { state: next, events } = gameModule.applyMove(state, 0, place(at(0, 1)));
    expect(next.board[0]).toBe(EMPTY);
    expect(next.captures).toEqual([1, 0]);
    expect(events.some((e) => e.type === 'captured')).toBe(true);
  });

  it('schlägt eine ganze Gruppe und mehrere Gruppen auf einmal', () => {
    const state = position(['oo.oox...', 'xx.xx....', '.........', '.........', '.........', '.........', '.........', '.........', '.........']);
    const next = gameModule.applyMove(state, 0, place(at(0, 2))).state;
    expect(next.captures[0]).toBe(4);
    expect([0, 1, 3, 4].every((c) => next.board[at(0, c)] === EMPTY)).toBe(true);
  });

  it('Selbstmord ist verboten, Schlagen mit dem letzten Freiheitspunkt erlaubt', () => {
    const suicide = position(['.o.......', 'o........', '.........', '.........', '.........', '.........', '.........', '.........', '.........']);
    expect(gameModule.isLegal!(suicide, 0, place(0))).toBe(false);
    // Weiß auf b1 hat nur noch a1 als Freiheit – Schwarz darf dort setzen und schlägt.
    const capture = position(['.ox......', 'ox.......', 'x........', '.........', '.........', '.........', '.........', '.........', '.........']);
    expect(gameModule.isLegal!(capture, 0, place(0))).toBe(true);
    const next = gameModule.applyMove(capture, 0, place(0)).state;
    expect(next.board[at(0, 1)]).toBe(EMPTY);
    expect(next.board[at(1, 0)]).toBe(EMPTY);
  });

  it('Ko: ein eben geschlagener Stein darf nicht sofort zurückgeschlagen werden', () => {
    const state = position(['.xo......', 'xo.o.....', '.xo......', '.........', '.........', '.........', '.........', '.........', '.........']);
    // Schwarz schlägt auf c2 den weißen Stein b2.
    const next = gameModule.applyMove(state, 0, place(at(1, 2))).state;
    expect(next.board[at(1, 1)]).toBe(EMPTY);
    expect(next.ko).toBe(at(1, 1));
    expect(gameModule.isLegal!(next, 1, place(at(1, 1)))).toBe(false);
    // Nach einem Zug woanders geht es wieder.
    const later = play(next, [place(at(8, 8)), place(at(8, 0))]);
    expect(gameModule.isLegal!(later, 1, place(at(1, 1)))).toBe(true);
  });

  it('die fortgeschriebene Prüfsumme stimmt mit der neu berechneten überein', () => {
    let state = start();
    for (let i = 0; i < 200 && !gameModule.result(state); i++) {
      const moves = gameModule.legalMoves(state, state.turn).filter((m) => m.type === 'place');
      if (moves.length === 0) break;
      state = gameModule.applyMove(state, state.turn, moves[(i * 37) % moves.length]!).state;
      expect(state.history[state.history.length - 1]).toBe(positionHash(state.board));
      // Die Schnellprüfung in legalMoves findet genau die Züge, die tryPlace erlaubt.
      const fast = gameModule.legalMoves(state, state.turn).flatMap((m) => (m.type === 'place' ? [m.point] : []));
      const slow = state.board.flatMap((_, p) => (tryPlace(state, p, state.turn) ? [p] : []));
      expect(fast).toEqual(slow);
    }
  });

  it('Flächenwertung mit Komi und toten Steinen', () => {
    const state = position(['....x.o..', '....x.o..', '....x.o..', '....x.o..', '....x.o..', '....x.o..', '....x.o..', '....x.o.x', '....x.o..']);
    const plain = scoreOf(state);
    // Der schwarze Stein berührt Weiß' Gebiet: Dort ist alles neutral.
    expect(plain.black).toBe(46);
    expect(plain.white).toBe(9 + 7.5);
    // Der schwarze Stein in Weiß' Gebiet ist tot.
    const withDead = scoreOf({ ...state, dead: [at(7, 8)] });
    expect(withDead.black).toBe(45);
    expect(withDead.white).toBe(27 + 7.5);
  });

  it('Vorgabe: Steine auf den Sternpunkten, Weiß beginnt, Komi 0,5', () => {
    const state = start({ handicap: '4' });
    expect(state.board.filter((v) => v === BLACK)).toHaveLength(4);
    expect(state.turn).toBe(1);
    expect(state.komi).toBe(0.5);
    expect(start({ size: '19', handicap: '9' }).board.filter((v) => v === BLACK)).toHaveLength(9);
  });

  it('Atari-Go: Wer zuerst schlägt, gewinnt', () => {
    const state = position(['o........', 'x........', '.........', '.........', '.........', '.........', '.........', '.........', '.........'], 0, { variant: 'atari' });
    const next = gameModule.applyMove(state, 0, place(at(0, 1))).state;
    expect(gameModule.result(next)).toEqual({ kind: 'win', winners: [0], reason: 'erster Schlag' });
  });

  it('Auszählphase: Markieren, Einigung, Weiterspielen', () => {
    const state = position(['....x.o..', '....x.o..', '....x.o..', '....x.o..', '....x.o..', '....x.o..', '....x.o..', '....x.o.x', '....x.o..']);
    let s = play(state, [{ type: 'pass' }, { type: 'pass' }]);
    expect(s.phase).toBe('scoring');
    expect(gameModule.currentPlayers(s)).toEqual([0, 1]);
    // Der Vorschlag erkennt den einzelnen schwarzen Stein als tot.
    expect(s.dead).toEqual([at(7, 8)]);
    // Weiterspielen hebt die Auszählung auf.
    const resumed = gameModule.applyMove(s, 1, { type: 'resume' }).state;
    expect(resumed.phase).toBe('play');
    // Markieren setzt Zustimmungen zurück.
    s = gameModule.applyMove(s, 0, { type: 'acceptScore' }).state;
    expect(gameModule.currentPlayers(s)).toEqual([1]);
    s = gameModule.applyMove(s, 1, { type: 'toggleDead', point: at(7, 8) }).state;
    expect(s.dead).toEqual([]);
    expect(s.accepted).toEqual([false, false]);
    s = gameModule.applyMove(s, 1, { type: 'toggleDead', point: at(7, 8) }).state;
    s = gameModule.applyMove(s, 0, { type: 'acceptScore' }).state;
    s = gameModule.applyMove(s, 1, { type: 'acceptScore' }).state;
    expect(gameModule.result(s)).toEqual({ kind: 'win', winners: [0], reason: 'Auszählung' });
    expect(s.end).toMatchObject({ black: 45, white: 34.5 });
  });

  it('Zeitablauf in der Auszählphase bestätigt den Vorschlag', () => {
    const state = play(start(), [{ type: 'pass' }, { type: 'pass' }]);
    expect(gameModule.resignMove!(state, 0, 'time')).toEqual({ type: 'acceptScore' });
    expect(gameModule.resignMove!(start(), 0, 'time')).toEqual({ type: 'resign', seat: 0, time: true });
  });

  it('SGF hin und zurück ohne Verlust', () => {
    const moves = [place(at(2, 2)), place(at(6, 6)), { type: 'pass' } as GoMove, place(at(4, 4))];
    const state = play(start({ handicap: '2', size: '9' }), moves);
    const sgf = toSgf(state);
    const parsed = parseSgf(sgf);
    expect(parsed.size).toBe(9);
    expect(parsed.komi).toBe(0.5);
    expect(parsed.handicapStones).toEqual(state.handicapStones);
    expect(parsed.moves).toEqual(state.record);
  });

  it('loadFromSgf stellt den vollständigen Spielstand her', () => {
    const moves = [place(at(2, 2)), place(at(6, 6)), { type: 'pass' } as GoMove, place(at(4, 4))];
    const initial = play(start({ handicap: '2', size: '9' }), moves);
    const sgf = toSgf(initial);
    const loaded = loadFromSgf(sgf);
    expect(loaded.size).toBe(9);
    expect(loaded.komi).toBe(0.5);
    expect(loaded.record).toEqual(initial.record);
    expect(loaded.board).toEqual(initial.board);
    expect(loaded.turn).toBe(initial.turn);

    const viaMove = gameModule.applyMove(start({ size: '9' }), 0, { type: 'loadSgf', sgf }).state;
    expect(viaMove.board).toEqual(initial.board);
  });

  it('Fernpartie: liefert tageweise Zeitvorgaben', () => {
    const presets = gameModule.timePresetsFor!({ correspondence: 'yes' });
    expect(presets.relaxed).toEqual({ kind: 'perMove', moveMs: 2 * 86_400_000 });
    expect(presets.normal).toEqual({ kind: 'perMove', moveMs: 86_400_000 });
  });
});

describe('Bot', () => {
  function bot(state: GoState, level: BotLevel = 'medium', seed = 'bot'): GoMove {
    return computeBotMove(gameModule, { gameId: 'go', botId: 'go', level, seat: state.turn, view: state, seed, timeBudgetMs: 1_000 }) as GoMove;
  }

  it('schlägt eine Gruppe in Atari, bevor sie entkommt', () => {
    const state = position(['.........', '.........', '.........', '...xxx...', '..xooo...', '...xxx...', '.........', '.........', '.........']);
    expect(bot(state)).toEqual(place(at(4, 6)));
  });

  it('stimmt einer fairen Auszählung zu', () => {
    const state = position(['....x.o..', '....x.o..', '....x.o..', '....x.o..', '....x.o..', '....x.o..', '....x.o..', '....x.o.x', '....x.o..']);
    const s = play(state, [{ type: 'pass' }, { type: 'pass' }]);
    expect(computeBotMove(gameModule, { gameId: 'go', botId: 'go', level: 'easy', seat: 0, view: s, seed: 'z', timeBudgetMs: 100 })).toEqual({ type: 'acceptScore' });
  });

  it('der mittlere Bot schlägt den leichten auf 9 × 9 meistens', () => {
    let wins = 0;
    for (let g = 0; g < 4; g++) {
      let state = start();
      const strong = g % 2;
      for (let step = 0; !gameModule.result(state) && step < 300; step++) {
        const seat = gameModule.currentPlayers(state)[0] as number;
        const move = computeBotMove(gameModule, { gameId: 'go', botId: 'go', level: seat === strong ? 'medium' : 'easy', seat, view: state, seed: `duell/${g}/${step}`, timeBudgetMs: 150 }) as GoMove;
        state = gameModule.applyMove(state, seat, move).state;
      }
      const result = gameModule.result(state);
      if (result?.kind === 'win' && result.winners[0] === strong) wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(3);
  }, 60_000);
});

describe('Vertrag', () => {
  for (const check of gameContractChecks(gameModule, { randomGames: 12, botMoveLimit: 30 })) test(check.name, check.run, 120_000);
});
