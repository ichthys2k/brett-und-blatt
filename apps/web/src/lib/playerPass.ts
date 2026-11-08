import {
  connectSync,
  createPlayerLock,
  disconnectSync,
  parsePassKey,
  randomPassKey,
  syncNow,
  syncPassBlocks,
  currentSyncCode,
  openPlayerLock,
  parsePlayerCode,
  PLAYER_SALT,
  playerBlock,
  revokePlayerLock,
  SyncError,
  updatePlayerLock,
  type PlayerPass,
} from '@brett-und-blatt/ui/sync';
import { GAME_SERVER } from './online';
import { storage, type Profile } from './storage';

/** Spielerausweis dieses Geräts (W-052); die Logik liegt in `@brett-und-blatt/ui/sync`. */
export const passServer = () => GAME_SERVER || null;

function readPass(): PlayerPass {
  const profile = storage.loadProfile();
  const passKey = parsePassKey(storage.loadPassKey());
  return { token: storage.deviceToken(), name: profile?.name ?? '', avatar: profile?.avatar ?? '', code: storage.loadPlayerCode(), tournaments: storage.loadTournaments(), ...(passKey ? { passKey } : {}) };
}

function writePass(pass: PlayerPass): void {
  storage.setDeviceToken(pass.token);
  storage.savePlayerCode(pass.code);
  if (pass.passKey) storage.savePassKey(pass.passKey);
  // Was nur dieses Gerät kennt, bleibt; hinzu kommt, was der Ausweis mitbringt.
  const known = storage.loadTournaments();
  for (const item of [...(pass.tournaments ?? [])].reverse()) if (!known.some((k) => k.code === item.code)) storage.rememberTournament(item);
  if (pass.name && pass.avatar) storage.saveProfile({ name: pass.name, avatar: pass.avatar });
}

export const passBlock = playerBlock(PLAYER_SALT, passServer, { read: readPass, write: writePass });

/**
 * Vorhandene Ausweise bekommen beim ersten Mal einen Passschlüssel (#137). Ohne Spielercode und ohne
 * Sicherungscode gibt es keinen Ausweis, der ihn tragen könnte – dann bleibt es beim Nichts.
 */
function ensurePassKey(): string | null {
  const existing = parsePassKey(storage.loadPassKey());
  if (existing) return existing;
  if (!storage.loadPlayerCode() && !currentSyncCode()) return null;
  const key = randomPassKey();
  storage.savePassKey(key);
  return key;
}

let passTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Abgleich in Kürze: erst der Ausweis (bringt womöglich den gemeinsamen Passschlüssel), dann alle Blöcke des Passes.
 * Mehrere Anlässe kurz hintereinander ergeben einen Abgleich; Fehler bleiben still, der nächste Anlass versucht es wieder.
 */
export function passSyncSoon(delayMs = 1500): void {
  if (typeof window === 'undefined' || !passServer()) return;
  if (passTimer) clearTimeout(passTimer);
  passTimer = setTimeout(() => {
    passTimer = null;
    void (async () => {
      await syncNow(passBlock);
      const key = ensurePassKey();
      if (!key) return;
      // Der Ausweis trägt den Schlüssel zu den anderen Geräten, ein neu erzeugter muss also dorthin.
      const pass = readPass();
      if (pass.code) await updatePlayerLock(passServer, pass.code, pass).catch(() => undefined);
      await syncNow(passBlock);
      await syncPassBlocks(storage.loadPassKey() ?? key, passServer);
    })().catch(() => undefined);
  }, delayMs);
}

/** Nach jeder Änderung: Schloss und Sicherung auf den neuen Stand bringen. Scheitert still, das nächste Mal klappt es. */
export function passChanged(): void {
  const pass = readPass();
  if (pass.code) void updatePlayerLock(passServer, pass.code, pass).catch(() => undefined);
  passSyncSoon();
}

/** Speichert das eigene Profil und bringt Schloss und Sicherung auf den neuen Stand (#136). Der einzige Weg, das eigene Profil zu ändern. */
export function saveOwnProfile(profile: Profile): void {
  storage.saveProfile(profile);
  passChanged();
}

export async function createPlayerCode(): Promise<void> {
  storage.savePlayerCode(await createPlayerLock(passServer, readPass()));
  passChanged();
}

/** Neuer Code statt des alten, etwa wenn er in falsche Hände geraten ist. */
export async function renewPlayerCode(): Promise<void> {
  const old = storage.loadPlayerCode();
  await createPlayerCode();
  if (old) await revokePlayerLock(passServer, old);
}

/** Übernimmt einen Ausweis über Spielercode oder Sicherungscode. false: Eingabe ist keins von beiden oder der Abgleich scheiterte. */
export async function adoptCode(input: string): Promise<boolean> {
  const code = parsePlayerCode(input);
  if (code) {
    writePass(await openPlayerLock(passServer, code));
    passSyncSoon();
    return true;
  }
  return connectSync(passBlock, input);
}

export function isPassError(error: unknown): error is SyncError {
  return error instanceof SyncError;
}

export function playerLink(code: string): string {
  return `${window.location.origin}${window.location.pathname}#/online?ausweis=${encodeURIComponent(code)}`;
}

/** Spielercode oder Sicherungscode aus der Adresse (QR-Code gescannt); entfernt ihn danach aus der Adresszeile. */
export function takeLinkedCode(): string | null {
  const hash = window.location.hash;
  const match = /[?&](?:ausweis|sicherung)=([^&]+)/.exec(hash);
  if (!match) return null;
  const cleaned = hash.replace(/([?&])(?:ausweis|sicherung)=[^&]*&?/, '$1').replace(/[?&]$/, '');
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${cleaned}`);
  return decodeURIComponent(match[1]!);
}

/** Abmelden auf einem geteilten Gerät. Das Gerät bekommt danach eine frische Kennung. */
export function leavePass(): void {
  disconnectSync();
  storage.forgetPlayer();
}

