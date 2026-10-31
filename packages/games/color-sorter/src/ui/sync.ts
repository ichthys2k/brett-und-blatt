import { useSyncExternalStore } from 'react';
import { syncServerUrl } from '../server';
import { getProgress, mergeProgress, replaceProgress, sameProgress, sanitize, type Progress } from './progress';
import { deriveKeys, keysFromCode, open, parseCode, randomCode, seal, type VaultKeys } from './syncCrypto';

/**
 * Narrenhof-Fortschritt über Geräte hinweg (W-018), ohne Konto.
 *
 * - **Sicherungscode:** 16 Zeichen, nur auf den eigenen Geräten bekannt. Daraus entstehen Kennung
 *   und Schlüssel (`syncCrypto.ts`); der Server speichert unter der Kennung nur den im Browser
 *   verschlüsselten Stand (`PUT/GET /sicherung/<Kennung>`).
 * - **Abgleich:** holen, mit dem eigenen Stand zusammenführen (`mergeProgress`), zurückschreiben.
 *   Automatisch beim Öffnen des Spiels, am Ende jedes Hoftags, nach jeder Partie und beim
 *   Schließen der Narrenschule.
 * - **Passkey:** Ein Passkey mit PRF-Erweiterung liefert ein zweites Geheimnis. Darunter liegt
 *   verschlüsselt nur der Sicherungscode – so holt ein neues Gerät den Code per Fingerabdruck
 *   statt per Abtippen. Wo PRF fehlt, bleibt der Code.
 */

const KEY = 'brett-und-blatt:farbensortierer:sicherung';

export interface SyncState {
  code: string | null;
  /** Letzter erfolgreicher Abgleich (ms). */
  lastSync: number | null;
  /** Auf diesem Gerät wurde ein Passkey angelegt. */
  passkey: boolean;
  busy: boolean;
  error: string | null;
}

let state: SyncState = loadState();
const listeners = new Set<() => void>();

function loadState(): SyncState {
  const base: SyncState = { code: null, lastSync: null, passkey: false, busy: false, error: null };
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? 'null') as Partial<SyncState> | null;
    if (!raw) return base;
    return {
      ...base,
      code: typeof raw.code === 'string' ? parseCode(raw.code) : null,
      lastSync: typeof raw.lastSync === 'number' ? raw.lastSync : null,
      passkey: raw.passkey === true,
    };
  } catch {
    return base;
  }
}

function setState(patch: Partial<SyncState>): void {
  state = { ...state, ...patch };
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ code: state.code, lastSync: state.lastSync, passkey: state.passkey }));
  } catch {
    // ohne Speicher gilt die Verbindung bis zum Neuladen
  }
  for (const listener of listeners) listener();
}

export function useSyncState(): SyncState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
    () => state,
  );
}

/** Gibt es einen Spieleserver? Ohne ihn bleibt nur der Sicherungstext. */
export function syncAvailable(): boolean {
  return syncServerUrl() !== null;
}

export class SyncError extends Error {}

const OFFLINE = 'Keine Verbindung zum Spieleserver. Später noch einmal versuchen.';

// ---------------------------------------------------------------- Server

interface Remote {
  data: string;
  rev: number;
}

async function request(id: string, init?: RequestInit): Promise<Response> {
  const server = syncServerUrl();
  if (!server) throw new SyncError('Diese Fassung kennt keinen Spieleserver.');
  try {
    return await fetch(`${server}/sicherung/${id}`, { cache: 'no-store', ...init });
  } catch {
    throw new SyncError(OFFLINE);
  }
}

async function fetchRemote(id: string): Promise<Remote | null> {
  const res = await request(id);
  if (res.status === 404) return null;
  if (!res.ok) throw new SyncError(OFFLINE);
  return (await res.json()) as Remote;
}

/** Schreibt; true bei Erfolg, false wenn inzwischen ein anderes Gerät geschrieben hat. */
async function putRemote(id: string, data: string, rev: number): Promise<boolean> {
  const res = await request(id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data, rev }) });
  if (res.status === 409) return false;
  if (!res.ok) throw new SyncError(OFFLINE);
  return true;
}

async function openProgress(keys: VaultKeys, data: string): Promise<Progress> {
  try {
    const value = (await open(keys, data)) as { progress?: unknown };
    return sanitize(value?.progress);
  } catch {
    throw new SyncError('Die Sicherung lässt sich mit diesem Code nicht öffnen.');
  }
}

