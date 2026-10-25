import type { GameInfo } from '@brett-und-blatt/engine';

export const meta: GameInfo = {
  id: 'four-in-a-row',
  name: 'Vier in einer Reihe',
  description: 'Steine fallen nach unten – wer zuerst vier in einer Reihe hat, gewinnt.',
  emoji: '🔴',
  players: { min: 2, max: 2 },
  modes: ['solo', 'hotseat', 'online'],
  patterns: ['open'],
  hiddenInformation: false,
  ruleVersion: 1,
};
