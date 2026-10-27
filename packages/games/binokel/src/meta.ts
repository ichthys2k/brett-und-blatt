import type { GameInfo } from '@brett-und-blatt/engine';

export const meta: GameInfo = {
  id: 'binokel',
  name: 'Binokel',
  description: 'Schwäbisches Binokel für 3 Spieler mit Reizen, Dabb, Melden und strengen Stichpflichten.',
  emoji: '🎴',
  players: { min: 3, max: 3 },
  modes: ['solo', 'hotseat', 'online'],
  patterns: ['open'],
  hiddenInformation: true,
  privateViews: true,
  ruleVersion: 1,
  howToPlay: [],
};
