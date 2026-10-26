import type { GameInfo } from '@brett-und-blatt/engine';

export const meta: GameInfo = {
  id: 'color-and-shape',
  name: 'Farbe & Form',
  description: 'Steine anlegen: Reihen gleicher Farbe oder gleicher Form – wer geschickt kreuzt, punktet doppelt.',
  emoji: '🔷',
  players: { min: 2, max: 4 },
  modes: ['solo', 'hotseat', 'online'],
  patterns: ['hidden'],
  hiddenInformation: true,
  ruleVersion: 1,
  hints: true,
  howToPlay: [
    'Es gibt 108 Steine: sechs Farben × sechs Formen, jeden dreimal. Jeder hat sechs Steine auf dem Bänkchen.',
    'Lege einen oder mehrere Steine in eine gerade Reihe an. In jeder Reihe haben alle Steine dieselbe Farbe oder dieselbe Form – und kein Stein kommt doppelt vor.',
    'Jede Reihe, die du verlängerst oder bildest, bringt so viele Punkte, wie Steine in ihr liegen. Eine volle Sechserreihe zählt 6 Punkte extra.',
    'Statt zu legen, darfst du Steine mit dem Beutel tauschen. Danach füllst du auf sechs auf.',
    'Ist der Beutel leer und jemand legt seinen letzten Stein, bekommt er 6 Punkte dazu und das Spiel endet. Die meisten Punkte gewinnen.',
  ],
};
