import {
  changePassLock,
  connectSync,
  createPassLock,
  createSync,
  hasPassLock,
  openPassLock,
  parseSecret,
  resetPassLock,
  savePassLock,
  stretchSecret,
  createPlayerLock,
  disconnectSync,
  parseCode,
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
import { cleanCrest } from '@brett-und-blatt/engine';
import { GAME_SERVER } from './online';
import { passBook } from './passes';
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
 * Rettungscode gibt es keinen Ausweis, der ihn tragen könnte – dann bleibt es beim Nichts.
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
  syncPassEntry();
  const pass = readPass();
  const secrets = storage.loadLockSecrets();
  if (pass.code && secrets) void savePassLock(passServer, pass.code, secrets, pass).catch(() => undefined);
  else if (pass.code) {
    // Gibt es das Schloss schon (dieses Gerät kam über den Rettungscode), darf der Ausweis nicht ohne PIN daneben liegen.
    const code = pass.code;
    void hasPassLock(passServer, code)
      .then((exists) => (exists ? undefined : updatePlayerLock(passServer, code, pass)))
      .catch(() => undefined);
  }
  passSyncSoon();
}

/** Name, Bild und Code-Stand des aktiven Passes auf diesem Gerät. */
export function currentPassInfo(): { name: string; avatar: string; hasCode: boolean; crest?: string } {
  const profile = storage.loadProfile();
  const crest = cleanCrest(storage.loadCrestText());
  return { name: profile?.name ?? '', avatar: profile?.avatar ?? '', hasCode: !!storage.loadPlayerCode() || !!currentSyncCode(), ...(crest ? { crest } : {}) };
}

/** Hält den Eintrag des aktiven Passes in der Passliste des Geräts aktuell (#139). */
export function syncPassEntry(): void {
  passBook.touch(currentPassInfo());
}

/** Wechselt zu einem anderen Pass des Geräts; die Seite lädt danach neu und spielt als dieser Pass. */
export function switchPass(id: string): void {
  if (!passBook.switchTo(id, currentPassInfo())) return;
  window.location.hash = '#/';
  window.location.reload();
}

/** Legt einen neuen, leeren Pass (oder einen Gast) an und wechselt dorthin. */
export function newPass(options: { guest?: boolean } = {}): void {
  if (!passBook.createNew(currentPassInfo(), options)) return;
  window.location.hash = options.guest ? '#/' : '#/online';
  window.location.reload();
}

/** Entfernt einen Pass von diesem Gerät. */
export function removePass(id: string): void {
  const wasActive = passBook.activeId() === id;
  passBook.remove(id);
  if (wasActive) {
    window.location.hash = '#/';
    window.location.reload();
  }
}

