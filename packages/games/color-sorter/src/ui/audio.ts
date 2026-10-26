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

const HAND_SOUNDS: Record<HandType, SoundName> = {
  high: 'fs-hand-einzelwert',
  pair: 'fs-hand-duo',
  twoPair: 'fs-hand-doppelduo',
  three: 'fs-hand-triple',
  straight: 'fs-hand-zahlenlauf',
  flush: 'fs-hand-farbensatz',
  fullHouse: 'fs-hand-kombisatz',
  four: 'fs-hand-quartett',
  straightFlush: 'fs-hand-farbenstrasse',
  flushHouse: 'fs-hand-farbenlauf-deluxe',
  five: 'fs-hand-quintett',
  flushFive: 'fs-hand-quintett',
};

export function playEffect(name: SoundName, { volume = 1, delay = 0 }: { volume?: number; delay?: number } = {}): void {
  try {
    player.play(name, { volume, delay });
  } catch {
    // Falls Web Audio blockiert ist oder Datei fehlt
  }
}

export function playHandAnnouncement(handType: HandType): void {
  const soundName = HAND_SOUNDS[handType];
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
