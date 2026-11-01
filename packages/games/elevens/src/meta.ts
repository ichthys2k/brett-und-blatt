import type { GameInfo } from '@brett-und-blatt/engine';

/**
 * Steckbrief des Spiels. Die Plattform liest ihn für das Menü, ohne das ganze
 * Spiel zu laden – deshalb steht er in einer eigenen, kleinen Datei.
 */
export const meta: GameInfo = {
  id: 'elevens',
  name: 'Elf zuerst!',
  description:
    'Das Familien-Anlegespiel mit 80 Zahlenkarten: Jede Farbe beginnt mit der Elf, dann geht es hinauf bis 20 und hinunter bis 1. Wer zuerst alle Karten los ist, gewinnt.',
  emoji: '🔢',
  players: { min: 2, max: 6 },
  modes: ['solo', 'hotseat', 'online'],
  patterns: ['hidden'],
  hiddenInformation: true,
  hints: true,
  ruleVersion: 1,
  howToPlay: [
    'Es gibt 80 Karten: die Zahlen 1 bis 20 in Rot, Gelb, Grün und Blau.',
    'Wer die rote Elf hat, legt sie als Erstes aus. Jede andere Farbe beginnt ebenfalls mit ihrer Elf.',
    'An eine Reihe legst du die nächsthöhere oder nächstniedrigere Zahl derselben Farbe an: auf die 11 folgen 12 und 10, dann 13 und 9 und so weiter.',
    'In deinem Zug legst du so viele passende Karten, wie du möchtest – mindestens eine, wenn du kannst. Mit „Fertig“ gibst du weiter.',
    'Passt keine Karte, ziehst du bis zu drei Karten vom Stapel. Passt eine, darfst du sie gleich legen.',
    'Wer zuerst keine Karten mehr hat, gewinnt.',
  ],
};
