import type { GameInfo } from '@brett-und-blatt/engine';

export const meta: GameInfo = {
  id: 'hangman',
  name: 'Galgenmännchen',
  description: 'Geheime Wörter Buchstabe für Buchstabe enträtseln – mit Schneemann, Blume oder klassischem Galgen, reihum oder im Wettrennen.',
  emoji: '🔤',
  players: { min: 1, max: 30 },
  modes: ['solo', 'hotseat', 'online'],
  patterns: ['hidden', 'simultaneous'],
  hiddenInformation: true,
  privateViews: false,
  ruleVersion: 1,
  howToPlay: [
    'In jeder Runde wird ein geheimes Wort aus dem gewählten Themenpaket gesucht.',
    'Tippe auf einen Buchstaben der Bildschirm-Tastatur (oder drücke ihn auf deiner Tastatur), um zu prüfen, ob er im Wort vorkommt.',
    'Kommt der Buchstabe vor, wird er an allen passenden Stellen aufgedeckt und bringt Punkte. Fehlt er, wächst die Zeichnung (Galgen, Schneemann oder Blume) um einen Schritt.',
    'Im Modus „Reihum“ raten alle gemeinsam am selben Wort; im Modus „Wettrennen“ knackt jeder möglichst fehlerfrei dieselbe Wortfolge.',
  ],
};
