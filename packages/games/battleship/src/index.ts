import type { GameModule } from '@brett-und-blatt/engine';
import { battleshipBot } from './bots';
import { meta } from './meta';
import { applyMove, currentPlayers, isLegal, legalMoves, playerView, result, sampleHidden, setup, type BattleshipMove, type BattleshipState } from './rules';

export type { BattleshipMove, BattleshipState, CoordMode, FleetKind, Ship, Shot, ShotResult } from './rules';
export { CELLS, FLEETS, SIZE, colLabels, colOf, fleetProblem, formatCoord, knownWater, openCells, opponentOf, randomFleet, rowLabels, rowOf, salvoSize, shipCells } from './rules';
export { probabilityMap } from './bots';

export const gameModule: GameModule<BattleshipState, BattleshipMove> = {
  info: meta,
  options: [
    {
      id: 'fleet',
      label: 'Flotte',
      choices: [
        { value: 'classic', label: 'Papierversion (10 Schiffe, kein Berühren)' },
        { value: 'small', label: 'Kleine Flotte (5 Schiffe, Berühren erlaubt)' },
      ],
      default: 'classic',
    },
    {
      id: 'coords',
      label: 'Koordinaten',
      description: 'Im Koordinatensystem werden Schüsse als Punkte P(x | y) angegeben.',
      choices: [
        { value: 'classic', label: 'Klassisch (A–J, 1–10)' },
        { value: 'quadrant1', label: '1. Quadrant (x: 1–10, y: 1–10)' },
        { value: 'quadrants4', label: '4 Quadranten (−5 bis +5)' },
      ],
      default: 'classic',
    },
    {
      id: 'again',
      label: 'Nach Treffer weiter',
      choices: [
        { value: 'on', label: 'an' },
        { value: 'off', label: 'aus' },
      ],
      default: 'on',
    },
    {
      id: 'salvo',
      label: 'Salvenmodus',
      description: 'So viele Schüsse pro Runde, wie eigene Schiffe übrig sind.',
      choices: [
        { value: 'off', label: 'aus' },
        { value: 'on', label: 'an' },
      ],
      default: 'off',
    },
    {
      id: 'autoWater',
      label: 'Wasser um versenkte Schiffe markieren',
      choices: [
        { value: 'on', label: 'an' },
        { value: 'off', label: 'aus' },
      ],
      default: 'on',
      when: { fleet: ['classic'] },
    },
  ],
  timePresets: {
    relaxed: { kind: 'none' },
    normal: { kind: 'perMove', moveMs: 10_000, firstMoveMs: 90_000 },
    fast: { kind: 'perMove', moveMs: 5_000, firstMoveMs: 45_000 },
  },
  setup,
  currentPlayers,
  legalMoves,
  isLegal,
  applyMove,
  playerView,
  result,
  sampleHidden,
  bots: [battleshipBot],
};
