import type { GameInfo } from '@brett-und-blatt/engine';

/**
 * Steckbrief des Spiels. Die Plattform liest ihn für das Menü, ohne das ganze
 * Spiel zu laden – deshalb steht er in einer eigenen, kleinen Datei.
 */
export const meta: GameInfo = {
  id: 'tic-tac-toe',
  name: 'Tic-Tac-Toe',
  description: 'Drei in einer Reihe auf einem 3×3-Feld. Der Klassiker für zwischendurch.',
  emoji: '⭕',
  players: { min: 2, max: 2 },
  modes: ['solo', 'hotseat', 'online'],
  patterns: ['open'],
  hiddenInformation: false,
  ruleVersion: 1,
};
