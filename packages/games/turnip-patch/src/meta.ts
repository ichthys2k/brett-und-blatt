import type { GameInfo } from '@brett-und-blatt/engine';

/**
 * Steckbrief des Spiels. Die Plattform liest ihn für das Menü, ohne das ganze
 * Spiel zu laden – deshalb steht er in einer eigenen, kleinen Datei.
 */
export const meta: GameInfo = {
  id: 'turnip-patch',
  name: 'Rübenacker',
  description: 'Hasenrennen im Königsgarten: Wer erreicht zuerst die Riesenrübe des Königs? Achtung, Gärtner Maulwurf gräbt unter dem Beet – für Kinder ab 4 Jahren.',
  emoji: '🥕',
  players: { min: 2, max: 6 },
  modes: ['solo', 'hotseat', 'online'],
  patterns: ['open'],
  hiddenInformation: true,
  privateViews: false,
  hints: true,
  ruleVersion: 1,
  howToPlay: [
    'Jeder hat drei Hasen auf der Wiese. Wer zuerst einen Hasen an der Riesenrübe hat, gewinnt.',
    'Wer dran ist, zieht eine Karte: 1, 2 oder 3 Felder vorwärts für einen Hasen deiner Wahl.',
    'Besetzte Felder werden übersprungen und nicht mitgezählt.',
    'Bei „Maulwurf“ taucht Gärtner Maulwurf am Erdhügel auf: Ein Hase dort purzelt ins Loch und muss zurück zum letzten Zaunpfahl.',
    'Danach wandert der Maulwurf auf seiner Spur zum nächsten Hügel. Den siehst du schon vorher – weich ihm aus!',
  ],
};
