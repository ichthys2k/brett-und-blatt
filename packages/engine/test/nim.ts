import { generalBots, type GameModule } from '../src';

/**
 * Kleines Testspiel (Nim): Von einem Haufen nimmt man abwechselnd 1 bis 3 Hölzer.
 * Wer das letzte nimmt, gewinnt. Perfekt spielt, wer ein Vielfaches von 4 übrig lässt.
 */
export interface NimState {
  left: number;
  turn: number;
  lastTaker: number | null;
}

export interface NimMove {
  take: number;
}

export const nim: GameModule<NimState, NimMove> = {
  info: {
    id: 'nim',
    name: 'Nim',
    description: 'Testspiel',
    emoji: '🪵',
    players: { min: 2, max: 2 },
    modes: ['solo', 'hotseat'],
    patterns: ['open'],
    hiddenInformation: false,
    ruleVersion: 1,
    howToPlay: ['Nimm 1 bis 3 Hölzer. Wer das letzte nimmt, gewinnt.'],
  },
  options: [{ id: 'heap', label: 'Haufen', choices: [{ value: '10', label: '10' }, { value: '21', label: '21' }], default: '10' }],
  timePresets: { relaxed: { kind: 'none' }, normal: { kind: 'perMove', moveMs: 10_000 }, fast: { kind: 'perMove', moveMs: 5_000 } },
  setup: (_seats, options) => ({ left: Number(options.heap ?? 10), turn: 0, lastTaker: null }),
  currentPlayers: (s) => (s.left === 0 ? [] : [s.turn]),
  legalMoves: (s, actor) => (actor !== s.turn || s.left === 0 ? [] : [1, 2, 3].filter((n) => n <= s.left).map((take) => ({ take }))),
  applyMove(s, actor, move) {
    if (actor !== s.turn || move.take < 1 || move.take > 3 || move.take > s.left) throw new Error('Unerlaubter Zug');
    return { state: { left: s.left - move.take, turn: 1 - s.turn, lastTaker: s.turn }, events: [{ type: 'took', take: move.take }] };
  },
  playerView: (s) => s,
  result: (s) => (s.left === 0 && s.lastTaker !== null ? { kind: 'win', winners: [s.lastTaker] } : null),
  evaluate: () => 0,
  bots: generalBots(),
};
