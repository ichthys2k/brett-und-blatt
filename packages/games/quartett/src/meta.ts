import type { GameInfo } from '@brett-und-blatt/engine';

export const meta: GameInfo = {
  id: 'quartett',
  name: 'Quartett',
  description: 'Werte vergleichen und Stapel gewinnen – oder Mitspieler nach Karten fragen und Vierergruppen sammeln.',
  emoji: '🃏',
  players: { min: 2, max: 6 },
  modes: ['solo', 'hotseat', 'online'],
  patterns: ['hidden'],
  hiddenInformation: true,
  ruleVersion: 1,
  howToPlay: [
    'Trumpf: Du siehst nur deine oberste Karte. Bist du dran, wählst du eine Eigenschaft, z. B. das Gewicht. Alle decken auf, der beste Wert gewinnt alle aufgedeckten Karten.',
    'Bei manchen Eigenschaften gewinnt der kleinere Wert – das steht auf der Karte. Bei Gleichstand kommen die Karten in die Mitte, und du wählst noch einmal.',
    'Wer gewinnt, ist wieder dran. Wer keine Karten mehr hat, scheidet aus. Nach dem Rundenlimit gewinnt, wer die meisten Karten hat.',
    'Sammeln: Frag einen Mitspieler nach einer Karte, die dir zu einer Gruppe fehlt (z. B. C3). Du musst selbst eine Karte dieser Gruppe haben.',
    'Hat er sie, gibt er sie dir und du fragst weiter, sonst ist er dran. Vier Karten einer Gruppe sind ein Quartett. Wer am Ende die meisten hat, gewinnt.',
  ],
};
