import type { GameInfo } from '@brett-und-blatt/engine';

export const meta: GameInfo = {
  id: 'estimate',
  name: 'Schätzmeister',
  description: 'Alle schätzen gleichzeitig eine Zahl, die Tafel zeigt alle Tipps. Wer am nächsten liegt, punktet. Für die ganze Klasse.',
  emoji: '🎯',
  players: { min: 1, max: 30 },
  modes: ['solo', 'hotseat', 'online'],
  patterns: ['simultaneous'],
  hiddenInformation: true,
  privateViews: true,
  ruleVersion: 1,
  // „Zug zurück“ nach der Auflösung wäre ein Blick auf die Lösung.
  noUndo: true,
  howToPlay: [
    'Alle sehen dieselbe Frage und geben gleichzeitig und verdeckt eine Zahl ein.',
    'Bei der Auflösung zeigt eine Zahlenleiste alle Tipps und die richtige Zahl.',
    'Wer am nächsten liegt, bekommt 10 Punkte, wer höchstens 10 % daneben liegt 5, bis 25 % daneben 2. Genau getroffen gibt 5 Punkte extra.',
  ],
};
