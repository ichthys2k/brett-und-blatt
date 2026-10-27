import type { GameInfo } from '@brett-und-blatt/engine';

export const meta: GameInfo = {
  id: 'word-salad',
  name: 'Wort-Salat',
  description: 'Bilde aus den Buchstaben eines langen Stammwortes so viele echte deutsche Teilwörter wie möglich!',
  emoji: '🥗',
  players: { min: 1, max: 30 },
  modes: ['solo', 'hotseat', 'online'],
  patterns: ['hidden', 'simultaneous'],
  hiddenInformation: true,
  privateViews: false,
  ruleVersion: 1,
  howToPlay: [
    'In der Mitte liegt ein langes Stammwort (z. B. SONNENBLUME oder TASCHENLAMPE) aus Buchstabenkacheln bereit.',
    'Bilde daraus durch Antippen der Kacheln oder über die Tastatur möglichst viele echte deutsche Teilwörter (jeder Buchstabe darf pro Wort höchstens so oft genutzt werden, wie er im Stammwort vorkommt).',
    'Längere Wörter bringen mehr Punkte: 3 Buchstaben = 1 Pkt., 4 = 2 Pkt., 5 = 4 Pkt., 6 = 7 Pkt., ab 7 Buchstaben = 11 Punkte.',
    'Im Modus „Exklusiv-Bonus“ zählen Wörter, die am Ende der Runde nur eine einzige Person gefunden hat, sogar doppelt (⭐).',
    'Wer keine weiteren Wörter mehr weiß, klickt auf „Fertig für diese Runde“. Sobald alle fertig sind, werden alle Funde und versteckten Wörter aufgedeckt.',
  ],
};
