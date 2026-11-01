import type { GameInfo } from '@brett-und-blatt/engine';

export const meta: GameInfo = {
  id: 'timeline',
  name: 'Zeitstrahl',
  description: 'Ereignisse und biblische Geschichten in die richtige Reihenfolge bringen, alle gleichzeitig. Für die ganze Klasse.',
  emoji: '⏳',
  players: { min: 1, max: 30 },
  modes: ['solo', 'hotseat', 'online'],
  patterns: ['simultaneous'],
  hiddenInformation: true,
  privateViews: true,
  ruleVersion: 1,
  // „Zug zurück“ nach der Auflösung wäre ein Blick auf die Lösung.
  noUndo: true,
  howToPlay: [
    'Alle bekommen dieselben Ereignisse durcheinander und ordnen sie gleichzeitig.',
    'Das Früheste kommt nach oben. Mit den Pfeilen verschiebst du einen Eintrag, dann gibst du ab.',
    'Jeder Eintrag am richtigen Platz gibt 2 Punkte, die ganz richtige Reihenfolge 4 Punkte extra.',
  ],
};
