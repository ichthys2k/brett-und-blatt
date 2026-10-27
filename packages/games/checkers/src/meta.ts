import type { GameInfo } from '@brett-und-blatt/engine';

/**
 * Steckbrief des Spiels. Die Plattform liest ihn für das Menü, ohne das ganze
 * Spiel zu laden – deshalb steht er in einer eigenen, kleinen Datei.
 */
export const meta: GameInfo = {
  id: 'checkers',
  name: 'Dame',
  description: 'Diagonale Züge, Schlagzwang und fliegende Damen – der traditionsreiche Brettspiel-Klassiker.',
  emoji: '👑',
  players: { min: 2, max: 2 },
  modes: ['solo', 'hotseat', 'online'],
  patterns: ['open'],
  hiddenInformation: false,
  ruleVersion: 1,
  howToPlay: [
    'Gespielt wird auf den dunklen Feldern. Weiß beginnt. Einfache Steine ziehen diagonal ein Feld vorwärts.',
    'Kannst du schlagen, musst du schlagen (Schlagpflicht): Überspringe einen gegnerischen Stein diagonal auf das freie Feld dahinter. Geht es danach weiter, musst du im selben Zug weiterschlagen.',
    'Erreicht dein Stein die gegnerische Grundreihe, wird er zur Dame. Die fliegende Dame darf beliebig weit diagonal vor- und rückwärts ziehen und springen.',
    'Wer alle Steine des Gegners schlägt oder ihn bewegungsunfähig blockiert, gewinnt.',
  ],
};
