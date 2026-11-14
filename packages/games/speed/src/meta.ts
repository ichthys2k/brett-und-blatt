import type { GameInfo } from '@brett-und-blatt/engine';

/**
 * Steckbrief des Spiels. Die Plattform liest ihn für das Menü, ohne das ganze
 * Spiel zu laden – deshalb steht er in einer eigenen, kleinen Datei.
 */
export const meta: GameInfo = {
  id: 'speed',
  // „Speed“ ist ein traditioneller Spielname, keine Marke.
  name: 'Speed',
  description: 'Echtzeit-Kartenspiel für 2–4 Spieler: Alle legen gleichzeitig Karten, die einen Rang höher oder niedriger sind – wer zuerst alle Karten los ist, gewinnt.',
  emoji: '🏎️',
  players: { min: 2, max: 4 },
  // Echtzeit: Zwei Menschen an einem Gerät spielen mit geteiltem Bildschirm (gegenüber am Tablet).
  modes: ['solo', 'hotseat', 'online'],
  patterns: ['simultaneous'],
  hiddenInformation: true,
  // Nur Stapelreihenfolgen sind verdeckt, die Hände liegen offen (geteilter Bildschirm).
  privateViews: false,
  ruleVersion: 1,
  howToPlay: [
    'Jeder hat fünf Handkarten und einen verdeckten Nachziehstapel. In der Mitte liegen die offenen Ablagestapel und verdeckte Seitenstapel (zu dritt und viert wird mit doppeltem Blatt und vier Ablagestapeln gespielt).',
    'Ihr spielt gleichzeitig, nicht reihum: Legt eine Handkarte auf einen Ablagestapel, wenn sie genau einen Rang höher oder niedriger ist. Die Farbe ist egal.',
    'Das Ass ist rund: Auf den König passt ein Ass, auf das Ass eine 2 oder ein König (abschaltbar).',
    'Je nach Option füllt sich eure Hand sofort wieder auf fünf Karten auf oder ihr tippt selbst auf euren Nachziehstapel („Nachziehen von Hand“).',
    'In der Variante „Spit“ hat jeder fünf eigene Auslagestapel (1 bis 5 Karten, oberste offen); wird ein Platz frei, deckt sich die nächste Karte darunter auf.',
    'Kommt keiner weiter, tippt auf „Festgefahren“ – dann wird von jedem Seitenstapel eine Karte aufgedeckt.',
    'Wer zuerst Hand und Nachziehstapel leer hat, gewinnt die Runde.',
  ],
};
