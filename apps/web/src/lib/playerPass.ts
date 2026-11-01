import {
  connectSync,
  createPlayerLock,
  disconnectSync,
  openPlayerLock,
  parsePlayerCode,
  PLAYER_SALT,
  playerBlock,
  revokePlayerLock,
  scheduleSync,
  SyncError,
  updatePlayerLock,
  type PlayerPass,
} from '@brett-und-blatt/ui/sync';
import { GAME_SERVER } from './online';
import { storage } from './storage';

/** Spielerausweis dieses Geräts (W-052); die Logik liegt in `@brett-und-blatt/ui/sync`. */
export const passServer = () => GAME_SERVER || null;

function readPass(): PlayerPass {
  const profile = storage.loadProfile();
  return { token: storage.deviceToken(), name: profile?.name ?? '', avatar: profile?.avatar ?? '', code: storage.loadPlayerCode() };
}

function writePass(pass: PlayerPass): void {
  storage.setDeviceToken(pass.token);
  storage.savePlayerCode(pass.code);
  if (pass.name && pass.avatar) storage.saveProfile({ name: pass.name, avatar: pass.avatar });
}

export const passBlock = playerBlock(PLAYER_SALT, passServer, { read: readPass, write: writePass });

/** Nach jeder Änderung: Schloss und Sicherung auf den neuen Stand bringen. Scheitert still, das nächste Mal klappt es. */
export function passChanged(): void {
  const pass = readPass();
  if (pass.code) void updatePlayerLock(passServer, pass.code, pass).catch(() => undefined);
  scheduleSync(passBlock);
}

export async function createPlayerCode(): Promise<void> {
  storage.savePlayerCode(await createPlayerLock(passServer, readPass()));
  scheduleSync(passBlock);
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
    scheduleSync(passBlock);
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

