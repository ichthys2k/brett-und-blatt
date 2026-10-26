import { SoundPlayer } from '@brett-und-blatt/ui';

export type CreatureEventType = 'play' | 'attack' | 'death' | 'easterEgg';

interface CreatureProfile {
  folder: string;
  article: string;
  creatureName: string;
}

const CREATURE_PROFILES: Record<string, CreatureProfile> = {
  Schmetterling: { article: 'Der', folder: 'schmetterling', creatureName: 'Schmetterling' },
  Schildkröte: { article: 'Die', folder: 'schildkröte', creatureName: 'Schildkröte' },
  Faultier: { article: 'Das', folder: 'faultier', creatureName: 'Faultier' },
  Frosch: { article: 'Der', folder: 'frosch', creatureName: 'Frosch' },
  Hase: { article: 'Der', folder: 'hase', creatureName: 'Hase' },
  Igel: { article: 'Der', folder: 'igel', creatureName: 'Igel' },
  Stinktier: { article: 'Das', folder: 'stinktier', creatureName: 'Stinktier' },
  Krabbe: { article: 'Die', folder: 'krabbe', creatureName: 'Krabbe' },
  Drache: { article: 'Der', folder: 'drache', creatureName: 'Drache' },
  Ameise: { article: 'Die', folder: 'ameise', creatureName: 'Ameise' },
  'Ameisen-Soldat': { article: 'Die', folder: 'ameise', creatureName: 'Ameise' },
  Fuchs: { article: 'Der', folder: 'fuchs', creatureName: 'Fuchs' },
  Grille: { article: 'Die', folder: 'grille', creatureName: 'Grille' },
  Ochse: { article: 'Der', folder: 'ochse', creatureName: 'Ochse' },
  Raupe: { article: 'Die', folder: 'raupe', creatureName: 'Raupe' },
  'Alpha-Wolf': { article: '', folder: 'alpha-wolf', creatureName: 'Alpha-Wolf' },
  Mutterspinne: { article: 'Die', folder: 'mutterspinne', creatureName: 'Mutterspinne' },
};

const RANGES: Record<CreatureEventType, [number, number]> = {
  attack: [2, 6],
  death: [7, 11],
  play: [12, 16],
  easterEgg: [17, 21],
};

function getBaseUrl(): string {
  try {
    return import.meta.env?.BASE_URL ?? '/';
  } catch {
    return '/';
  }
}

const player = new SoundPlayer(`${getBaseUrl().replace(/\/$/, '')}/klaenge/`);

const FALLBACK_ANIMAL_SOUNDS: Record<string, string> = {
  Affe: 'monkey_chatter.mp3',
  Hahn: 'chicken_cluck.mp3',
  Schaf: 'sheep_baa.mp3',
  Pferd: 'horse_whinny.mp3',
  Elefant: 'elephant_trumpet.mp3',
};

export function getCreatureAudioPath(
  name: string,
  eventType: CreatureEventType,
  fallbackSound?: string | null,
): string | null {
  const profile = CREATURE_PROFILES[name];

  if (profile) {
    const [min, max] = RANGES[eventType];
    const randNum = Math.floor(Math.random() * (max - min + 1)) + min;
    const numStr = String(randNum).padStart(2, '0');
    const filename = profile.article
      ? `${numStr}_${profile.article} ${profile.creatureName}.mp3`
      : `${numStr}_${profile.creatureName}.mp3`;
    return `tiere/${profile.folder}/${filename}`;
  }

  if (fallbackSound) {
    return fallbackSound.startsWith('tiere/') ? fallbackSound : `tiere/${fallbackSound}`;
  }

  const fallback = FALLBACK_ANIMAL_SOUNDS[name];
  if (fallback) {
    return fallback;
  }

  return null;
}

export function getCreatureAudioUrl(
  name: string,
  eventType: CreatureEventType,
  fallbackSound?: string | null,
): string | null {
  const base = getBaseUrl().replace(/\/$/, '');
  const path = getCreatureAudioPath(name, eventType, fallbackSound);
  if (!path) return null;
  return `${base}/klaenge/${encodeURI(path)}`;
}

/**
 * Spielt die Sprachaufnahme bzw. den Sound für ein Tier ab.
 */
export function playCreatureAudio(
  name: string,
  eventType: CreatureEventType,
  fallbackSound?: string | null,
): void {
  const path = getCreatureAudioPath(name, eventType, fallbackSound);
  if (!path) return;

  try {
    player.playFile(path, { volume: 0.85 });
  } catch {
    // Fallback falls Web Audio fehlschlägt
    const url = getCreatureAudioUrl(name, eventType, fallbackSound);
    if (!url) return;
    try {
      const audio = new Audio(url);
      audio.volume = 0.6;
      void audio.play().catch(() => {});
    } catch {
      // Still bleiben
    }
  }
}
