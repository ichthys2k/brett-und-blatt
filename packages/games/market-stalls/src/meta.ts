import type { GameInfo } from '@brett-und-blatt/engine';

/**
 * Steckbrief des Spiels. Die Plattform liest ihn für das Menü, ohne das ganze
 * Spiel zu laden – deshalb steht er in einer eigenen, kleinen Datei.
 */
export const meta: GameInfo = {
  id: 'market-stalls',
  name: 'Marktstände',
  description:
    'Alle wählen gleichzeitig eine Karte, dann legt jeder selbst an einen von vier Ständen. Wer abräumt, füllt seine Vorratskammer – aber jeder Händler lebt nur von einer Ware.',
  emoji: '🧺',
  players: { min: 2, max: 10 },
  modes: ['solo', 'hotseat', 'online'],
  patterns: ['hidden', 'simultaneous'],
  hiddenInformation: true,
  hints: true,
  ruleVersion: 1,
  howToPlay: [
    'Es gibt 60 Karten mit den Zahlen 1 bis 60 in vier Waren: Brot, Käse, Äpfel und Fisch. Jede Karte trägt 0, 1 oder 2 Sterne.',
    'Alle wählen gleichzeitig eine Handkarte. Dann wird aufgedeckt und von der kleinsten Zahl an gelegt.',
    'Du entscheidest selbst, an welchen der vier Stände du legst. Erlaubt ist ein leerer Stand, ein Stand mit kleinerer oberster Karte oder einer mit derselben Ware obenauf.',
    'Wer die fünfte Karte an einen Stand legt, nimmt alle fünf in seine Vorratskammer. Der Stand ist danach leer.',
    'Passt deine Karte nirgends, wählst du einen Stand und nimmst dessen Karten. Deine Karte eröffnet ihn neu.',
    'Nach drei Markttagen wird gewertet: Nur deine stärkste Ware kann Pluspunkte bringen, und nur, wenn du dort die meisten Karten aller Spieler hast (bei Gleichstand alle an der Spitze). Alle anderen Sterne zählen minus.',
    'Am meisten Punkte gewinnt. Bei Gleichstand entscheiden die Sterne der stärksten Ware.',
  ],
};
