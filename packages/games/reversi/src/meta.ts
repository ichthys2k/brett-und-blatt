import type { GameInfo } from '@brett-und-blatt/engine';

export const meta: GameInfo = {
  id: 'reversi',
  name: 'Reversi',
  description: 'Gegnerische Steine einschließen und umdrehen – am Ende zählt, wer mehr Steine hat.',
  emoji: '⚫',
  players: { min: 2, max: 2 },
  modes: ['solo', 'hotseat', 'online'],
  patterns: ['open'],
  hiddenInformation: false,
  ruleVersion: 1,
  howToPlay: [
    'Schwarz beginnt. Setze einen Stein so, dass gegnerische Steine zwischen ihm und einem deiner Steine eingeschlossen sind – in einer oder mehreren Richtungen.',
    'Alle eingeschlossenen Steine werden umgedreht und gehören dann dir.',
    'Wer nicht setzen kann, muss passen. Kann niemand mehr setzen, ist Schluss.',
    'Wer am Ende mehr Steine hat, gewinnt. Tipp: Ecken lassen sich nie mehr umdrehen.',
  ],
};
