import type { SessionSnapshot } from '@brett-und-blatt/engine';

/*
 * Speicher im Browser. Er ist nur eine Bequemlichkeit (Partie fortsetzen,
 * letzte Einstellungen) und darf jederzeit leer sein oder fehlen – etwa im
 * privaten Fenster. Darum ist jeder Zugriff abgesichert.
 */
const ACTIVE_KEY = 'brett-und-blatt:laufende-partie';
const setupKey = (gameId: string) => `brett-und-blatt:einstellungen:${gameId}`;
const PROFILE_KEY = 'brett-und-blatt:profil';
const TOURNAMENTS_KEY = 'brett-und-blatt:turniere';

export interface KnownTournament {
  code: string;
  name: string;
}
const DEVICE_KEY = 'brett-und-blatt:geraet';
const PLAYER_CODE_KEY = 'brett-und-blatt:spielercode';
const PASS_KEY_KEY = 'brett-und-blatt:passschluessel';

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
  /** Turniere, die dieses Gerät kennt – nur eine Merkliste für die Seite „Online spielen“. */
  loadTournaments: (): KnownTournament[] => {
    const list = read<KnownTournament[]>(TOURNAMENTS_KEY);
    return Array.isArray(list) ? list : [];
  },
  rememberTournament: (entry: KnownTournament) => {
    const others = storage.loadTournaments().filter((item) => item.code !== entry.code);
    write(TOURNAMENTS_KEY, [entry, ...others].slice(0, 20));
  },
  forgetTournament: (code: string) => write(TOURNAMENTS_KEY, storage.loadTournaments().filter((item) => item.code !== code)),
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
    remove(PASS_KEY_KEY);
    remove(TOURNAMENTS_KEY);
  },
  loadPlayerCode: () => {
    const code = read<string>(PLAYER_CODE_KEY);
    return typeof code === 'string' ? code : null;
  },
  /** Passschlüssel des Spielerpasses (#137), nur auf diesem Gerät und hinter dem Ausweis. */
  loadPassKey: () => {
    const key = read<string>(PASS_KEY_KEY);
    return typeof key === 'string' ? key : null;
  },
  savePassKey: (key: string | null) => (key ? write(PASS_KEY_KEY, key) : remove(PASS_KEY_KEY)),
  savePlayerCode: (code: string | null) => (code ? write(PLAYER_CODE_KEY, code) : remove(PLAYER_CODE_KEY)),
};
