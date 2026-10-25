import type { GameInfo } from '@brett-und-blatt/engine';

export const meta: GameInfo = {
  id: 'battleship',
  name: 'Schiffe versenken',
  description: 'Flotte verstecken, Koordinaten raten, Treffer – versenkt! Wer zuerst alle Schiffe des anderen findet, gewinnt.',
  emoji: '🚢',
  players: { min: 2, max: 2 },
  modes: ['solo', 'hotseat', 'online'],
  patterns: ['hidden', 'simultaneous'],
  hiddenInformation: true,
  ruleVersion: 1,
  howToPlay: [
    'Beide stellen gleichzeitig ihre Flotte verdeckt auf: Schiffe liegen gerade und dürfen sich nicht berühren, auch nicht über Eck.',
    'Dann schießt ihr abwechselnd auf ein Feld im Meer des anderen: Wasser, Treffer oder versenkt.',
    'Nach einem Treffer darfst du gleich noch einmal schießen.',
    'Wer zuerst alle gegnerischen Schiffe versenkt, gewinnt.',
  ],
};
