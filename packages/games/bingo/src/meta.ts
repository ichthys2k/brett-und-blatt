import type { GameInfo } from '@brett-und-blatt/engine';

export const meta: GameInfo = {
  id: 'bingo',
  name: 'Bingo',
  description: 'Die Spielleitung zieht, alle markieren gleichzeitig – wer zuerst eine volle Reihe hat, ruft „Bingo!“. Für bis zu 30 Mitspieler.',
  emoji: '🎱',
  players: { min: 1, max: 30 },
  modes: ['solo', 'hotseat', 'online'],
  patterns: ['simultaneous'],
  // Die Karten sind offen; geheim ist nur die Ziehreihenfolge, und die kennt auch am selben Gerät niemand.
  hiddenInformation: true,
  privateViews: false,
  ruleVersion: 1,
  howToPlay: [
    'Platz 1 ist die Spielleitung und zieht mit „Nächste Zahl“ einen Eintrag nach dem anderen.',
    'Steht die gezogene Zahl auf deiner Karte, tippst du sie an. Das Mittelfeld ⭐ ist frei.',
    'Hast du eine volle Reihe – waagrecht, senkrecht oder diagonal –, drückst du „Bingo!“. Wer zur selben Ziehung ebenfalls fertig ist, gewinnt mit.',
    'Wer ohne volle Reihe ruft, muss bis zur nächsten Ziehung aussetzen (einstellbar).',
    'Im Lern-Bingo wird eine Aufgabe angesagt (z. B. „7 · 8“) – auf der Karte suchst du die Lösung.',
  ],
};
