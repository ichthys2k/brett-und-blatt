import { generalBots, type GameModule, type OptionSpec } from '@brett-und-blatt/engine';
import { kraemerBot } from './bots';
import { meta } from './meta';
import { applyMove, currentPlayers, eventView, isLegal, legalMoves, playerView, result, sampleHidden, setup, timeoutMove, worth, type MarketMove, type MarketState, type MarketView } from './rules';

export * from './rules';
export { kraemerBot } from './bots';
export { meta } from './meta';

const options: OptionSpec[] = [
  {
    id: 'years',
    label: 'Spieldauer',
    description: 'Ein Jahr hat vier Jahreszeiten mit je zwei Runden.',
    choices: [
      { value: 'auto', label: 'Passend (3 Jahre, ab 5 Spielern 2)' },
      { value: '2', label: '2 Jahre' },
      { value: '3', label: '3 Jahre' },
      { value: '4', label: '4 Jahre' },
    ],
    default: 'auto',
  },
  {
    id: 'start',
    label: 'Startkapital',
    description: 'Spätere Plätze bekommen je 1 Brezel mehr als Ausgleich.',
    choices: [
      { value: '30', label: '30 Brezeln' },
      { value: '40', label: '40 Brezeln' },
      { value: '50', label: '50 Brezeln' },
    ],
    default: '40',
  },
  {
    id: 'news',
    label: 'Hofnachrichten',
    description: 'Je Jahreszeit gilt eine verdeckt gezogene Nachricht für alle.',
    choices: [
      { value: 'on', label: 'An' },
      { value: 'off', label: 'Aus' },
    ],
    default: 'on',
  },
  {
    id: 'partnership',
    label: 'Zunftpartnerschaft',
    choices: [
      { value: 'on', label: 'An' },
      { value: 'off', label: 'Aus' },
    ],
    default: 'on',
  },
  {
    id: 'trade',
    label: 'Handel',
    description: 'Ohne Handel ist das Spiel für jüngere Kinder einfacher.',
    choices: [
      { value: 'on', label: 'An' },
      { value: 'off', label: 'Aus' },
    ],
    default: 'on',
  },
  {
    id: 'auction',
    label: 'Versteigerung',
    choices: [
      { value: 'open', label: 'Reihum in Schritten von 1 Brezel' },
      { value: 'sealed', label: 'Verdecktes Einmalgebot' },
    ],
    default: 'open',
  },
];

export const gameModule: GameModule<MarketState, MarketMove, MarketView> = {
  info: meta,
  options,
  timePresets: {
    relaxed: { kind: 'none' },
    normal: { kind: 'perMove', moveMs: 30_000 },
    fast: { kind: 'perMove', moveMs: 15_000 },
  },
  setup,
  currentPlayers,
  legalMoves,
  isLegal,
  applyMove,
  playerView,
  result,
  sampleHidden,
  timeoutMove,
  eventView,
  resignMove: (state, seat) => (state.phase === 'finished' || state.players[seat]!.gone ? null : { type: 'resign', seat }),
  evaluate: (state, seat) => {
    const others = state.players.flatMap((_, i) => (i === seat ? [] : [worth(state, i)]));
    return worth(state, seat) - Math.max(...others);
  },
  bots: [kraemerBot, ...generalBots<MarketState, MarketMove, MarketView>()],
};
