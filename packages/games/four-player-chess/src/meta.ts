import type { GameInfo } from '@brett-und-blatt/engine';

export const meta: GameInfo = {
  id: 'four-player-chess',
  name: 'Vierer-Schach',
  description: 'Schach zu viert auf dem Kreuzbrett – jeder gegen jeden mit Punkten oder zwei gegen zwei.',
  emoji: '♟️',
  players: { min: 4, max: 4 },
  modes: ['solo', 'hotseat', 'online'],
  patterns: ['open'],
  hiddenInformation: false,
  ruleVersion: 1,
  howToPlay: [
    'Rot, Blau, Gelb und Grün ziehen im Uhrzeigersinn. Die Figuren ziehen wie beim Schach, auch Rochade und en passant gibt es.',
    'Jeder gegen jeden: Schlagen bringt Punkte (Bauer 1, Springer 3, Läufer 5, Turm 5, Dame 9), Matt setzen 20. Wer matt ist, scheidet aus; seine Figuren bleiben grau stehen. Am Ende gewinnt, wer die meisten Punkte hat.',
    'Teams: Rot und Gelb spielen gegen Blau und Grün. Das erste Matt entscheidet.',
    'Bauern werden auf der 8. Reihe (jeder gegen jeden) bzw. der 11. Reihe (Teams) umgewandelt.',
    'Sind nur noch zwei übrig und liegt jemand 21 Punkte vorn, kann diese Person den Sieg beanspruchen.',
  ],
};
