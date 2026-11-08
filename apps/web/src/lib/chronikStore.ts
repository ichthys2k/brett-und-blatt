import { limit, pin, pinnedList, sanitizeChronik, sanitizeReplay, stashReplay, unpin, type Ablage, type Chronik, type PinResult, type Replay } from './chronik';
import { sanitizeBook, type Book, type PlayedGame } from './partiebuch';
import { passSyncSoon } from './playerPass';

/** Speicher der Chronik im Browser: Block `chronik` und die Ablage der letzten Zuglisten (beides je Pass, `SCOPED_KEYS`). */
export const CHRONIK_KEY = 'brett-und-blatt:chronik';
export const ABLAGE_KEY = 'brett-und-blatt:chronik-ablage';

function readJson(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Speicher voll oder gesperrt
  }
}

export const loadChronik = (): Chronik => sanitizeChronik(readJson(CHRONIK_KEY));
export const saveChronik = (chronik: Chronik): void => writeJson(CHRONIK_KEY, limit(chronik));

export function loadAblage(): Ablage {
  const raw = readJson(ABLAGE_KEY);
  const out: Ablage = {};
  if (raw && typeof raw === 'object') {
    for (const [id, entry] of Object.entries(raw as Record<string, { at?: unknown; replay?: unknown }>)) {
      const replay = sanitizeReplay(entry.replay);
      if (replay && typeof entry.at === 'number') out[id] = { at: entry.at, replay };
    }
  }
  return out;
}

/** Wird beim Partieende gerufen: merkt die Zugliste, damit man die Partie später anheften kann. */
export function rememberReplay(id: string, replay: Replay): void {
  writeJson(ABLAGE_KEY, stashReplay(loadAblage(), id, replay, Date.now()));
}

export function pinGame(game: PlayedGame): PinResult {
  const result = pin(loadChronik(), game, loadAblage()[game.id]?.replay ?? null, Date.now());
  if (result.ok) {
    saveChronik(result.chronik);
    passSyncSoon();
  }
  return result;
}

export function unpinGame(id: string): void {
  saveChronik(unpin(loadChronik(), id, Date.now()));
  passSyncSoon();
}

export const pinnedGames = (): PlayedGame[] => pinnedList(loadChronik()).flatMap((item) => (item.game ? [item.game] : []));

export const hasReplay = (id: string): boolean => Boolean(loadChronik()[id]?.replay) || Boolean(loadAblage()[id]);

/** Das Buch (Kopfzeilen) für die Anzeige. */
export function loadBookRecent(): Book['recent'] {
  return sanitizeBook(readJson('brett-und-blatt:partiebuch')).recent;
}
