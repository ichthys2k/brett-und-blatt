import type { GameInfo } from '@brett-und-blatt/engine';

export const meta: GameInfo = {
  id: 'mill',
  name: 'Mühle',
  description: 'Steine setzen, ziehen, Mühlen bauen – und dem Gegner Steine wegnehmen.',
  emoji: '⚪',
  players: { min: 2, max: 2 },
  modes: ['solo', 'hotseat', 'online'],
  patterns: ['open'],
  hiddenInformation: false,
  ruleVersion: 1,
  howToPlay: [
    'Zuerst setzt ihr abwechselnd eure neun Steine auf freie Punkte, danach zieht ihr sie entlang der Linien auf einen freien Nachbarpunkt.',
    'Drei eigene Steine in einer Linie sind eine Mühle. Dann nimmst du einen gegnerischen Stein weg – aber keinen aus einer Mühle, außer es geht nicht anders.',
    'Wer nur noch drei Steine hat, darf springen: auf jeden freien Punkt.',
    'Wer weniger als drei Steine hat oder nicht mehr ziehen kann, verliert.',
  ],
};
