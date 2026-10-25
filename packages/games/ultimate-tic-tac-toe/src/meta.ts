import type { GameInfo } from '@brett-und-blatt/engine';

export const meta: GameInfo = {
  id: 'ultimate-tic-tac-toe',
  name: 'Ultimate Tic-Tac-Toe',
  description: 'Tic-Tac-Toe im Tic-Tac-Toe: Wo du setzt, bestimmt, wo dein Gegner spielen muss.',
  emoji: '#️⃣',
  players: { min: 2, max: 2 },
  modes: ['solo', 'hotseat', 'online'],
  patterns: ['open'],
  hiddenInformation: false,
  ruleVersion: 1,
  howToPlay: [
    'Das Brett besteht aus neun kleinen Tic-Tac-Toe-Feldern.',
    'Wo du im kleinen Feld setzt, bestimmt das große Feld, in dem dein Gegner als Nächstes spielen muss. Es leuchtet auf.',
    'Ist dieses Feld schon entschieden oder voll, darf der Gegner frei wählen.',
    'Drei in einer Reihe gewinnen ein kleines Feld. Drei gewonnene kleine Felder in einer Reihe gewinnen die Partie.',
  ],
};
