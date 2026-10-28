import type { GameInfo } from '@brett-und-blatt/engine';

export const meta: GameInfo = {
  id: 'mau-mau',
  name: 'Mau-Mau',
  description:
    'Das klassische Ablegespiel mit 32 Karten: Passend zur Farbe oder zum Wert legen, mit 7er-Strafen, Aussetzen und Buben-Wunsch. Vor der letzten Karte heißt es „Mau!“',
  emoji: '♠️',
  players: { min: 2, max: 5 },
  modes: ['solo', 'hotseat', 'online'],
  patterns: ['hidden'],
  hiddenInformation: true,
  ruleVersion: 1,
  howToPlay: [
    'Lege eine Karte ab, die in Farbe oder Wert zur obersten Karte passt.',
    'Eine 7 lässt den Nächsten zwei Karten ziehen, eine 8 setzt ihn aus. Mit einer weiteren 7 kannst du die Strafe weiterreichen.',
    'Der Bube ist ein Wunschbube: Lege ihn auf eine beliebige Karte und bestimme die neue Farbe. Bube auf Bube ist verboten.',
    'Eine 9 dreht die Spielrichtung. Bei zwei Spielern setzt sie den Gegner aus.',
    'Vor deiner letzten Karte musst du „Mau!“ rufen – sonst zieht der Nächste dich mit einer Strafkarte.',
    'Wer zuerst alle Karten abgelegt hat, gewinnt.',
  ],
};
