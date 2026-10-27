import type { GameInfo } from '@brett-und-blatt/engine';

export const meta: GameInfo = {
  id: 'gomoku',
  name: 'Gomoku',
  description: 'Fünf in einer Reihe auf dem 15×15-Brett. Wer zuerst fünf Steine verbindet, gewinnt.',
  emoji: '⚫',
  players: { min: 2, max: 2 },
  modes: ['solo', 'hotseat', 'online'],
  patterns: ['open'],
  hiddenInformation: false,
  ruleVersion: 1,
  howToPlay: [
    'Ihr setzt abwechselnd einen schwarzen oder weißen Stein auf ein freies Feld.',
    'Schwarz beginnt.',
    'Wer zuerst fünf Steine in einer Reihe hat – waagerecht, senkrecht oder diagonal –, gewinnt.',
    'Ist das Brett voll, ohne dass jemand fünf in einer Reihe hat, endet die Partie unentschieden.',
  ],
};
