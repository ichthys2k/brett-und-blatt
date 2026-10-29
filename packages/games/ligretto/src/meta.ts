import type { GameInfo } from '@brett-und-blatt/engine';

/**
 * Steckbrief des Spiels. Die Plattform liest ihn für das Menü, ohne das ganze
 * Spiel zu laden – deshalb steht er in einer eigenen, kleinen Datei.
 */
export const meta: GameInfo = {
  id: 'ligretto',
  // Eigener Name: „Ligretto“ ist eine eingetragene Marke.
  name: 'Kartenblitz',
  description: 'Schnelles Reaktionsspiel: Alle legen gleichzeitig Karten in die Mitte – wer zuerst seinen Blitzstapel los ist, beendet die Runde.',
  emoji: '⚡',
  players: { min: 2, max: 8 },
  // Echtzeit: Alle handeln gleichzeitig. Mehrere an einem Gerät spielen mit geteiltem Bildschirm
  // (jeder hat seinen Bereich, gegenüber Sitzende gedreht) – gedacht für Tablet oder Smartboard.
  modes: ['solo', 'hotseat', 'online'],
  patterns: ['simultaneous'],
  hiddenInformation: true,
  privateViews: false,
  ruleVersion: 2,
  howToPlay: [
    'Jeder hat einen Blitzstapel (10 Karten, oberste offen), eine offene Reihe und verdeckte Handkarten.',
    'Alle spielen gleichzeitig: Legt die oberste Karte des Blitzstapels, Karten aus der Reihe oder die oberste umgeblätterte Handkarte in die Mitte.',
    'In der Mitte beginnt jeder Stapel mit einer 1 und geht in derselben Farbe bis 10 weiter. Volle Stapel werden abgeräumt.',
    'Eine Lücke in der Reihe füllt sich sofort aus dem Blitzstapel. Handkarten blättert ihr in Dreierschritten um.',
    'Kommt niemand weiter, tippt auf „Festgefahren“. Hängen alle fest, wandert die oberste Karte jedes Blitzstapels nach unten.',
    'Wer den Blitzstapel leer hat, beendet die Runde: +1 Punkt je Karte in der Mitte, −2 je Karte im Blitzstapel.',
    'Zu mehreren an einem Tablet: Jeder bekommt seinen eigenen Bereich, wer gegenüber sitzt, sieht ihn gedreht. Am besten bis zu vier Spieler.',
  ],
};
