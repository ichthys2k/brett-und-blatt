import { computeBotMove, isLegalMove, type BotLevel } from '@brett-und-blatt/engine';
import { describe, expect, it } from 'vitest';
import { gameModule, legalMoves, moleBot, reachable, tileAt, type Kind, type MoleMove, type MoleState, type Pos, type Rot, type Tile } from '../src';

const { applyMove, setup, result, playerView } = gameModule as Required<typeof gameModule>;

type Player = { botId: string; level: BotLevel };
const wuehlmaus = (level: BotLevel): Player => ({ botId: 'mole-tunnels', level });
const zufall: Player = { botId: 'random', level: 'easy' };

function choose(state: MoleState, player: Player, seed: string, budget = 1500): MoleMove {
  return computeBotMove(gameModule, { gameId: 'mole-tunnels', botId: player.botId, level: player.level, seat: state.turn, view: playerView(state, state.turn), seed, timeBudgetMs: budget }) as MoleMove;
}

/** Spielt eine Partie; liefert das Ergebnis und die längste Bedenkzeit je Schritt. */
function play(seats: number, players: Player[], seed: string, options: Record<string, string> = {}) {
  let state = setup(seats, options, seed);
  let maxMs = 0;
  for (let step = 0; step < 1_000 && !result(state); step++) {
    const player = players[state.turn % players.length]!;
    const t0 = performance.now();
    const move = choose(state, player, `${seed}/${step}`);
    maxMs = Math.max(maxMs, performance.now() - t0);
    expect(isLegalMove(gameModule, state, state.turn, move), JSON.stringify(move)).toBe(true);
    state = applyMove(state, state.turn, move).state;
  }
  return { state, res: result(state), maxMs };
}

/** Leeres 5 × 5-Brett aus senkrechten Geraden und Hasen in den Ecken. */
function blank(seats = 2): MoleState {
  const size = 5;
  const cells: Tile[] = Array.from({ length: size * size }, (_, id) => ({ id, kind: 'I' as Kind, rot: 0 as Rot, turnip: false, mole: false }));
  const corners: Pos[] = [[0, 0], [4, 4], [0, 4], [4, 0]];
  return {
    size,
    cells,
    spare: { id: 900, kind: 'I', rot: 0, turnip: false, mole: false },
    lastPush: null,
    hares: corners.slice(0, seats),
    harvested: Array(seats).fill(0),
    phase: 'push',
    turn: 0,
    moves: 0,
    options: { goal: 5, turnips: 6, mole: true },
    rng: [1, 2, 3, 4],
  };
}

