import { randomBot, stateFor, type BotDefinition, type GameModule } from '@brett-und-blatt/engine';
import { chooseBotMove } from './legacy/bot';
import { promotionChoice } from './legacy/engine';
import { meta } from './meta';
import { applyMove, COLORS, currentPlayers, legalMoves, resignMove, result, setup, type FourChessMove, type FourChessState } from './rules';

export type { Color, FourChessMove, FourChessState, Piece } from './rules';
export { COLORS, seatOf } from './rules';

/**
 * Der Computergegner aus 4playerchess: bewertet jeden Zug mit Faustregeln
 * (Material, bedrohte Figuren, Schach und Matt, Entwicklung).
 * - leicht: oft ein zufälliger Zug
 * - mittel: Faustregeln mit etwas Zufall
 * - schwer: Faustregeln mit wenig Zufall
 */
const fourChessBot: BotDefinition<FourChessState, FourChessMove> = {
  id: 'four-player-chess',
  name: 'Faustregeln',
  levels: ['easy', 'medium', 'hard'],
  chooseMove(ctx) {
    const state = stateFor(ctx);
    const moves = legalMoves(state, ctx.seat);
    const claim = moves.find((m) => m.t === 'claim');
    if (claim) return claim;
    const moveMoves = moves.filter((m): m is Extract<FourChessMove, { t: 'm' }> => m.t === 'm');
    if (ctx.level === 'easy' && ctx.rng.chance(0.4) && moveMoves.length > 0) return ctx.rng.pick(moveMoves);
    // Der Bot rechnet mit Zufall im Bereich 0–1 und gewichtet ihn selbst; „schwer“ dämpft ihn.
    const noise = ctx.level === 'hard' ? 0.3 : 1;
    const action = chooseBotMove(state, COLORS[ctx.seat], () => ctx.rng.next() * noise);
    if (!action || action.t !== 'm') return ctx.rng.pick(moves);
    // Ohne freie Wahl wird automatisch zur Dame umgewandelt – ohne Angabe.
    const normalized: FourChessMove = promotionChoice(state) ? action : { t: 'm', p: action.p, f: action.f, to: action.to };
    return normalized;
  },
};

export const gameModule: GameModule<FourChessState, FourChessMove> = {
  info: meta,
  options: [
    {
      id: 'mode',
      label: 'Spielart',
      description: 'Jeder gegen jeden mit Punkten – oder Rot und Gelb gegen Blau und Grün.',
      choices: [
        { value: 'ffa', label: 'Jeder gegen jeden' },
        { value: 'teams', label: 'Teams' },
      ],
      default: 'ffa',
    },
    {
      id: 'promotion',
      label: 'Umwandlung',
      description: 'Wird ein Bauer umgewandelt, darf man Dame, Turm, Läufer oder Springer wählen – oder es wird immer eine Dame.',
      choices: [
        { value: 'any', label: 'Freie Wahl' },
        { value: 'queen', label: 'Immer Dame' },
      ],
      default: 'any',
    },
  ],
  timePresets: {
    relaxed: { kind: 'none' },
    normal: { kind: 'perMove', moveMs: 30_000, bankMs: 60_000 },
    fast: { kind: 'chessClock', baseMs: 300_000, incrementMs: 3_000 },
  },
  setup,
  currentPlayers,
  legalMoves,
  applyMove,
  playerView: (state) => state,
  result,
  resignMove,
  // Die allgemeine Monte-Carlo-Suche wäre bei vier Spielern auf 160 Feldern zu langsam.
  bots: [fourChessBot, randomBot as unknown as BotDefinition<FourChessState, FourChessMove>],
};
