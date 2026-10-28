import type { GameInfo } from '@brett-und-blatt/engine';

export const meta: GameInfo = {
  id: 'scrabble',
  name: 'Wortgitter',
  description:
    'Kreuzworträtsel-Legespiel für 2–4 Spieler. Wörter anlegen, Multiplikatoren nutzen und geschickt aus dem Beutel ziehen.',
  emoji: '🔤',
  players: { min: 2, max: 4 },
  modes: ['solo', 'hotseat', 'online'],
  patterns: ['hidden'],
  hiddenInformation: true,
  privateViews: true,
  // Noch nicht spielbar (Prüfbericht vom 28.10.2026) – erst nach der Reparatur wieder freigeben.
  draft: true,
  ruleVersion: 1,
  hints: true,
  howToPlay: [
    'Lege abwechselnd Wörter waagerecht oder senkrecht an das bestehende Netz an.',
    'Der erste Zug muss das Mittelfeld H8 (Stern) überdecken und zählt als doppelter Wortwert.',
    'Buchstaben- und Wortprämien gelten nur beim ersten Belegen dieser Felder. Joker zählen 0 Punkte.',
    'Hast du alle 7 Steine gelegt, gibt es einen Bingo-Bonus von 50 Punkten.',
    'Spielende, wenn der Beutel leer ist und jemand keine Steine mehr hat oder sechs Pässe in Folge.',
  ],
};
