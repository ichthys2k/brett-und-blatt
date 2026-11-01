import type { GameInfo } from '@brett-und-blatt/engine';

/**
 * Steckbrief des Spiels. Die Plattform liest ihn für das Menü, ohne das ganze
 * Spiel zu laden – deshalb steht er in einer eigenen, kleinen Datei.
 */
export const meta: GameInfo = {
  id: 'chinese-checkers',
  name: 'Sternhalma',
  description: 'Der Klassiker auf dem Sternbrett: Bringe alle Steine mit Schritten und langen Sprungketten in die gegenüberliegende Zacke – für 2 bis 6 Spieler.',
  emoji: '🌟',
  players: { min: 2, max: 6 },
  modes: ['solo', 'hotseat', 'online'],
  patterns: ['open'],
  hiddenInformation: false,
  hints: true,
  ruleVersion: 1,
  howToPlay: [
    'Jeder beginnt in einer Zacke des Sterns und muss alle Steine in die gegenüberliegende Zacke bringen.',
    'Ein Zug ist ein Schritt auf ein freies Nachbarloch oder ein Sprung über einen Nachbarstein (gleich welcher Farbe) auf das freie Loch dahinter.',
    'Sprünge lassen sich zu Ketten verbinden; du darfst nach jedem Sprung aufhören. Geschlagen wird nicht.',
    'Steine, die im Ziel angekommen sind, dürfen das Ziel nicht mehr verlassen.',
    'Wer zuerst alle Ziellöcher besetzt hat, gewinnt. Stehen dort noch fremde Steine, reicht es, wenn alle übrigen Löcher dir gehören.',
    `Nach 150 Runden gewinnt, wessen Steine dem Ziel am nächsten sind.`,
  ],
};
