import type { GameInfo } from '@brett-und-blatt/engine';

/**
 * Steckbrief des Spiels. Die Plattform liest ihn für das Menü, ohne das ganze
 * Spiel zu laden – deshalb steht er in einer eigenen, kleinen Datei.
 */
export const meta: GameInfo = {
  id: 'marketplace',
  name: 'Marktplatz',
  description: 'Würfeln, Handwerksbetriebe kaufen, Zunfthäuser bauen und handeln: Wer nach ein paar Jahren in Brezelbach das größte Vermögen hat, wird Ratsherr oder Ratsfrau.',
  emoji: '🥨',
  players: { min: 2, max: 6 },
  modes: ['solo', 'hotseat', 'online'],
  patterns: ['open'],
  hiddenInformation: true,
  // Verdeckt sind die Stapel für alle gleich; der Freibrief lohnt keinen Übergabe-Bildschirm vor jedem Zug.
  privateViews: false,
  hints: true,
  ruleVersion: 1,
  howToPlay: [
    'Würfle und ziehe deinen Karren um den Marktplatz. Am Stadttor gibt es Marktgeld, nach einem Pasch würfelst du noch einmal.',
    'Einen freien Betrieb darfst du kaufen. Tust du es nicht, wird er versteigert.',
    'Auf einem fremden Betrieb zahlst du dem Besitzer die Ware.',
    'Mit allen drei Betrieben einer Zunft bekommst du doppelte Ware und darfst Werkstatt und Zunfthaus bauen.',
    'Teilt ihr euch zu zweit eine Zunft, kann die Familie mit zwei Betrieben eine Partnerschaft anbieten: Dann gilt die Zunft für beide als ganz.',
    'Je Zug ist ein Handelsangebot erlaubt, am Jahrmarkt darf jeder eines machen. Gebaute Betriebe lassen sich nicht handeln.',
    'Je Jahreszeit gilt eine Hofnachricht für alle. Wer nicht zahlen kann, hilft aus: Niemand scheidet aus, der Rest wird Schuldschein.',
    'Nach der festen Zahl von Jahren zählt das Vermögen: Brezeln, Betriebe, Bauten und Boni für Zünfte. Das größte gewinnt.',
  ],
};
