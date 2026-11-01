import type { GameInfo } from '@brett-und-blatt/engine';

export const meta: GameInfo = {
  id: 'majority',
  name: 'Mehrheitsfrage',
  description: 'Eine Frage, ein paar Antworten, und keine ist falsch: Punkte gibt es, wenn viele andere dasselbe wählen. Für die ganze Klasse.',
  emoji: '🙋',
  players: { min: 3, max: 30 },
  modes: ['solo', 'hotseat', 'online'],
  patterns: ['simultaneous'],
  hiddenInformation: true,
  privateViews: true,
  ruleVersion: 1,
  // „Zug zurück“ nach der Auflösung wäre ein Blick auf die Lösung.
  noUndo: true,
  howToPlay: [
    'Alle sehen dieselbe Frage und wählen gleichzeitig und verdeckt eine Antwort.',
    'Es gibt keine richtige Antwort: Überlege, was wohl die meisten wählen.',
    'Du bekommst Punkte nach dem Anteil derer, die dasselbe gewählt haben: Wählen es alle, sind es 10.',
  ],
};