/** Ein Abgleich: holen, zusammenführen, zurückschreiben (bei gleichzeitigem Schreiben erneut). */
async function syncWith(code: string, requireExisting: boolean): Promise<void> {
  const keys = await keysFromCode(code);
  for (let attempt = 0; attempt < 4; attempt++) {
    const remote = await fetchRemote(keys.id);
    if (!remote && requireExisting) throw new SyncError('Zu diesem Code gibt es keine Sicherung. Bitte genau abschreiben.');
    const remoteProgress = remote ? await openProgress(keys, remote.data) : null;
    const merged = remoteProgress ? mergeProgress(remoteProgress, getProgress()) : getProgress();
    replaceProgress(merged);
    if (remoteProgress && sameProgress(merged, remoteProgress)) return;
    if (await putRemote(keys.id, await seal(keys, { v: 1, progress: merged }), remote?.rev ?? 0)) return;
  }
  throw new SyncError('Andere Geräte schreiben gerade gleichzeitig. Gleich noch einmal versuchen.');
}

async function run(task: () => Promise<void>): Promise<boolean> {
  if (state.busy) return false;
  setState({ busy: true, error: null });
  try {
    await task();
    setState({ busy: false, lastSync: Date.now() });
    return true;
  } catch (error) {
    setState({ busy: false, error: error instanceof SyncError ? error.message : 'Das hat nicht geklappt. Später noch einmal versuchen.' });
    return false;
  }
}

// ---------------------------------------------------------------- Bedienung

/** Legt eine neue Sicherung mit frischem Code an und lädt den Stand dieses Geräts hoch. */
export function createSync(): Promise<boolean> {
  return run(async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const code = randomCode();
      const keys = await keysFromCode(code);
      if (await fetchRemote(keys.id)) continue;
      if (!(await putRemote(keys.id, await seal(keys, { v: 1, progress: getProgress() }), 0))) continue;
      setState({ code, passkey: false });
      return;
    }
    throw new SyncError('Kein freier Code gefunden. Noch einmal versuchen.');
  });
}

/** Verbindet dieses Gerät mit einer vorhandenen Sicherung und führt beide Stände zusammen. */
export function connectSync(input: string): Promise<boolean> {
  const code = parseCode(input);
  if (!code) {
    setState({ error: 'Der Code hat 16 Zeichen (Buchstaben und Ziffern 2–9). Bitte genau abschreiben.' });
    return Promise.resolve(false);
  }
  return run(async () => {
    await syncWith(code, true);
    setState({ code, passkey: false });
  });
}

/** Abgleich jetzt. */
export function syncNow(): Promise<boolean> {
  const code = state.code;
  if (!code || !syncAvailable()) return Promise.resolve(false);
  return run(() => syncWith(code, false));
}

let timer: ReturnType<typeof setTimeout> | null = null;

/** Abgleich in Kürze (mehrere Anlässe kurz hintereinander ergeben einen Abgleich). */
export function scheduleSync(delayMs = 1500): void {
  if (!state.code || !syncAvailable() || typeof window === 'undefined') return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    if (state.busy) scheduleSync(delayMs);
    else void syncNow();
  }, delayMs);
}

/** Trennt dieses Gerät von der Sicherung. Der Fortschritt hier und die Sicherung bleiben. */
export function disconnectSync(): void {
  setState({ code: null, lastSync: null, passkey: false, error: null });
}

export function clearSyncError(): void {
  if (state.error) setState({ error: null });
}

/** Adresse, die den Code mitbringt (für QR-Code und Teilen). */
export function syncLink(code: string): string {
  return `${window.location.origin}${window.location.pathname}#/neu/color-sorter?sicherung=${code}`;
}