/** Speichert das eigene Profil und bringt Schloss und Sicherung auf den neuen Stand (#136). Der einzige Weg, das eigene Profil zu ändern. */
export function saveOwnProfile(profile: Profile): void {
  storage.saveProfile(profile);
  syncPassEntry();
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

/**
 * Übernimmt einen Ausweis über Spielercode oder Rettungscode. false: Eingabe ist keins von beiden oder der Abgleich scheiterte.
 * 'secret': Der Spielercode gehört zu einem Ausweis mit PIN oder Passwort – dann weiter mit `adoptLocked`.
 */
export async function adoptCode(input: string): Promise<boolean | 'secret'> {
  const code = parsePlayerCode(input);
  if (code) {
    if (await hasPassLock(passServer, code)) return 'secret';
    writePass(await openPlayerLock(passServer, code));
    passSyncSoon();
    return true;
  }
  return connectSync(passBlock, input);
}

/** Öffnet einen Ausweis mit PIN oder Passwort. */
export async function adoptLocked(input: string, rawSecret: string): Promise<void> {
  const code = parsePlayerCode(input);
  const secret = parseSecret(rawSecret);
  if (!code || !secret) throw new SyncError('PIN: sechs Ziffern oder sechs Bilder. Passwort: mindestens 8 Zeichen.');
  const secrets = await stretchSecret(code, secret.value);
  const { pass } = await openPassLock(passServer, code, secrets);
  writePass(pass);
  storage.saveLockSecrets(secrets);
  passSyncSoon();
}

/** Hat dieses Gerät ein Schloss mit PIN oder Passwort für seinen Ausweis? */
export const hasLock = (): boolean => storage.loadLockSecrets() !== null;

function checkedSecret(raw: string) {
  const secret = parseSecret(raw);
  if (!secret) throw new SyncError('PIN: sechs Ziffern oder sechs Bilder. Passwort: mindestens 8 Zeichen.');
  return secret;
}

/**
 * Schützt den Ausweis mit PIN oder Passwort. Dazu braucht es die Rettungskarte (Rettungscode); gibt es noch keine, wird sie angelegt.
 * Danach öffnet der Spielercode allein nichts mehr: Der bisherige PIN-lose Ausweis unter dem Code wird ungültig gemacht.
 */
export async function setSecret(raw: string): Promise<void> {
  const secret = checkedSecret(raw);
  if (!storage.loadPlayerCode()) await createPlayerCode();
  const code = storage.loadPlayerCode()!;
  if (!currentSyncCode() && !(await createSync(passBlock))) throw new SyncError('Die Rettungskarte (Rettungscode) ließ sich nicht anlegen. Später noch einmal versuchen.');
  const key = ensurePassKey();
  if (!key) throw new SyncError('Der Passschlüssel fehlt.');
  const syncCode = currentSyncCode()!;
  const secrets = await stretchSecret(code, secret.value);
  // Gab es das Schloss schon (anderes Gerät), setzt die Rettungskarte, die dieses Gerät kennt, eine neue PIN.
  if (await hasPassLock(passServer, code)) await resetPassLock(passServer, code, syncCode, secrets, readPass());
  else await createPassLock(passServer, code, secrets, syncCode, readPass());
  await revokePlayerLock(passServer, code).catch(() => undefined);
  storage.saveLockSecrets(secrets);
  passSyncSoon();
}

/** Ändert PIN oder Passwort. */
export async function changeSecret(oldRaw: string, newRaw: string): Promise<void> {
  const code = storage.loadPlayerCode();
  if (!code) throw new SyncError('Es gibt noch keinen Spielercode.');
  const [oldSecret, newSecret] = [checkedSecret(oldRaw), checkedSecret(newRaw)];
  const secrets = await stretchSecret(code, newSecret.value);
  await changePassLock(passServer, code, await stretchSecret(code, oldSecret.value), secrets, readPass());
  storage.saveLockSecrets(secrets);
}

/** Vergessene oder gesperrte PIN: Die Rettungskarte (Rettungscode) setzt eine neue. */
export async function resetSecret(cardInput: string, newRaw: string): Promise<void> {
  const code = storage.loadPlayerCode();
  const syncCode = parseCode(cardInput);
  if (!code) throw new SyncError('Es gibt noch keinen Spielercode.');
  if (!syncCode) throw new SyncError('Der Rettungscode hat 16 Zeichen (Buchstaben und Ziffern 2–9). Bitte genau abschreiben.');
  const secrets = await stretchSecret(code, checkedSecret(newRaw).value);
  await resetPassLock(passServer, code, syncCode, secrets, readPass());
  storage.saveLockSecrets(secrets);
}

/** Rettungskarte: Spielercode und Rettungscode zum Aufbewahren und Ausdrucken. */
export function emergencyCard(): { playerCode: string; syncCode: string } | null {
  const playerCode = storage.loadPlayerCode();
  const syncCode = currentSyncCode();
  return playerCode && syncCode ? { playerCode, syncCode } : null;
}

/** Adresse für den QR-Code der Rettungskarte: führt mit dem Rettungscode zurück in den Ausweis. */
export function emergencyLink(syncCode: string): string {
  return `${window.location.origin}${window.location.pathname}#/online?sicherung=${encodeURIComponent(syncCode)}`;
}

export function isPassError(error: unknown): error is SyncError {
  return error instanceof SyncError;
}

export function playerLink(code: string): string {
  return `${window.location.origin}${window.location.pathname}#/online?ausweis=${encodeURIComponent(code)}`;
}

/** Spielercode oder Rettungscode aus der Adresse (QR-Code gescannt); entfernt ihn danach aus der Adresszeile. */
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

