import type { GameModule } from '@brett-und-blatt/engine';
import { bingoBot } from './bots';
import { PACKS } from './content';
import { meta } from './meta';
import { applyMove, currentPlayers, legalMoves, playerView, result, setup, type BingoMove, type BingoState } from './rules';

export type { BingoCall, BingoMove, BingoState, FalseCall, Goal } from './rules';
export { CALLER, canCall, drawnIds, hasCard, isPlaying, linesOf, missing, unmarkedCells } from './rules';
export { LETTERS, NUMBERS, NUMBER_COUNT, PACKS, callOf, columnOf, entryIds, faceOf } from './content';

const packIds = Object.keys(PACKS);

export const gameModule: GameModule<BingoState, BingoMove> = {
  info: meta,
  options: [
    {
      id: 'content',
      label: 'Inhalt',
      description: 'Im Lern-Bingo wird eine Aufgabe angesagt, auf der Karte steht die Lösung.',
      choices: [{ value: 'zahlen', label: 'Zahlen 1–75' }, ...packIds.map((id) => ({ value: id, label: PACKS[id]!.name }))],
      default: 'zahlen',
    },
    {
      id: 'size',
      label: 'Kartengröße',
      choices: [
        { value: '3', label: '3 × 3' },
        { value: '4', label: '4 × 4' },
        { value: '5', label: '5 × 5' },
      ],
      default: '4',
      when: { content: packIds },
    },
    {
      id: 'goal',
      label: 'Ziel',
      choices: [
        { value: 'line', label: 'eine Reihe' },
        { value: 'twoLines', label: 'zwei Reihen' },
        { value: 'corners', label: 'vier Ecken' },
        { value: 'full', label: 'volle Karte' },
      ],
      default: 'line',
    },
    {
      id: 'marking',
      label: 'Markieren',
      description: '„Automatisch“ ist für kleine Kinder: Die Karte markiert sich selbst, man muss nur noch „Bingo!“ rufen.',
      choices: [
        { value: 'self', label: 'selbst' },
        { value: 'auto', label: 'automatisch' },
      ],
      default: 'self',
    },
    {
      id: 'falseCall',
      label: 'Falsches Bingo',
      choices: [
        { value: 'pause', label: 'eine Ziehung aussetzen' },
        { value: 'out', label: 'scheidet aus' },
        { value: 'none', label: 'ohne Folgen' },
      ],
      default: 'pause',
    },
    {
      id: 'caller',
      label: 'Spielleitung (Platz 1)',
      choices: [
        { value: 'plays', label: 'zieht und spielt mit' },
        { value: 'leads', label: 'zieht nur' },
      ],
      default: 'plays',
    },
  ],
  // Kein Takt und keine Zug-Uhr: Die Spielleitung zieht per Knopf, wer nicht markiert, verpasst nur etwas.
  timePresets: {
    relaxed: { kind: 'none' },
    normal: { kind: 'none' },
    fast: { kind: 'none' },
  },
  setup,
  currentPlayers,
  legalMoves,
  applyMove,
  playerView,
  result,
  bots: [bingoBot],
};
