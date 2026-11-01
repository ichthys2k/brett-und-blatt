import type { GameInfo } from '@brett-und-blatt/engine';

export const meta: GameInfo = {
  id: 'describe-duel',
  name: 'Umschreibe-Duell',
  description: 'Zwei Teams, ein Begriff: Erkläre ihn deinem Team, ohne die Sperrwörter zu benutzen, die das andere Team gerade für dich ausgesucht hat.',
  emoji: '🗣️',
  players: { min: 4, max: 30 },
  modes: ['solo', 'hotseat', 'online'],
  patterns: ['hidden', 'simultaneous'],
  hiddenInformation: true,
  privateViews: true,
  ruleVersion: 1,
  teams: { count: 2, names: ['Team Sonne', 'Team Mond'] },
  howToPlay: [
    'Zwei Teams erklären abwechselnd. Wer erklärt, sieht den Begriff – das eigene Team muss ihn erraten.',
    'Vorher tippt das andere Team bis zu drei Sperrwörter ein. Die meistgenannten gelten: Sie, der Begriff selbst und ihre Wortstämme sind beim Erklären tabu.',
    'Schreib-Modus: Hinweise werden getippt, das Spiel blockt Sperrwörter von selbst. Je weniger Hinweise bis zum Treffer, desto mehr Punkte (3, 2 oder 1).',
    'Sprech-Modus: Erklärt wird laut. Fällt ein Sperrwort, drückt das andere Team „Gesagt!“ und bekommt den Punkt. Bots erklären hier nicht.',
  ],
};
