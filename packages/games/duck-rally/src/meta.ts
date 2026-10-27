import type { GameInfo } from '@brett-und-blatt/engine';

export const meta: GameInfo = {
  id: 'duck-rally',
  name: 'Enten-Rallye',
  description: 'Kopfrechen-Wettrennen mit Gummienten: Grundrechenarten, Gleichungen, Prozente und Primzahlen lösen, um als Erste durchs Ziel zu schwimmen!',
  emoji: '🦆',
  players: { min: 1, max: 30 },
  modes: ['solo', 'hotseat', 'online'],
  patterns: ['simultaneous', 'parallel'],
  hiddenInformation: true,
  privateViews: false,
  ruleVersion: 1,
  howToPlay: [
    'Jede Spielerin und jeder Spieler steuert eine farbige Gummiente im Fluss Richtung Ziellinie 🏁.',
    'Löse die angezeigte Mathe-Aufgabe über das Zahlenfeld (oder die Tastatur) und bestätige mit „GO!“ – bei Primzahl-Aufgaben tippst du direkt auf die einzige Primzahl unter den sechs Zahlen.',
    'Alle Enten bekommen über das Rennen hinweg dieselben Aufgaben (in 3er-Blöcken leicht gemischt, damit niemand beim Nachbarn abschreiben kann).',
    'Jede richtige Antwort gibt deiner Ente einen Schwimm-Schub nach vorn! Bei einer falschen Antwort reißt deine Serie ab und es erscheint eine neue Ersatz-Aufgabe.',
    'Wer zuerst die volle Streckenlänge (10, 15 oder 25 Aufgaben) schafft, gewinnt die Enten-Rallye und klettert ganz nach oben aufs Siegertreppchen!',
  ],
};
