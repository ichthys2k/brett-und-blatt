import type { GameInfo } from '@brett-und-blatt/engine';

export const meta: GameInfo = {
  id: 'bible-quiz',
  name: 'Bibel-Quiz',
  description: 'Errate biblische Geschichten, Personen, Gleichnisse und Verse anhand von Emojis – allein oder gemeinsam im Mehrspieler.',
  emoji: '✝️',
  players: { min: 1, max: 30 },
  modes: ['solo', 'hotseat', 'online'],
  patterns: ['simultaneous'],
  hiddenInformation: true,
  privateViews: true,
  ruleVersion: 1,
  howToPlay: [
    'In jeder Runde wird eine biblische Begebenheit oder ein Vers durch Emojis dargestellt.',
    'Wähle aus den vier Antwortmöglichkeiten die passende Geschichte aus.',
    'Je nach Schwierigkeit gibt es 10, 20 oder 30 Punkte; ab 3 richtigen Antworten in Folge winken Bonuspunkte.',
    'Nach der Eingabe erfährst du die Auflösung mit Erklärung und direktem Link zum Nachlesen in der Bibel.',
  ],
};
