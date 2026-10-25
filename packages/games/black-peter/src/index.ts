import { generalBots, type BotDefinition, type BotLevel, type GameModule } from '@brett-und-blatt/engine';
import { PETER } from './content';
import { meta } from './meta';
import { applyMove, currentPlayers, legalMoves, playerView, result, sampleHidden, setup, type BlackPeterMove, type BlackPeterState } from './rules';

export type { BlackPeterMove, BlackPeterState, Card } from './rules';
export { sourceOf } from './rules';
export { faceOf, PAIR_SETS, PETER } from './content';

/** Wie oft der Bot vor dem Ziehen seine Hand mischt – mit dem Peter auf der Hand öfter. */
const SHUFFLE_CHANCE: Record<BotLevel, { normal: number; peter: number }> = {
  easy: { normal: 0.1, peter: 0.2 },
  medium: { normal: 0.25, peter: 0.6 },
  hard: { normal: 0.4, peter: 0.9 },
};

/** Schwarzer Peter ist ein Glücksspiel: Der Bot zieht zufällig und mischt geschickt. */
const blackPeterBot: BotDefinition<BlackPeterState, BlackPeterMove> = {
  id: 'black-peter',
  name: 'Kartenmischer',
  levels: ['easy', 'medium', 'hard'],
  chooseMove(ctx) {
    const moves = legalMoves(ctx.view, ctx.seat);
    const hasPeter = (ctx.view.hands[ctx.seat] ?? []).some((card) => card?.pair === PETER);
    const chance = SHUFFLE_CHANCE[ctx.level];
    const shuffle = moves.find((m) => m.type === 'shuffle');
    if (shuffle && ctx.rng.chance(hasPeter ? chance.peter : chance.normal)) return shuffle;
    return ctx.rng.pick(moves.filter((m) => m.type === 'draw'));
  },
};

export const gameModule: GameModule<BlackPeterState, BlackPeterMove> = {
  info: meta,
  options: [
    {
      id: 'set',
      label: 'Kartenset',
      choices: [
        { value: 'tiere', label: 'Tiere' },
        { value: 'einmaleins', label: 'Einmaleins' },
        { value: 'englisch', label: 'Englisch' },
      ],
      default: 'tiere',
    },
    {
      id: 'pairs',
      label: 'Anzahl Paare',
      choices: ['8', '12', '16'].map((value) => ({ value, label: value })),
      default: '12',
    },
  ],
  timePresets: {
    relaxed: { kind: 'none' },
    normal: { kind: 'perMove', moveMs: 10_000 },
    fast: { kind: 'perMove', moveMs: 5_000 },
  },
  setup,
  currentPlayers,
  legalMoves,
  applyMove,
  playerView,
  result,
  sampleHidden,
  bots: [blackPeterBot, ...generalBots<BlackPeterState, BlackPeterMove, BlackPeterState>()],
};
