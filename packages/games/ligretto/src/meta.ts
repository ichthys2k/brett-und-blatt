import type { GameInfo } from '@brett-und-blatt/engine';

/**
 * Steckbrief des Spiels. Die Plattform liest ihn für das Menü, ohne das ganze
 * Spiel zu laden – deshalb steht er in einer eigenen, kleinen Datei.
 */
export const meta: GameInfo = {
  id: 'ligretto',
  name: 'Ligretto',
  description: 'Schnelles Reaktionsspiel: Legt Karten gleichzeitig auf die Mittelfeldstapel und versucht, den eigenen Ligretto-Stapel zuerst leer zu bekommen.',
  emoji: '⚡',
  players: { min: 2, max: 8 },
  modes: ['hotseat', 'online'],
  patterns: ['open'],
  hiddenInformation: true,
  ruleVersion: 1,
  howToPlay: [
    'Jeder hat einen verdeckten Ligretto-Stapel, einen offenen Handstapel und eine offene Hand.',
    'In der Mitte liegen Stapel, auf die nur der Reihe nach in gleicher Farbe gelegt werden darf (1→2→3...).',
    'Legt sofort passende Karten von Hand oder Handstapel auf mittlere Stapel – ihr seid alle gleichzeitig dran.',
    'Wer seinen Ligretto-Stapel zuerst leer hat, ruft „Ligretto!“ und die Runde endet.',
  ],
};
