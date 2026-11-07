import type { SoundName } from '@brett-und-blatt/ui';
import { SoundPlayer } from '@brett-und-blatt/ui';
import type { HandType } from '../types';

function getBaseUrl(): string {
  try {
    return import.meta.env?.BASE_URL ?? '/';
  } catch {
    return '/';
  }
}

const player = new SoundPlayer(`${getBaseUrl().replace(/\/$/, '')}/klaenge/`);

/** Kombi-Ansagen mit den Narrenhof-Namen. Farb-Fünfling hat noch keine eigene Aufnahme. */
const HAND_SOUNDS: Record<HandType, SoundName> = {
  high: 'fs-hand-hohe-karte',
  pair: 'fs-hand-paar',
  twoPair: 'fs-hand-zwei-paare',
  three: 'fs-hand-drilling',
  straight: 'fs-hand-strasse',
  flush: 'fs-hand-farbe',
  fullHouse: 'fs-hand-full-house',
  four: 'fs-hand-vierling',
  straightFlush: 'fs-hand-farbstrasse',
  five: 'fs-hand-fuenfling',
  flushHouse: 'fs-hand-full-house-in-farbe',
  flushFive: 'fs-hand-fuenfling',
};

export function playEffect(name: SoundName, { volume = 1, delay = 0 }: { volume?: number; delay?: number } = {}): void {
  try {
    player.play(name, { volume, delay });
  } catch {
    // Falls Web Audio blockiert ist oder Datei fehlt
  }
}

/** `label` wie aus `handLabel`: die Farbstraße 10 bis Ass heißt „Königsstraße“. */
export function playHandAnnouncement(handType: HandType, label?: string): void {
  const soundName = label === 'Königsstraße' ? 'fs-hand-koenigsstrasse' : HAND_SOUNDS[handType];
  if (soundName) {
    playEffect(soundName, { volume: 1.1 });
  }
}

const BOSS_SOUND_PATHS: Record<string, string> = {
  rat: 'tiere/ratte.mp3',
  spider: 'tiere/spider.mp3',
  wolf: 'tiere/alpha-wolf/12_Alpha-Wolf.mp3',
  boar: 'tiere/schwein.mp3',
  snake: 'tiere/schlange.mp3',
  frog: 'tiere/frosch.mp3',
  shark: 'tiere/fisch.mp3',
  eagle: 'tiere/eule.mp3',
  lizard: 'tiere/Eidechse.mp3',
  owl: 'tiere/eule.mp3',
  dragon: 'tiere/drache/12_Der Drache.mp3',
  seaSerpent: 'tiere/schlange.mp3',
  tomcat: 'tiere/katze.mp3',
  sloth: 'tiere/faultier/12_Das Faultier.mp3',
};

export function playBossSound(bossKey: string): void {
  const path = BOSS_SOUND_PATHS[bossKey];
  if (!path) return;
  try {
    player.playFile(path, { volume: 0.8 });
  } catch {
    // Stumm bleiben falls nicht verfügbar
  }
}
