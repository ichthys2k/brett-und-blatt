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
  if (!voice) {
    // Auch ohne Ansage die Warteschlange die Dauer des Tierlautes abwarten lassen.
    if (laut > 0) await new Promise((resolve) => window.setTimeout(resolve, laut * 1000));
    return;
  }
  // Zuerst den Tierlaut zu Ende spielen lassen, dann erst die Ansage.
  const waitMs = (laut > 0 ? laut : 0) * 1000 + GAP_S * 1000;
  await new Promise((resolve) => window.setTimeout(resolve, waitMs));
  const stimme = await sound.playFile(`avatare/${slug}-stimme.mp3`, { volume: 1 });
  // Die Warteschlange wartet die ganze Sequenz ab, damit beim nächsten Beitritt
  // nichts überlappt.
  if (stimme > 0) await new Promise((resolve) => window.setTimeout(resolve, stimme * 1000));
}
