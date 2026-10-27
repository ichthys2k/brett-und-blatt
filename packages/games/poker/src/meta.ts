import type { GameInfo } from '@brett-und-blatt/engine';

export const meta: GameInfo = {
  id: 'poker',
  name: 'Poker',
  description: 'Texas Hold’em um Spielchips – mit Setzrunden, Side-Pots, Bluff und laufendem Ein- und Ausstieg am Tisch.',
  emoji: '♠️',
  players: { min: 2, max: 10 },
  modes: ['solo', 'hotseat', 'online'],
  patterns: ['hidden'],
  hiddenInformation: true,
  privateViews: false,
  joinMidGame: true,
  ruleVersion: 1,
  hints: true,
  howToPlay: [
    'Gespielt wird nur um Spielchips (oder Bohnen/Streichhölzer) innerhalb einer Partie – es gibt nichts zu gewinnen außer der Ehre.',
    'Jeder erhält 2 verdeckte Handkarten; in der Tischmitte werden schrittweise 5 Gemeinschaftskarten aufgedeckt (Flop 3, Turn 1, River 1).',
    'In jeder Setzrunde kannst du passen (Fold), schieben (Check), mitgehen (Call), setzen/erhöhen (Bet/Raise) oder alles setzen (All-in).',
    'Beim Showdown gewinnt die beste 5-Karten-Hand aus deinen 2 und den 5 Gemeinschaftskarten: Straight Flush > Vierling > Full House > Flush > Straße > Drilling > Zwei Paare > Paar > Höchste Karte.',
    'An freie Plätze am Tisch kann man sich jederzeit dazusetzen und spielt ab der nächsten Hand mit; wer aufsteht, passt die laufende Hand und gibt den Platz frei.',
  ],
};
