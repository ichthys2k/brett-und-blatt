import { AVATAR_SOUNDS, type Avatar } from '@brett-und-blatt/online';
import { sound } from './sound';

/** Pause zwischen Tierlaut und gesprochener Ansage in Sekunden. */
const GAP_S = 0.25;

/**
 * Beitritte kurz hintereinander sollen sich nicht überlagern: Jede Ansage wartet,
 * bis die vorige fertig ist. Bei Stummschaltung läuft die Warteschlange sofort durch.
 */
let queue: Promise<void> = Promise.resolve();

/** Kündigt einen Avatar an: erst der Tierlaut, dann „Ein Fuchs!“. */
export function announceAvatar(avatar: string): void {
  const spec = AVATAR_SOUNDS[avatar as Avatar];
  if (!spec) return;
  queue = queue.then(() => play(spec.slug, spec.voice !== false)).catch(() => {});
}

async function play(slug: string, voice: boolean): Promise<void> {
  const laut = await sound.playFile(`avatare/${slug}-laut.mp3`, { volume: 0.9 });
  if (!voice) return;
  // Fehlt der Tierlaut, kommt die Ansage sofort.
  const delay = laut > 0 ? GAP_S : 0;
  const stimme = await sound.playFile(`avatare/${slug}-stimme.mp3`, { delay, volume: 1 });
  // Warten, bis die Ansage durch ist, damit die nächste nicht hineinredet.
  if (stimme > 0) await new Promise((resolve) => window.setTimeout(resolve, (delay + stimme) * 1000));
}
