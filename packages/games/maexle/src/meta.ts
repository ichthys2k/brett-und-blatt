import type { GameInfo } from '@brett-und-blatt/engine';

export const meta: GameInfo = {
  id: 'maexle',
  name: 'Mäxle',
  description: 'Würfeln, heimlich schauen, höher ansagen – und bluffen. Wer zweifelt, hebt den Becher.',
  emoji: '🎲',
  players: { min: 2, max: 10 },
  modes: ['solo', 'hotseat', 'online'],
  patterns: ['hidden'],
  hiddenInformation: true,
  // Am selben Gerät reicht der Becher: Den Wurf sieht man nur, solange man ihn gedrückt hält.
  privateViews: false,
  ruleVersion: 1,
  howToPlay: [
    'Würfle verdeckt, schau heimlich unter den Becher und sag einen Wert an, der höher ist als die vorige Ansage. Lügen ist erlaubt.',
    'Der höhere Würfel zählt als Zehner: 4 und 2 ist 42. Pasche schlagen alle normalen Würfe, das Mäxle (2 und 1) schlägt alles.',
    'Wer den Becher bekommt, glaubt (und würfelt selbst neu) oder zweifelt an. Beim Anzweifeln wird aufgedeckt: Gelogen kostet den Ansager ein Leben, sonst den Zweifler.',
    'Ein angesagtes Mäxle glauben kostet sofort ein Leben; wer ein echtes Mäxle anzweifelt, verliert zwei.',
    'Wer keine Leben mehr hat, scheidet aus. Wer zuletzt übrig ist, gewinnt.',
  ],
};
