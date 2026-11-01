import type { GameInfo } from '@brett-und-blatt/engine';

/**
 * Steckbrief des Spiels. Die Plattform liest ihn für das Menü, ohne das ganze
 * Spiel zu laden – deshalb steht er in einer eigenen, kleinen Datei.
 */
export const meta: GameInfo = {
  id: 'wolves-sheep',
  name: 'Wölfe im Schafspelz',
  description: 'Geheime Rollen in der Herde: Nachts versprengen die Wölfe ein Schaf, tags sucht der Herdenrat die Wölfe.',
  emoji: '🐺',
  players: { min: 8, max: 19 },
  modes: ['hotseat', 'online'],
  patterns: ['hidden', 'simultaneous'],
  hiddenInformation: true,
  privateViews: true,
  ruleVersion: 1,
  minHumans: 4,
  noUndo: true,
  howToPlay: [
    'Jeder bekommt geheim eine Rolle: Wolf, Prüfer oder Schaf. Die Wölfe kennen einander.',
    'Nachts wählen die Wölfe ein Schaf, das versprengt wird, und der Prüfer sieht die Rolle einer Person. Alle anderen tippen an, wer ihnen verdächtig ist, damit niemand auffällt.',
    'Tags beratet ihr und stimmt geheim ab. Wer die meisten Stimmen hat, verlässt die Herde. Bei Gleichstand bleibt alles, wie es ist.',
    'Wer ausscheidet, deckt seine Karte auf und schweigt ab jetzt.',
    'Weitere Rollen schaltet ihr beim Einrichten zu: Hirte, Hütehund, Bandstifter, Neugieriges Lamm, Zugelaufenes Schaf und Leithammel. Die Rollenkarte erklärt jeweils, was sie kann.',
    'Mit einem Erzähler (ab 9 Plätzen) leitet Platz 1, ohne mitzuspielen. Das passt gut zur Lehrkraft am Beamer: Die Tafel zeigt nur, was alle wissen dürfen.',
    'Verbundene gehen immer gemeinsam. Sind ein Wolf und ein Schaf verbunden, gewinnen sie nur, wenn alle anderen fort sind.',
    'Die Herde gewinnt, wenn alle Wölfe weg sind, die Wölfe, wenn das letzte Schaf weg ist.',
  ],
};
