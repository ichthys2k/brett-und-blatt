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
  ruleVersion: 2,
  // Eigene Musik: das Lied der führenden Ente, Ansager und Siegesmusik (ui/audio.ts).
  ownMusic: true,
  howToPlay: [
    'Nach dem Countdown „3, 2, 1, los!“ geht es gleichzeitig los. Jede Spielerin und jeder Spieler steuert eine farbige Gummiente im Fluss Richtung Ziellinie 🏁.',
    'Löse die angezeigte Mathe-Aufgabe über das Zahlenfeld (oder die Tastatur) und bestätige mit „GO!“ – bei Primzahl-Aufgaben tippst du direkt auf die einzige Primzahl unter den sechs Zahlen.',
    'Alle Enten bekommen über das Rennen hinweg dieselben Aufgaben (in 3er-Blöcken leicht gemischt, damit niemand beim Nachbarn abschreiben kann).',
    'Die Strömung trägt alle Enten langsam von selbst Richtung Ziel. Jede richtige Antwort gibt deiner Ente einen Schwimm-Schub nach vorn – und mit jeder richtigen Antwort in Folge schwimmt sie auch zwischendurch schneller.',
    'Bei einer falschen Antwort reißt deine Serie ab (die Ente wird wieder langsamer) und es erscheint eine neue Ersatz-Aufgabe.',
    'Wer zuerst das Ziel erreicht, gewinnt die Enten-Rallye und klettert ganz nach oben aufs Siegertreppchen! Die Streckenlänge (10, 15 oder 25) zählt die Schübe, die man ohne Strömung bräuchte.',
  ],
};