describe('Wühlmaus', () => {
  it('steht an erster Stelle der Bot-Liste (Standard-Bot) und kennt drei Stufen', () => {
    expect(gameModule.bots[0]).toBe(moleBot);
    expect(moleBot.name).toBe('Wühlmaus');
    expect(moleBot.levels).toEqual(['easy', 'medium', 'hard']);
    expect(gameModule.bots.some((b) => b.id === 'random')).toBe(true);
  });

  it.each(['easy', 'medium', 'hard'] as const)('Stufe %s spielt ganze Partien mit lauter erlaubten Zügen', (level) => {
    for (const [seats, options] of [[2, {}], [3, { size: '5' }], [4, { mole: 'off', goal: '3' }]] as const) {
      const { res } = play(seats, [wuehlmaus(level)], `bot/${level}/${seats}`, options);
      expect(res, `${level} ${seats} Plätze`).not.toBeNull();
    }
  });

  it('erntet im Laufschritt, wenn eine Rübe erreichbar ist (mittel und schwer)', () => {
    // Spalte 0 ist durchgehend offen: die Rübe in Zeile 3 liegt in Reichweite des Hasen oben links.
    let state = blank();
    state = { ...state, phase: 'walk', cells: state.cells.map((t, i) => (i === 3 * 5 ? { ...t, turnip: true } : t)) };
    for (const level of ['medium', 'hard'] as const) {
      expect(choose(state, wuehlmaus(level), `ernte/${level}`)).toEqual({ type: 'walk', to: [3, 0] });
    }
  });

  it('schiebt so, dass danach geerntet werden kann, wenn es einen solchen Schub gibt', () => {
    let checked = 0;
    for (let g = 0; g < 40; g++) {
      const state = setup(2 + (g % 3), { size: g % 2 ? '5' : '7' }, `schub/${g}`);
      const pushes = legalMoves(state, state.turn);
      const harvests = (s: MoleState, move: MoleMove) => {
        const after = applyMove(s, s.turn, move).state;
        return reachable(after, after.hares[s.turn]!).some(([r, c]) => tileAt(after, r, c).turnip);
      };
      if (!pushes.some((m) => harvests(state, m))) continue;
      checked++;
      for (const level of ['medium', 'hard'] as const) {
        const move = choose(state, wuehlmaus(level), `schub/${g}/${level}`);
        expect(harvests(state, move), `Seed ${g}, ${level}`).toBe(true);
      }
    }
    expect(checked).toBeGreaterThan(5);
  });

  it('wählt den siegbringenden Zug, wenn er möglich ist', () => {
    // Letzte fehlende Rübe in Reichweite: alle Stufen außer leicht nehmen sie sicher.
    let state = blank();
    state = { ...state, phase: 'walk', harvested: [4, 0], cells: state.cells.map((t, i) => (i === 4 * 5 ? { ...t, turnip: true } : t)) };
    // Hase 0 steht oben links; Spalte 0 ist offen, Rübe unten links.
    for (const level of ['medium', 'hard'] as const) {
      const move = choose(state, wuehlmaus(level), `sieg/${level}`);
      const after = applyMove(state, 0, move).state;
      expect(result(after)).toEqual({ kind: 'win', winners: [0] });
    }
  });

  it('hat keinen verdeckten Zufallszustand nötig: gleiche Sicht ergibt gleichen Zug', () => {
    const state = setup(3, {}, 'sicht');
    const a = choose(state, wuehlmaus('hard'), 'x');
    const b = choose({ ...state, rng: [9, 9, 9, 9] }, wuehlmaus('hard'), 'x');
    expect(a).toEqual(b);
  });

  it('rechnet in vertretbarer Zeit (7 × 7, 4 Plätze, schwer)', () => {
    const { maxMs } = play(4, [wuehlmaus('hard')], 'zeit/4', {});
    // Großzügige Schranke gegen Ausreißer auf langsamen CI-Rechnern; das Tipp-Budget ist 1,5 s.
    expect(maxMs).toBeLessThan(1_500);
  });

  it('schwer schlägt Zufall in den allermeisten Partien (2 Plätze)', { timeout: 120_000 }, () => {
    let wins = 0;
    const games = 24;
    for (let g = 0; g < games; g++) {
      const strong = g % 2;
      const players = strong === 0 ? [wuehlmaus('hard'), zufall] : [zufall, wuehlmaus('hard')];
      const { res } = play(2, players, `staerke/${g}`);
      if (res?.kind === 'win' && res.winners.includes(strong)) wins++;
    }
    expect(wins / games).toBeGreaterThanOrEqual(0.95);
  });

  it('mittel schlägt leicht deutlich (2 Plätze)', { timeout: 120_000 }, () => {
    let wins = 0;
    const games = 24;
    for (let g = 0; g < games; g++) {
      const strong = g % 2;
      const players = strong === 0 ? [wuehlmaus('medium'), wuehlmaus('easy')] : [wuehlmaus('easy'), wuehlmaus('medium')];
      const { res } = play(2, players, `mittel/${g}`);
      if (res?.kind === 'win' && res.winners.includes(strong)) wins++;
    }
    expect(wins / games).toBeGreaterThanOrEqual(0.75);
  });
});
