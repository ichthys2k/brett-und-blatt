import type { GameInfo } from '@brett-und-blatt/engine';

export const meta: GameInfo = {
  id: 'kniffel',
  name: 'Kniffel',
  description: 'Fünf Würfel, drei Würfe pro Runde, die beste Kombination eintragen. Der Klassiker.',
  emoji: '🎲',
  players: { min: 1, max: 6 },
  modes: ['solo', 'hotseat', 'online'],
  patterns: ['open'],
  hiddenInformation: false,
  ruleVersion: 2,
  howToPlay: [
    'Pro Runde hast du bis zu drei Würfe. Du kannst nach jedem Wurf Würfel zum Beiseitelegen auswählen.',
    'Trage das Ergebnis nach dem letzten oder einem früheren Wurf in eine freie Kategorie der Wertungstafel ein.',
    'Obere Sektion: Einser bis Sechser. Erreichst du dort mindestens 63 Punkte, gibt es einen Bonus von 35 Punkten.',
    'Untere Sektion: Dreierpasch, Viererpasch, Full House (25), Kleine Straße (30), Große Straße (40), Kniffel (50) und Chance.',
    'Wer nach 13 Runden die höchste Gesamtpunktzahl hat, gewinnt.',
  ],
};
