import { randomBot, type BotDefinition, type GameModule, type TimePresets } from '@brett-und-blatt/engine';
import { goBot } from './bots';
import { meta } from './meta';
import { applyMove, currentPlayers, isLegal, legalMoves, resignMove, result, setup, type GoMove, type GoState } from './rules';

export type { GoEnd, GoMove, GoState, GoVariant } from './rules';
export { handicapPoints, loadFromSgf, parseSgf, scoreOf, toSgf, tryPlace } from './rules';
export { estimateOwnership, groupAt, geometry } from './board';

const NINE: TimePresets = {
  relaxed: { kind: 'none' },
  normal: { kind: 'byoyomi', mainMs: 5 * 60_000, periods: 3, periodMs: 20_000 },
  fast: { kind: 'byoyomi', mainMs: 2 * 60_000, periods: 3, periodMs: 10_000 },
};

export const gameModule: GameModule<GoState, GoMove> = {
  info: meta,
  options: [
    {
      id: 'size',
      label: 'Brettgröße',
      choices: [
        { value: '9', label: '9 × 9' },
        { value: '13', label: '13 × 13' },
        { value: '19', label: '19 × 19' },
      ],
      default: '9',
    },
    {
      id: 'variant',
      label: 'Variante',
      description: 'Atari-Go: Wer zuerst einen Stein schlägt, gewinnt – der Einstieg für Kinder und die Schule.',
      choices: [
        { value: 'go', label: 'Go' },
        { value: 'atari', label: 'Atari-Go' },
      ],
      default: 'go',
    },
    {
      id: 'komi',
      label: 'Komi',
      description: 'Ausgleichspunkte für Weiß, weil Schwarz beginnt. Mit Vorgabe gilt immer 0,5.',
      choices: [
        { value: '0.5', label: '0,5' },
        { value: '5.5', label: '5,5' },
        { value: '6.5', label: '6,5' },
        { value: '7.5', label: '7,5' },
      ],
      default: '7.5',
      when: { variant: ['go'] },
    },
    {
      id: 'handicap',
      label: 'Vorgabe',
      description: 'Schwarz bekommt Steine auf die Sternpunkte, danach beginnt Weiß.',
      choices: [
        { value: '0', label: 'keine' },
        ...[2, 3, 4, 5, 6, 7, 8, 9].map((n) => ({ value: String(n), label: `${n} Steine` })),
      ],
      default: '0',
      when: { variant: ['go'] },
    },
    {
      id: 'territory',
      label: 'Gebietsanzeige',
      description: 'Zeigt während der Partie, wem welcher Punkt voraussichtlich gehört – eine Lernhilfe.',
      choices: [
        { value: 'off', label: 'aus' },
        { value: 'on', label: 'einblenden' },
      ],
      default: 'off',
      when: { variant: ['go'] },
    },
    {
      id: 'correspondence',
      label: 'Fernpartie',
      description: 'Züge über Tage statt Minuten – ideal für asynchrone Partien.',
      choices: [
        { value: 'no', label: 'Nein' },
        { value: 'yes', label: 'Ja (1–2 Tage pro Zug)' },
      ],
      default: 'no',
      when: { variant: ['go'] },
    },
    {
      id: 'sgf',
      label: 'SGF-Partie',
      hidden: true,
      pattern: '.*',
      choices: [{ value: '', label: 'keine' }],
      default: '',
    },
  ],
  timePresets: NINE,
  // Größere Bretter brauchen mehr Zeit (Byo-yomi: Hauptzeit, danach Perioden mit fester Zugzeit).
  timePresetsFor(options) {
    if (options.correspondence === 'yes') {
      return {
        relaxed: { kind: 'perMove', moveMs: 2 * 86_400_000 },
        normal: { kind: 'perMove', moveMs: 86_400_000 },
        fast: { kind: 'perMove', moveMs: 12 * 3_600_000 },
      };
    }
    if (options.size === '19') {
      return {
        relaxed: { kind: 'none' },
        normal: { kind: 'byoyomi', mainMs: 20 * 60_000, periods: 5, periodMs: 30_000 },
        fast: { kind: 'byoyomi', mainMs: 10 * 60_000, periods: 3, periodMs: 20_000 },
      };
    }
    if (options.size === '13') {
      return {
        relaxed: { kind: 'none' },
        normal: { kind: 'byoyomi', mainMs: 10 * 60_000, periods: 5, periodMs: 30_000 },
        fast: { kind: 'byoyomi', mainMs: 5 * 60_000, periods: 3, periodMs: 15_000 },
      };
    }
    return NINE;
  },
  setup,
  currentPlayers,
  legalMoves,
  isLegal,
  applyMove,
  playerView: (state) => state,
  result,
  resignMove,
  bots: [goBot, randomBot as unknown as BotDefinition<GoState, GoMove>],
};
