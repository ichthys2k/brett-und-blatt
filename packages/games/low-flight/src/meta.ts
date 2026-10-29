import type { GameInfo } from '@brett-und-blatt/engine';

/**
 * Steckbrief des Spiels. Die Plattform liest ihn für das Menü, ohne das ganze
 * Spiel zu laden – deshalb steht er in einer eigenen, kleinen Datei.
 */
export const meta: GameInfo = {
  id: 'low-flight',
  // Eigener Name – „Skyjo“ ist eine Marke.
  name: 'Tiefflug',
  description: 'Zwölf verdeckte Zahlenkarten im Raster: tauschen, aufdecken, Spalten abräumen – wer am tiefsten fliegt, gewinnt. Mit Junior-Fassung für Kinder.',
  emoji: '🛩️',
  players: { min: 2, max: 8 },
  modes: ['solo', 'hotseat', 'online'],
  patterns: ['hidden'],
  hiddenInformation: true,
  // Verdeckte Karten sind für alle verdeckt – auch für den Besitzer. Kein Übergabe-Bildschirm nötig.
  privateViews: false,
  ruleVersion: 1,
  howToPlay: [
    'Jeder hat ein Raster verdeckter Karten (Werte von −2 bis 12). Ziel: am Ende der Runde eine möglichst niedrige Summe.',
    'Zu Beginn deckt jeder zwei eigene Karten auf (Junior: eine). Wer die höchste Summe zeigt, fängt an.',
    'Im Zug nimmst du die oberste Karte der Ablage und tauschst sie gegen eine eigene Karte – offen oder verdeckt.',
    'Oder du ziehst vom Stapel: Dann tauschst du die Karte ein oder wirfst sie ab und deckst dafür eine eigene verdeckte Karte auf.',
    'Drei gleiche offene Karten in einer Spalte werden abgeräumt und zählen nicht mehr.',
    'Hat jemand alle Karten offen, ist jeder andere noch einmal dran. Dann wird alles aufgedeckt und gezählt.',
    'Wer die Runde beendet, aber nicht allein die niedrigste Summe hat, zahlt doppelt. Ab 100 Punkten endet die Partie – die niedrigste Gesamtsumme gewinnt.',
  ],
};
