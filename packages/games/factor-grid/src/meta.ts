import type { GameInfo } from '@brett-und-blatt/engine';

export const meta: GameInfo = {
  id: 'factor-grid',
  name: 'Teiler-Duell',
  description: 'Zahlen auf dem Gitter wählen und dabei Teiler, Vielfache und Primzahlen geschickt ausnutzen – als „Steuereintreiber“ oder „Teiler & Vielfache“.',
  emoji: '🧮',
  players: { min: 1, max: 2 },
  modes: ['solo', 'hotseat', 'online'],
  patterns: ['open'],
  hiddenInformation: false,
  privateViews: false,
  ruleVersion: 1,
  howToPlay: [
    'Auf dem Brett liegen die Zahlen von 1 bis 20, 30 oder 50.',
    'Variante „Steuereintreiber“: Wähle eine freie Zahl, die noch mindestens einen freien echten Teiler hat. Du erhältst die Zahl als Punkte – dein Gegenüber (oder allein der Steuereintreiber) kassiert automatisch alle freien Teiler!',
    'Allein gegen den Steuereintreiber gilt außerdem: Sobald keine Zahl mehr freie Teiler hat, bekommt der Steuereintreiber den gesamten Rest. Nimm große Primzahl-Vielfache also frühzeitig mit!',
    'Variante „Teiler & Vielfache“: Wählt abwechselnd eine freie Zahl, die ein Teiler oder ein Vielfaches der zuletzt gezogenen Zahl ist (der erste Zug muss gerade sein). Wer nicht mehr ziehen kann, verliert!',
  ],
};
