import type { GameInfo } from '@brett-und-blatt/engine';

export const meta: GameInfo = {
  id: 'category-sprint',
  name: 'Kategorien-Sprint',
  description: 'Ein Buchstabe, fünf Kategorien: Stadt, Land, Fluss für die ganze Klasse – mit Abstimmung über Zweifelsfälle.',
  emoji: '✍️',
  players: { min: 1, max: 30 },
  modes: ['solo', 'hotseat', 'online'],
  patterns: ['simultaneous'],
  hiddenInformation: true,
  privateViews: true,
  ruleVersion: 1,
  howToPlay: [
    'Jede Runde gibt einen Anfangsbuchstaben vor. Findet zu jeder Kategorie ein Wort mit diesem Buchstaben – alle schreiben gleichzeitig.',
    'Wer alle Felder gefüllt hat, kann „Stopp!“ rufen: Dann endet die Runde für alle (je nach Einstellung gibt auch jeder einzeln ab).',
    'Danach liegen alle Antworten offen. Steht ein Wort nicht in der Liste, stimmen die anderen ab, ob es gilt.',
    'Punkte: 20, wenn nur du in der Kategorie etwas Gültiges hast, 10 für ein eigenes Wort, 5, wenn jemand dasselbe Wort hat.',
  ],
};
