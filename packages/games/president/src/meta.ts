import type { GameInfo } from '@brett-und-blatt/engine';

/**
 * Steckbrief des Spiels. Die Plattform liest ihn für das Menü, ohne das ganze
 * Spiel zu laden – deshalb steht er in einer eigenen, kleinen Datei.
 */
export const meta: GameInfo = {
  id: 'president',
  // Bekannt als „Arschloch“; „Präsident“ ist der verbreitete neutrale Name.
  name: 'Präsident',
  description: 'Wer zuerst alle Karten los ist, wird Präsident – wer übrig bleibt, wird Bettler und muss in der nächsten Runde seine besten Karten abgeben.',
  emoji: '👑',
  players: { min: 3, max: 8 },
  modes: ['solo', 'hotseat', 'online'],
  patterns: ['hidden'],
  hiddenInformation: true,
  ruleVersion: 1,
  howToPlay: [
    'Alle Karten werden verteilt. Ziel: so schnell wie möglich alle Karten loswerden.',
    'Wer beginnt, legt eine Karte oder mehrere Karten gleichen Rangs (Paar, Drilling, Vierling). Die Farbe ist egal.',
    'Reihum legt jeder gleich viele Karten mit höherem Rang – oder passt. Das Ass ist die höchste Karte.',
    'Passen alle anderen, ist der Stich vorbei: Wer zuletzt gelegt hat, beginnt neu und darf frei legen.',
    'Wer zuerst keine Karten mehr hat, wird Präsident, dann folgen Vizepräsident und Bürger. Wer übrig bleibt, ist der Bettler.',
    'Ab der zweiten Runde gibt der Bettler dem Präsidenten seine zwei besten Karten und bekommt zwei beliebige zurück (Vize-Bettler und Vize tauschen eine). Der Bettler fängt an.',
    'Punkte je Runde: Präsident +2, Vize +1, Bürger 0, Vize-Bettler −1, Bettler −2.',
  ],
};
