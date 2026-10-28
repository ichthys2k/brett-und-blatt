import type { GameInfo } from '@brett-und-blatt/engine';

/**
 * Steckbrief des Spiels. Die Plattform liest ihn für das Menü, ohne das ganze
 * Spiel zu laden – deshalb steht er in einer eigenen, kleinen Datei.
 */
export const meta: GameInfo = {
  id: 'ligretto',
  name: 'Ligretto',
  description: 'Schnelles Reaktionsspiel: Alle legen gleichzeitig Karten in die Mitte – wer zuerst seinen Ligretto-Stapel los ist, beendet die Runde.',
  emoji: '⚡',
  players: { min: 2, max: 8 },
  // Echtzeit: Alle handeln gleichzeitig, deshalb kein Hot-Seat – allein gegen Bots oder online.
  modes: ['solo', 'online'],
  patterns: ['simultaneous'],
  hiddenInformation: true,
  privateViews: false,
  ruleVersion: 2,
  howToPlay: [
    'Jeder hat einen Ligretto-Stapel (10 Karten, oberste offen), eine offene Reihe und verdeckte Handkarten.',
    'Alle spielen gleichzeitig: Legt die oberste Ligretto-Karte, Karten aus der Reihe oder die oberste umgeblätterte Handkarte in die Mitte.',
    'In der Mitte beginnt jeder Stapel mit einer 1 und geht in derselben Farbe bis 10 weiter. Volle Stapel werden abgeräumt.',
    'Eine Lücke in der Reihe füllt sich sofort aus dem Ligretto-Stapel. Handkarten blättert ihr in Dreierschritten um.',
    'Kommt niemand weiter, tippt auf „Festgefahren“. Hängen alle fest, wandert die oberste Ligretto-Karte nach unten.',
    'Wer den Ligretto-Stapel leer hat, beendet die Runde: +1 Punkt je Karte in der Mitte, −2 je Karte im Ligretto-Stapel.',
  ],
};
