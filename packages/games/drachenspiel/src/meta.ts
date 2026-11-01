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
  ruleVersion: 3,
  hints: true,
  howToPlay: [
    'Beide Helden starten mit 30 Leben. Wer zuerst auf 0 Lebenspunkte sinkt, verliert das Duell.',
    'Zu Beginn jeder Runde wächst dein Mana um 1 (bis zu 10 Kristalle) und füllt sich komplett auf.',
    'Spiele Tiere aus deiner Hand aus. Neu gelegte Tiere müssen eine Runde warten, bevor sie angreifen dürfen (außer Tiere mit ⚡ Flink).',
    'Greife gegnerische Tiere oder direkt den gegnerischen Helden an. Hat der Gegner Tiere mit 🛡️ Beschützer, musst du sie zuerst angreifen.',
    'Wer als Zweiter beginnt, erhält eine Handkarte mehr und die ⭐ Sternschnuppe für +1 Bonus-Mana.',
    'Zauberkarten (Option, Standard an): einmalige Naturzauber wie ⚡ Blitzschlag (3 Schaden), 🍯 Honigtopf (+2/+2), 🌊 Flutwelle (Tier zurück auf die Hand) oder 🍀 Glücksklee (2 Karten). Zauber mit Ziel erst antippen, dann das Ziel wählen – oder die Karte aufs Ziel ziehen.',
    'Ist dein Deck leer, erleidet dein Held jede Runde zunehmenden Müdigkeits-Schaden.',
  ],
};
