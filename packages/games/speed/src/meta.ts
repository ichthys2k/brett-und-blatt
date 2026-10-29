import type { GameInfo } from '@brett-und-blatt/engine';

/**
 * Steckbrief des Spiels. Die Plattform liest ihn für das Menü, ohne das ganze
 * Spiel zu laden – deshalb steht er in einer eigenen, kleinen Datei.
 */
export const meta: GameInfo = {
  id: 'speed',
  // „Speed“ ist ein traditioneller Spielname, keine Marke.
  name: 'Speed',
  description: 'Echtzeit-Kartenspiel für zwei: Beide legen gleichzeitig Karten, die einen Rang höher oder niedriger sind – wer zuerst alle Karten los ist, gewinnt.',
  emoji: '🏎️',
  players: { min: 2, max: 2 },
  // Echtzeit: Zwei Menschen an einem Gerät spielen mit geteiltem Bildschirm (gegenüber am Tablet).
  modes: ['solo', 'hotseat', 'online'],
  patterns: ['simultaneous'],
  hiddenInformation: true,
  // Nur Stapelreihenfolgen sind verdeckt, die Hände liegen offen (geteilter Bildschirm).
  privateViews: false,
  ruleVersion: 1,
  howToPlay: [
    'Jeder hat fünf Handkarten und einen verdeckten Nachziehstapel mit 15 Karten. In der Mitte liegen zwei Ablagestapel, daneben zwei Seitenstapel.',
    'Ihr spielt gleichzeitig, nicht reihum: Legt eine Handkarte auf einen Ablagestapel, wenn sie genau einen Rang höher oder niedriger ist. Die Farbe ist egal.',
    'Das Ass ist rund: Auf den König passt ein Ass, auf das Ass eine 2 oder ein König (abschaltbar).',
    'Eure Hand füllt sich sofort wieder auf fünf Karten auf.',
    'Kommt keiner weiter, tippt beide auf „Festgefahren“ – dann wird von jedem Seitenstapel eine Karte aufgedeckt.',
    'Wer zuerst Hand und Nachziehstapel leer hat, gewinnt die Runde.',
    'Zu zweit an einem Tablet: Jeder bekommt seine Bildschirmhälfte, wer gegenüber sitzt, sieht sie gedreht.',
  ],
};
