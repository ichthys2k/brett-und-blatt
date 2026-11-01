import type { GameInfo } from '@brett-und-blatt/engine';

export const meta: GameInfo = {
  id: 'drachenspiel',
  name: 'Drachenspiel',
  description: 'Sammelkarten-Duell mit Tierkarten, Mana und 30 Leben – allein gegen Bots oder online.',
  emoji: '🐲',
  players: { min: 2, max: 2 },
  modes: ['solo', 'hotseat', 'online'],
  patterns: ['hidden', 'simultaneous'],
  hiddenInformation: true,
  privateViews: true,
  ruleVersion: 5,
  // Karten ziehen und Zufall zeigen Neues: Ein Zurücknehmen ließe sich ausnutzen.
  noUndo: true,
  hints: true,
  howToPlay: [
    'Beide Helden starten mit 30 Leben. Wer zuerst auf 0 Lebenspunkte sinkt, verliert das Duell.',
    'Zu Beginn jeder Runde wächst dein Mana um 1 (bis zu 10 Kristalle) und füllt sich komplett auf.',
    'Spiele Tiere aus deiner Hand aus. Neu gelegte Tiere müssen eine Runde warten, bevor sie angreifen dürfen (außer Tiere mit ⚡ Flink).',
    'Greife gegnerische Tiere oder direkt den gegnerischen Helden an. Hat der Gegner Tiere mit 🛡️ Beschützer, musst du sie zuerst angreifen.',
    'Wer als Zweiter beginnt, erhält eine Handkarte mehr, die ⭐ Sternschnuppe für +1 Bonus-Mana und 5 Rüstung.',
    'Zauberkarten (Option, Standard an): einmalige Naturzauber wie ⚡ Blitzschlag (3 Schaden), 🍯 Honigtopf (+2/+2), 🌊 Flutwelle (Tier zurück auf die Hand) oder 🍀 Glücksklee (2 Karten). Zauber mit Ziel erst antippen, dann das Ziel wählen – oder die Karte aufs Ziel ziehen.',
    'Karte groß ansehen: lange drücken, rechts klicken oder mit der Taste i. Unter „Verlauf“ steht, was zuletzt geschah.',
    'Hauskraft: Einmal je Zug kannst du für 2 Mana die Kraft deines Hauses nutzen (Knopf neben „Zug beenden“). Lange drücken zeigt, was sie tut.',
    'Rüstung 🛡️ fängt Schaden ab, bevor er deine Leben trifft. Hat dein Held Angriff (⚔️), tippe ihn an und wähle ein Ziel, einmal je Zug. Greift er ein Tier an, schlägt es zurück.',
    'Ist dein Deck leer, erleidet dein Held jede Runde zunehmenden Müdigkeits-Schaden. Auf die Hand passen 10 Karten, was darüber hinaus gezogen wird, verbrennt.',
  ],
};
