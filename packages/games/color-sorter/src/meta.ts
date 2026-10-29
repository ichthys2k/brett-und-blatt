import type { GameInfo } from '@brett-und-blatt/engine';

export const meta: GameInfo = {
  id: 'color-sorter',
  name: 'Narrenhof',
  description: 'Als junger Hofnarr bringst du mit Paaren, Straßen und Farben die Tiere am Hof von König Nobel zum Lachen und sammelst eine bunte Narrentruppe – allein oder im Wettstreit.',
  emoji: '🃏',
  players: { min: 1, max: 8 },
  modes: ['solo', 'hotseat', 'online'],
  patterns: ['hidden', 'parallel', 'simultaneous'],
  hiddenInformation: true,
  ruleVersion: 2,
  hints: true,
  howToPlay: [
    'Du bist ein junger Narr am Hof von König Nobel. Du hast 8 Karten auf der Hand. Wähle bis zu 5 aus und führe sie vor: Paar, Drilling, Straße, Farbe, Full House … bringen Witz und Lachen. Applaus = Witz × Lachen.',
    'Jede Audienz hat ein Applaus-Ziel. Du hast 4 Vorführungen und 3-mal Tauschen. Ein Hoftag hat drei Audienzen: Morgenaudienz, Festmahl und Thronsaal, wo die Herrschaft eine Marotte hat. Morgenaudienz und Festmahl darfst du auslassen, dann schuldet dir der Hof einen Gefallen.',
    'Nach jeder Audienz bekommst du Brezeln 🥨 für den Jahrmarkt: Narren helfen dir dauerhaft, Kunststücke verändern deine Karten, Übungen machen eine Kombi stärker, Bündel enthalten eine Auswahl, Privilegien gelten bis zum Ende.',
    'Bringst du am achten Hoftag die Herrschaft im Thronsaal zum Lachen, wirst du Hofnarr.',
    'Zu mehreren spielt jeder sein eigenes Spiel mit denselben Karten. Ab Hoftag 2 ersetzt ein Wettstreit den Thronsaal: Wer weniger Applaus bekommt, verliert ein Herz. Wer zuletzt noch Herzen hat, gewinnt.',
  ],
};
