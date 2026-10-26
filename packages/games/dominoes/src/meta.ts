import type { GameInfo } from '@brett-und-blatt/engine';

export const meta: GameInfo = {
  id: 'dominoes',
  name: 'Domino',
  description: 'Steine mit gleicher Augenzahl aneinanderlegen – als Block-, Zieh- oder Fünfer-Domino.',
  emoji: '🁫',
  players: { min: 2, max: 4 },
  modes: ['solo', 'hotseat', 'online'],
  patterns: ['hidden'],
  hiddenInformation: true,
  ruleVersion: 1,
  hints: true,
  howToPlay: [
    'Gespielt wird mit 28 Steinen von [0|0] bis [6|6]. Wer den höchsten Pasch hat, legt ihn zuerst.',
    'Reihum legt ihr einen Stein an ein offenes Ende der Kette – die Augenzahl muss passen.',
    'Kannst du nicht legen: Beim Block-Domino passt du, beim Zieh- und Fünfer-Domino ziehst du aus dem Vorrat, bis es geht.',
    'Wer zuerst alle Steine los ist, gewinnt die Runde und bekommt die Augen der anderen. Geht nichts mehr, gewinnt, wer die wenigsten Augen hat.',
    'Fünfer-Domino: Ergeben die offenen Enden zusammen 5, 10, 15 …, bekommst du sofort so viele Punkte. Ein Pasch am Ende zählt doppelt.',
    'Wer zuerst die Zielpunktzahl erreicht, gewinnt.',
  ],
};
