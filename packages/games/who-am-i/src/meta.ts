import type { GameInfo } from '@brett-und-blatt/engine';

export const meta: GameInfo = {
  id: 'who-am-i',
  name: 'Wer bin ich?',
  description: 'Alle sehen deinen Begriff, nur du nicht: Finde mit Ja-Nein-Fragen heraus, welches Tier, welcher Beruf oder welche biblische Person du bist.',
  emoji: '🎭',
  players: { min: 3, max: 10 },
  modes: ['solo', 'hotseat', 'online'],
  patterns: ['hidden'],
  hiddenInformation: true,
  privateViews: true,
  ruleVersion: 1,
  howToPlay: [
    'Jeder bekommt einen geheimen Begriff, etwa ein Tier. Die anderen sehen ihn, du selbst nicht.',
    'Wer dran ist, stellt eine Ja-Nein-Frage über sich selbst. Bei „Ja“ darfst du weiterfragen (höchstens dreimal), sonst ist der Nächste dran.',
    'Statt zu fragen, kannst du raten. Richtig geraten bringt umso mehr Punkte, je früher es klappt.',
    'Mit Fragenkatalog antwortet das Spiel selbst, und Bots spielen mit. Im freien Modus fragst du laut, die anderen antworten mit Ja, Nein oder Vielleicht, und geraten wird per Eingabe.',
  ],
};
