import type { GameInfo } from '@brett-und-blatt/engine';

export const meta: GameInfo = {
  id: 'number-wall',
  name: 'Rechenmauer',
  description: 'Lücken in der Zahlenmauer durch Vorwärts- und Rückwärtsrechnen füllen – mit natürlichen Zahlen, negativen Zahlen, Dezimalzahlen oder dem Einmaleins.',
  emoji: '🧱',
  players: { min: 1, max: 30 },
  modes: ['solo', 'hotseat', 'online'],
  patterns: ['simultaneous'],
  hiddenInformation: true,
  privateViews: true,
  ruleVersion: 1,
  howToPlay: [
    'Jeder Stein der Rechenmauer ist die Summe (im Einmaleins-Modus das Produkt) der beiden Steine direkt darunter.',
    'Einige Steine sind bereits vorgegeben. Suche immer ein Dreieck aus drei Steinen, in dem schon zwei Zahlen stehen, und berechne den dritten Stein!',
    'Tippe einen leeren Stein an und gib das Ergebnis über das Zahlenfeld oder die Auswahl-Chips ein.',
    'Jeder richtig berechnete Stein bringt 2 Punkte; ist die ganze Mauer fehlerfrei, gibt es 4 Bonuspunkte dazu.',
  ],
};
