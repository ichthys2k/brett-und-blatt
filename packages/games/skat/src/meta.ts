import type { GameInfo } from '@brett-und-blatt/engine';

export const meta: GameInfo = {
  id: 'skat',
  name: 'Skat',
  description:
    'Der deutsche Kartenspiel-Klassiker nach der Internationalen Skatordnung (ISkO): Reizen, Skataufnahme, Farbspiele, Grand und Null mit Seeger-Fabian-Abrechnung.',
  emoji: '🃏',
  players: { min: 3, max: 4 },
  modes: ['solo', 'hotseat', 'online'],
  patterns: ['hidden'],
  hiddenInformation: true,
  ruleVersion: 2,
  howToPlay: [
    'Skat wird mit 32 Karten zu dritt gespielt (am Vierertisch setzt der Geber jeweils aus). Jeder erhält 10 Karten, 2 Karten liegen verdeckt im Skat.',
    'Reizen: Mittelhand sagt Vorhand Reizwerte an (18, 20, 22, 24...), Vorhand hört („Ja“) oder passt. Danach sagt Hinterhand dem Verbleibenden an. Wer das Reizen gewinnt, wird Alleinspieler.',
    'Skat & Ansage: Der Alleinspieler entscheidet, ob er den Skat aufnimmt und zwei Karten drückt oder verdeckt Hand spielt. Danach sagt er das Spiel an: Karo (9), Herz (10), Pik (11), Kreuz (12), Grand (24) oder Null (23).',
    'Trumpf & Bedienpflicht: In Farbspielen sind die vier Buben (Kreuz > Pik > Herz > Karo) plus die Trumpffarbe Trumpf. Im Grand nur die Buben, im Null kein Trumpf. Die angespielte Farbe muss stets bedient werden; Buben zählen als Trumpffarbe.',
    'Gewinn & Abrechnung: Der Alleinspieler benötigt mindestens 61 Augen (Null: keinen Stich). Erreicht sein Spielwert mindestens den Reizwert, gewinnt er den Spielwert + 50 Punkte; bei Verlust verliert er doppelt − 50 Punkte (Seeger-Fabian).',
  ],
};