/** Code aus der aufgerufenen Adresse (QR-Code gescannt); entfernt ihn danach aus der Adresszeile. */
export function takeLinkCode(): string | null {
  const hash = window.location.hash;
  const match = /[?&]sicherung=([^&]+)/.exec(hash);
  if (!match) return null;
  const code = parseCode(decodeURIComponent(match[1]!));
  const cleaned = hash.replace(/([?&])sicherung=[^&]*&?/, '$1').replace(/[?&]$/, '');
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${cleaned}`);
  return code;
}

// ---------------------------------------------------------------- Passkey (WebAuthn PRF)

interface PrfOutputs {
  enabled?: boolean;
  results?: { first?: ArrayBuffer | ArrayBufferView };
}

async function prfSalt(): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('brett-und-blatt/narrenhof-passkey/v1')));
}

const random = (n: number) => crypto.getRandomValues(new Uint8Array(n));

function prfBytes(out: PrfOutputs | undefined): Uint8Array | null {
  const first = out?.results?.first;
  if (!first) return null;
  return first instanceof ArrayBuffer ? new Uint8Array(first) : new Uint8Array(first.buffer, first.byteOffset, first.byteLength);
}

/** Kann dieser Browser Passkeys mit PRF? 'maybe': unbekannt, erst beim Versuch klar. */
export async function passkeySupport(): Promise<'yes' | 'maybe' | 'no'> {
  if (typeof window === 'undefined' || !window.PublicKeyCredential || !navigator.credentials || !window.isSecureContext) return 'no';
  const pkc = window.PublicKeyCredential as unknown as { getClientCapabilities?: () => Promise<Record<string, boolean>> };
  try {
    const caps = await pkc.getClientCapabilities?.();
    if (caps && 'extension:prf' in caps) return caps['extension:prf'] ? 'yes' : 'no';
  } catch {
    // unbekannt
  }
  return 'maybe';
}

const NO_PRF = 'Dieser Browser oder Passkey-Speicher kann die nötige Erweiterung (PRF) noch nicht. Nimm hier bitte den Sicherungscode.';

function passkeyError(error: unknown): never {
  if (error instanceof SyncError) throw error;
  const name = (error as { name?: string })?.name;
  if (name === 'NotAllowedError' || name === 'AbortError') throw new SyncError('Abgebrochen.');
  throw new SyncError(NO_PRF);
}

/** Legt einen Passkey an und hinterlegt darunter verschlüsselt den Sicherungscode. */
export function createPasskey(): Promise<boolean> {
  const code = state.code;
  if (!code) return Promise.resolve(false);
  return run(async () => {
    const salt = await prfSalt();
    let secret: Uint8Array | null = null;
    try {
      const credential = (await navigator.credentials.create({
        publicKey: {
          rp: { name: 'Brett & Blatt' },
          user: { id: random(16), name: 'Narrenhof-Fortschritt', displayName: 'Narrenhof-Fortschritt' },
          challenge: random(32),
          pubKeyCredParams: [
            { type: 'public-key', alg: -7 },
            { type: 'public-key', alg: -257 },
          ],
          authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
          extensions: { prf: { eval: { first: salt } } } as AuthenticationExtensionsClientInputs,
        },
      })) as PublicKeyCredential | null;
      if (!credential) throw new SyncError('Abgebrochen.');
      const prf = (credential.getClientExtensionResults() as { prf?: PrfOutputs }).prf;
      secret = prfBytes(prf);
      // Manche Browser liefern beim Anlegen nur „enabled“ – dann einmal anmelden.
      if (!secret && prf?.enabled) {
        const assertion = (await navigator.credentials.get({
          publicKey: {
            challenge: random(32),
            allowCredentials: [{ type: 'public-key', id: credential.rawId }],
            userVerification: 'required',
            extensions: { prf: { eval: { first: salt } } } as AuthenticationExtensionsClientInputs,
          },
        })) as PublicKeyCredential | null;
        secret = prfBytes((assertion?.getClientExtensionResults() as { prf?: PrfOutputs } | undefined)?.prf);
      }
    } catch (error) {
      passkeyError(error);
    }
    if (!secret) throw new SyncError(NO_PRF);
    const keys = await deriveKeys(secret, 'passkey');
    const remote = await fetchRemote(keys.id);
    if (!(await putRemote(keys.id, await seal(keys, { v: 1, code }), remote?.rev ?? 0))) throw new SyncError(OFFLINE);
    setState({ passkey: true });
  });
}

/** Holt mit einem Passkey den Sicherungscode und verbindet dieses Gerät. */
export function connectWithPasskey(): Promise<boolean> {
  return run(async () => {
    const salt = await prfSalt();
    let secret: Uint8Array | null = null;
    try {
      const assertion = (await navigator.credentials.get({
        publicKey: {
          challenge: random(32),
          userVerification: 'required',
          extensions: { prf: { eval: { first: salt } } } as AuthenticationExtensionsClientInputs,
        },
      })) as PublicKeyCredential | null;
      secret = prfBytes((assertion?.getClientExtensionResults() as { prf?: PrfOutputs } | undefined)?.prf);
    } catch (error) {
      passkeyError(error);
    }
    if (!secret) throw new SyncError(NO_PRF);
    const keys = await deriveKeys(secret, 'passkey');
    const remote = await fetchRemote(keys.id);
    if (!remote) throw new SyncError('Zu diesem Passkey gibt es keine Sicherung.');
    let code: string | null = null;
    try {
      const value = (await open(keys, remote.data)) as { code?: unknown };
      code = typeof value?.code === 'string' ? parseCode(value.code) : null;
    } catch {
      code = null;
    }
    if (!code) throw new SyncError('Die Sicherung zu diesem Passkey lässt sich nicht öffnen.');
    await syncWith(code, true);
    setState({ code, passkey: true });
  });
}
