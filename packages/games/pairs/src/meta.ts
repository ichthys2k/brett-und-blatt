import type { GameInfo } from '@brett-und-blatt/engine';

export const meta: GameInfo = {
  id: 'pairs',
  name: 'Paare finden',
  description: 'Zwei Karten aufdecken, Paare finden, gut merken – auch mit Einmaleins und Vokabeln.',
  emoji: '🃏',
  players: { min: 1, max: 6 },
  modes: ['solo', 'hotseat', 'online'],
  patterns: ['hidden'],
  hiddenInformation: true,
  // Was aufgedeckt wird, sehen alle – deshalb kein Übergabe-Bildschirm.
  privateViews: false,
  ruleVersion: 1,
  howToPlay: [
    'Alle Karten liegen verdeckt. Wer dran ist, deckt zwei Karten auf.',
    'Passen sie zusammen – gleiches Bild oder zusammengehörige Begriffe wie „7 · 8“ und „56“ –, behältst du das Paar und bist noch einmal dran.',
    'Sonst bleiben die Karten offen liegen, bis der Nächste aufdeckt. Gut merken!',
    'Wer am Ende die meisten Paare hat, gewinnt. Allein spielst du gegen die Zahl deiner Züge.',
  ],
};
