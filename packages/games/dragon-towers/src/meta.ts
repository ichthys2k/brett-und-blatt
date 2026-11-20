import type { GameInfo } from '@brett-und-blatt/engine';

/**
 * Steckbrief des Spiels. Die Plattform liest ihn für das Menü, ohne das ganze
 * Spiel zu laden – deshalb steht er in einer eigenen, kleinen Datei.
 *
 * Eigene Fassung der Mechanik von „Kamisado“ (Peter Burley); Name und Gestaltung sind eigene.
 */
export const meta: GameInfo = {
  id: 'dragon-towers',
  name: 'Drachentürme',
  description: 'Acht Türme, acht Farben: Wo dein Turm landet, bestimmt, welchen Turm dein Gegner ziehen muss.',
  emoji: '🏯',
  players: { min: 2, max: 2 },
  modes: ['solo', 'hotseat', 'online'],
  patterns: ['open'],
  hiddenInformation: false,
  takeBack: true,
  ruleVersion: 1,
  howToPlay: [
    'Jeder hat acht Türme, je einen in jeder Farbe des Bretts. Wer zuerst einen Turm auf die gegnerische Grundreihe bringt, gewinnt.',
    'Türme ziehen beliebig weit gerade oder schräg nach vorn, aber nie über andere Türme hinweg und nie auf ein besetztes Feld. Geschlagen wird nicht.',
    'Schwarz beginnt und wählt den ersten Turm frei. Danach musst du immer den Turm ziehen, der die Farbe des Feldes hat, auf dem der letzte gegnerische Turm gelandet ist.',
    'Ist dein Turm eingesperrt, setzt du aus. Dann zieht dein Gegner den Turm in der Farbe des Feldes, auf dem dein eingesperrter Turm steht.',
    'Sperren sich beide Seiten gegenseitig ein, verliert, wer den letzten echten Zug gemacht hat.',
  ],
};
