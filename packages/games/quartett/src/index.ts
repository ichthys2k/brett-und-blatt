import { generalBots, type GameModule } from '@brett-und-blatt/engine';
import { quartettBot } from './bots';
import { meta } from './meta';
import { applyMove, currentPlayers, legalMoves, playerView, result, sampleHidden, setup, type QuartettMove, type QuartettState } from './rules';
import { CARD_SETS, SET_IDS } from './sets';

export type { Ask, Play, QuartettMode, QuartettMove, QuartettState, StackCard, Trick } from './rules';
export { askTargets, askableCards, cardsInPlay, collectKnowledge, setOf } from './rules';
export type { CardId, CardProperty, CardSet, QuartettCard } from './sets';
export { CARD_SETS, SET_IDS, cardOf, cardSet, compareValues, formatValue, formatWithUnit, groupOf, valueOf } from './sets';

export const gameModule: GameModule<QuartettState, QuartettMove> = {
  info: meta,
  options: [
    {
      id: 'mode',
      label: 'Spielweise',
      choices: [
        { value: 'trump', label: 'Trumpf (Werte vergleichen)' },
        { value: 'collect', label: 'Sammeln (nach Karten fragen)' },
      ],
      default: 'trump',
    },
    {
      id: 'set',
      label: 'Kartenset',
      choices: SET_IDS.map((id) => ({ value: id, label: `${CARD_SETS[id]!.emoji} ${CARD_SETS[id]!.name}` })),
      default: 'tiere',
    },
    {
      id: 'rounds',
      label: 'Rundenlimit',
      description: 'Danach gewinnt, wer die meisten Karten hat.',
      choices: [
        { value: '15', label: '15 Runden' },
        { value: '30', label: '30 Runden' },
        { value: '50', label: '50 Runden' },
        { value: '0', label: 'unbegrenzt' },
      ],
      default: '30',
      when: { mode: ['trump'] },
    },
    {
      id: 'reveal',
      label: 'Aufgedeckte Karten zeigen',
      choices: [
        { value: '1', label: '1 Sekunde' },
        { value: '2', label: '2 Sekunden' },
        { value: '3', label: '3 Sekunden' },
      ],
      default: '2',
      when: { mode: ['trump'] },
    },
  ],
  timePresets: {
    relaxed: { kind: 'none' },
    normal: { kind: 'perMove', moveMs: 20_000 },
    fast: { kind: 'perMove', moveMs: 10_000 },
  },
  setup,
  currentPlayers,
  legalMoves,
  applyMove,
  playerView,
  result,
  sampleHidden,
  bots: [quartettBot, ...generalBots<QuartettState, QuartettMove, QuartettState>()],
};
