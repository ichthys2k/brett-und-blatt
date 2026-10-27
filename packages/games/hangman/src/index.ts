import type { GameModule } from '@brett-und-blatt/engine';
import { findMatchingWords, hangmanBot } from './bots';
import { meta } from './meta';
import {
  applyMove,
  currentPlayers,
  legalMoves,
  playerView,
   result,
  revealedStats,
  setup,
  type HangmanMode,
  type HangmanMove,
  type HangmanState,
  type HangmanTheme,
  type WordBoardState,
  type WordSummary,
} from './rules';
import {
  ALPHABET,
  GERMAN_LETTER_FREQUENCY,
  WORD_LISTS,
  isGuessableChar,
  isWordSolved,
  maskWord,
  normalizeWord,
  type HangmanCategory,
} from './words';

export {
  ALPHABET,
  GERMAN_LETTER_FREQUENCY,
  WORD_LISTS,
  applyMove,
  currentPlayers,
  findMatchingWords,
  hangmanBot,
  isGuessableChar,
  isWordSolved,
  legalMoves,
  maskWord,
  normalizeWord,
  playerView,
  result,
  revealedStats,
  setup,
  type HangmanCategory,
  type HangmanMode,
  type HangmanMove,
  type HangmanState,
  type HangmanTheme,
  type WordBoardState,
  type WordSummary,
};

export const gameModule: GameModule<HangmanState, HangmanMove> = {
  info: meta,
  options: [
    {
      id: 'category',
      label: 'Themenpaket',
      choices: [
        { value: 'alltag', label: '🎒 Alltag, Schule & Freizeit' },
        { value: 'tiere', label: '🐾 Tiere & Natur' },
        { value: 'knifflig', label: '🧠 Knifflige Wörter (Original)' },
        { value: 'mathe', label: '📐 Mathe & Geometrie (Kl. 5/6)' },
      ],
      default: 'alltag',
    },
    {
      id: 'mode',
      label: 'Spielweise',
      description: 'Reihum am selben Wort raten oder im gleichzeitigen Wettrennen gegeneinander antreten.',
      choices: [
        { value: 'coop', label: '🤝 Reihum am selben Wort' },
        { value: 'race', label: '🏁 Wettrennen (jeder für sich)' },
      ],
      default: 'coop',
    },
    {
      id: 'theme',
      label: 'Motiv',
      choices: [
        { value: 'snowman', label: '⛄ Schmelzender Schneemann' },
        { value: 'flower', label: '🌼 Blumenblätter' },
        { value: 'gallows', label: '🪵 Klassischer Galgen' },
      ],
      default: 'snowman',
    },
    {
      id: 'maxMistakes',
      label: 'Erlaubte Fehlversuche',
      choices: [
        { value: '10', label: 'Leicht (10 Fehlversuche)' },
        { value: '8', label: 'Normal (8 Fehlversuche)' },
        { value: '6', label: 'Schwer (6 Fehlversuche)' },
      ],
      default: '8',
    },
    {
      id: 'rounds',
      label: 'Anzahl Wörter',
      choices: [
        { value: '3', label: '3 Wörter' },
        { value: '4', label: '4 Wörter' },
        { value: '5', label: '5 Wörter' },
      ],
      default: '3',
    },
  ],
  timePresets: {
    relaxed: { kind: 'none' },
    normal: { kind: 'perMove', moveMs: 30_000, bankMs: 45_000 },
    fast: { kind: 'perMove', moveMs: 15_000, bankMs: 20_000 },
  },
  timePresetsFor(options) {
    if (options.mode === 'race') {
      return {
        relaxed: { kind: 'none' },
        normal: { kind: 'none' },
        fast: { kind: 'none' },
      };
    }
    return this.timePresets;
  },
  setup,
  currentPlayers,
  legalMoves,
  applyMove,
  playerView,
  result,
  bots: [hangmanBot],
};
