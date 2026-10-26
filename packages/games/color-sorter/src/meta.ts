import type { GameInfo } from '@brett-und-blatt/engine';

export const meta: GameInfo = {
  id: 'color-sorter',
  name: 'Farbensortierer',
  description: 'Emoji-Karten nach Farben und Zahlen sortieren, Tier-Gegner besiegen und mit Mods ein unschlagbares Team bauen – allein oder im Duell.',
  emoji: '🎨',
  players: { min: 1, max: 8 },
  modes: ['solo', 'hotseat', 'online'],
  patterns: ['hidden', 'parallel', 'simultaneous'],
  hiddenInformation: true,
  ruleVersion: 1,
  hints: true,
  howToPlay: [
    'Du hast 8 Karten auf der Hand. Wähle bis zu 5 aus und schicke sie ab: Je nach Kombi (Duo, Triple, Zahlen-Lauf, Farben-Satz …) gibt es Chips und Mult. Punkte = Chips × Mult.',
    'Jede Runde hat ein Ziel. Du hast 4 Hände und 3-mal Verwerfen, um es zu erreichen. Ein Level hat drei Runden: Vorhut, Wächter und Boss. Vorhut und Wächter darfst du überspringen und bekommst dafür einen Sticker.',
    'Nach jeder Runde gibt es Token (T) für die Sortier-Zentrale: Mods verändern die Wertung, Zauberkarten verwandeln deine Karten, Nagelstudio-Karten verbessern eine Kombi, Lieferungen enthalten eine Auswahl, Werkzeuge helfen dauerhaft.',
    'Schaffst du den Boss von Level 8, hast du gewonnen.',
    'Zu mehreren spielt jeder seinen eigenen Lauf mit denselben Karten. Im Duell ersetzt ab Level 2 ein Duell den Boss: Wer weniger Punkte holt, verliert ein Leben. Wer zuletzt noch Leben hat, gewinnt.',
  ],
};
