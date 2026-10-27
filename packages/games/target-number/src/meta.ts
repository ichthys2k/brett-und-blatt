import type { GameInfo } from '@brett-und-blatt/engine';

export const meta: GameInfo = {
  id: 'target-number',
  name: 'Zielzahl',
  description: 'Aus vier bis sechs Zahlenkarten mit +, −, · und : die Zielzahl (z. B. 24) kombinieren – allein, zu zweit oder mit der ganzen Klasse.',
  emoji: '🎯',
  players: { min: 1, max: 30 },
  modes: ['solo', 'hotseat', 'online'],
  patterns: ['simultaneous'],
  hiddenInformation: true,
  privateViews: true,
  ruleVersion: 1,
  howToPlay: [
    'In jeder Runde liegen Zahlenkarten offen auf dem Tisch, dazu eine Zielzahl (im Klassik-Modus immer 24).',
    'Tippe nacheinander eine Zahlenkarte, ein Rechenzeichen (+, −, ·, :) und eine zweite Zahlenkarte an, um sie zu verrechnen.',
    'Divisionen müssen glatt aufgehen, Subtraktionen dürfen nicht negativ werden. Darüber wächst automatisch dein geklammerter Rechenterm.',
    'Triffst du die Zielzahl genau, gibt es 10 Punkte (mit allen Karten sogar 12 Punkte). Auch wer nah dran ist, sammelt Punkte!',
    'Sobald alle ihr Ergebnis eingeloggt haben, wird die Musterlösung aufgedeckt und die nächste Runde beginnt.',
  ],
};
