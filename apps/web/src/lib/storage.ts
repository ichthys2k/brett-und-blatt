import type { SessionSnapshot } from '@brett-und-blatt/engine';

/*
 * Speicher im Browser. Er ist nur eine Bequemlichkeit (Partie fortsetzen,
 * letzte Einstellungen) und darf jederzeit leer sein oder fehlen – etwa im
 * privaten Fenster. Darum ist jeder Zugriff abgesichert.
 */
const ACTIVE_KEY = 'brett-und-blatt:laufende-partie';
const setupKey = (gameId: string) => `brett-und-blatt:einstellungen:${gameId}`;
const PROFILE_KEY = 'brett-und-blatt:profil';
const DEVICE_KEY = 'brett-und-blatt:geraet';
const PLAYER_CODE_KEY = 'brett-und-blatt:spielercode';

export interface Profile {
  name: string;
  avatar: string;
}

/** Ersatz, falls der Speicher gesperrt ist: gilt dann nur, bis die Seite neu lädt. */
let fallbackDevice: string | null = null;

function read<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Speicher voll oder gesperrt – dann eben ohne.
  }
}

function remove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignorieren
  }
}

export const storage = {
  loadActive: () => {
    const snapshot = read<SessionSnapshot>(ACTIVE_KEY);
    return snapshot?.version === 1 ? snapshot : null;
  },
  saveActive: (snapshot: SessionSnapshot) => write(ACTIVE_KEY, snapshot),
  clearActive: () => remove(ACTIVE_KEY),
  loadSetup: <T>(gameId: string) => read<T>(setupKey(gameId)),
  saveSetup: (gameId: string, setup: unknown) => write(setupKey(gameId), setup),
  loadProfile: () => {
    const profile = read<Profile>(PROFILE_KEY);
    return profile && typeof profile.name === 'string' && typeof profile.avatar === 'string' ? profile : null;
  },
  saveProfile: (profile: Profile) => write(PROFILE_KEY, profile),
  /**
   * Geheime, zufällige Kennung dieses Geräts. Mit ihr erkennt ein Online-Raum,
   * wer zurückkommt – sie verlässt das Gerät nur in Richtung Spieleserver.
   */
  deviceToken: (): string => {
    const saved = read<string>(DEVICE_KEY);
    if (typeof saved === 'string' && saved.length >= 32) return saved;
    const token = fallbackDevice ?? Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
    fallbackDevice = token;
    write(DEVICE_KEY, token);
    return token;
  },
  /** Übernimmt die Kennung eines Spielerausweises von einem anderen Gerät. */
  setDeviceToken: (token: string) => {
    fallbackDevice = token;
    write(DEVICE_KEY, token);
  },
  /** Abmelden auf einem geteilten Gerät: Kennung, Spitzname und Spielercode vergessen. */
  forgetPlayer: () => {
    fallbackDevice = null;
    remove(DEVICE_KEY);
    remove(PROFILE_KEY);
    remove(PLAYER_CODE_KEY);
  },
  loadPlayerCode: () => {
    const code = read<string>(PLAYER_CODE_KEY);
    return typeof code === 'string' ? code : null;
  },
  savePlayerCode: (code: string | null) => (code ? write(PLAYER_CODE_KEY, code) : remove(PLAYER_CODE_KEY)),
};
