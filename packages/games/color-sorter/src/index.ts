import type { GameModule } from '@brett-und-blatt/engine';
import { sorterBot } from './bots';
import { DECKS, STAKES } from './content';
import { meta } from './meta';
import { applyMove, currentPlayers, eventView, isLegal, legalMoves, playerView, result, setup } from './rules';
import type { SorterMove, SorterState } from './types';

export type * from './types';
export * from './cards';
export * from './content';
export { MODS, MOD_KEYS, modDef, RARITY_INFO, SOLO_TABLE, type TableInfo } from './mods';
export { FINAL_LEVEL, HIDDEN_SCORE, MAX_SELECT, bossFor, canRerollBoss, effectiveHandSize, freeModSlots, isDuelLevel, modCapacity, rerollCost, sellValue, tableInfo } from './rules';
export * from './unlocks';
export * from './drops';
export { previewHand, scoreHand, isDebuffed, type ScoreStep } from './scoring';
export { bestPlay } from './bots';

export const gameModule: GameModule<SorterState, SorterMove> = {
  info: meta,
  options: [
    {
      id: 'mode',
      label: 'Spielart (ab 2 Spielern)',
      description:
        'Duell: ab Level 2 ersetzt ein Duell den Boss, wer weniger Punkte holt, verliert ein Leben. Showdown: Duelle erst ab Level 4. Überleben: Wer am weitesten kommt, gewinnt. Wettrennen: Wer zuerst Level 8 schafft. Allein spielst du immer einen normalen Lauf.',
      choices: [
        { value: 'duel', label: 'Duell' },
        { value: 'showdown', label: 'Showdown' },
        { value: 'survival', label: 'Überleben' },
        { value: 'race', label: 'Wettrennen' },
      ],
      default: 'duel',
    },
    {
      id: 'lives',
      label: 'Leben',
      choices: ['2', '3', '4', '5'].map((value) => ({ value, label: value })),
      default: '4',
      when: { mode: ['duel', 'showdown'] },
    },
    {
      id: 'deck',
      label: 'Kartensatz',
      description: DECKS.map((d) => `${d.name}: ${d.text}`).join('. ') + '.',
      choices: DECKS.map((d) => ({
        value: d.key,
        label: `${d.emoji} ${d.name.replace('-Satz', '')}`,
      })),
      default: 'standard',
    },
    {
      id: 'stake',
      label: 'Sortierstufe',
      description:
        'Jede Stufe enthält die Erschwernisse aller vorigen. ' +
        STAKES.slice(1)
          .map((s) => `${s.name}: ${s.text}`)
          .join('. ') +
        '.',
      choices: STAKES.map((s, i) => ({
        value: String(i + 1),
        label: `${s.emoji} ${s.name}`,
      })),
      default: '1',
    },
    {
      id: 'endless',
      label: 'Nach Level 8',
      description: 'Endlos: Nach dem Boss von Level 8 geht es weiter, bis eine Runde verloren ist (allein und bei Überleben).',
      choices: [
        { value: 'off', label: 'Ende' },
        { value: 'on', label: 'Endlos' },
      ],
      default: 'off',
    },
    {
      id: 'pool',
      label: 'Freischaltungen',
      description:
        'Welche Mods, Werkzeuge und Kartensätze vorkommen. Meine: was du im Atelier freigeschaltet hast (online gilt dafür die Grundausstattung). Grundausstattung: für alle gleich. Alles: auch noch Gesperrtes.',
      choices: [
        { value: 'mine', label: 'Meine' },
        { value: 'base', label: 'Grundausstattung' },
        { value: 'all', label: 'Alles' },
      ],
      default: 'mine',
    },
    // Füllt die Oberfläche mit den Freischaltungen dieses Geräts (unlocks.ts).
    {
      id: 'unlocks',
      label: 'Freischaltungen (Code)',
      choices: [{ value: '', label: 'keine' }],
      default: '',
      hidden: true,
      pattern: '[0-9a-f]{0,32}',
    },
  ],
  timePresets: {
    relaxed: { kind: 'none' },
    normal: { kind: 'perMove', moveMs: 60_000, bankMs: 300_000 },
    fast: { kind: 'perMove', moveMs: 30_000, bankMs: 120_000 },
  },
  setup,
  currentPlayers,
  legalMoves,
  isLegal,
  applyMove,
  playerView,
  eventView,
  result,
  bots: [sorterBot],
};
