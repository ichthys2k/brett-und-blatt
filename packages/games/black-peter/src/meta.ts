import type { GameInfo } from '@brett-und-blatt/engine';

export const meta: GameInfo = {
  id: 'black-peter',
  name: 'Schwarzer Peter',
  description: 'Paare ablegen, beim Nachbarn ziehen – und bloß nicht am Ende den Schwarzen Peter behalten.',
  emoji: '🐈‍⬛',
  players: { min: 2, max: 6 },
  modes: ['solo', 'hotseat', 'online'],
  patterns: ['hidden'],
  hiddenInformation: true,
  ruleVersion: 1,
  howToPlay: [
    'Alle Karten werden verteilt. Paare legt jeder sofort offen ab.',
    'Wer dran ist, zieht eine verdeckte Karte vom nächsten Mitspieler. Ergibt sie ein Paar, wird es abgelegt.',
    'Vor dem Ziehen darfst du einmal deine Karten mischen – dann weiß niemand, wo der Peter steckt.',
    'Wer keine Karten mehr hat, ist fertig. Wer zum Schluss den Schwarzen Peter 🐈‍⬛ behält, verliert.',
  ],
};
