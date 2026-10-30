import type { GameInfo } from '@brett-und-blatt/engine';

/**
 * Steckbrief des Spiels. Die Plattform liest ihn für das Menü, ohne das ganze
 * Spiel zu laden – deshalb steht er in einer eigenen, kleinen Datei.
 */
export const meta: GameInfo = {
  id: 'symbol-match',
  // Eigener Name – „Dobble“ ist eine Marke.
  name: 'Fix gefunden!',
  description: 'Reaktionsspiel: Zwischen zwei Karten gibt es immer genau ein gleiches Symbol – wer es zuerst findet, gewinnt die Karte.',
  emoji: '🔍',
  players: { min: 1, max: 8 },
  modes: ['solo', 'hotseat', 'online'],
  patterns: ['simultaneous'],
  hiddenInformation: true,
  // Nur der Stapel ist verdeckt, alles andere liegt offen (geteilter Bildschirm).
  privateViews: false,
  ruleVersion: 1,
  howToPlay: [
    'Je zwei Karten haben genau ein gleiches Symbol. Findest du es zuerst, gehört die Karte dir.',
    'Turmbau: Jeder hat eine Karte vor sich, in der Mitte liegt die nächste. Tippe das gleiche Symbol an – dann kommt die Mittelkarte auf deinen Turm. Der höchste Turm gewinnt.',
    'Brunnen: Alle Karten sind verteilt. Passt deine oberste Karte zur Mittelkarte, legst du sie in die Mitte. Wer zuerst keine Karte mehr hat, gewinnt.',
    'Vergiftetes Geschenk: Findest du das gleiche Symbol zwischen der Mittelkarte und der Karte eines Mitspielers, bekommt er sie. Wer am Ende die wenigsten Karten hat, gewinnt.',
    'Alle spielen gleichzeitig. Ein falsches Symbol sperrt dich, bis eine neue Karte in der Mitte liegt.',
    'Allein spielst du Turmbau als Training. Zu mehreren an einem Tablet bekommt jeder seine eigene Bildschirmhälfte.',
    'Mit „Mathe“ als Symbolpaket suchst du den gleichen Wert in verschiedener Schreibweise, z. B. 12 und 3·4.',
  ],
};
