import { useSyncExternalStore } from 'react';
import { deriveKeys, keysFromCode, NARRENHOF_SALT, open, parseCode, randomCode, seal, type VaultKeys } from './crypto';

/**
 * Sicherung über Geräte hinweg (W-018, W-050), ohne Konto.
 *
 * - **Sicherungscode:** 16 Zeichen, gilt für die ganze Plattform. Jedes Spiel leitet daraus mit
 *   eigenem Salt eine eigene Kennung und einen eigenen Schlüssel ab und legt einen eigenen Block
 *   ab; der Server sieht nur verschlüsselte Daten (`PUT/GET /sicherung/<Kennung>`).
 * - **Abgleich:** holen, mit dem eigenen Stand zusammenführen, zurückschreiben.
 * - **Passkey:** Ein Passkey mit PRF-Erweiterung liefert ein zweites Geheimnis. Darunter liegt
 *   verschlüsselt nur der Sicherungscode – so holt ein neues Gerät den Code per Fingerabdruck
 *   statt per Abtippen. Wo PRF fehlt, bleibt der Code.
 */

/** Was ein Spiel beisteuert. Der Baustein kennt seine Daten nicht. */
export interface SyncBlock<T> {
  salt: string;
  /** Feldname im verschlüsselten Block, z. B. `progress`. */
  field: string;
  serverUrl(): string | null;
  read(): T;
  /** Wirft nicht, sondern macht aus fremden Daten einen gültigen Stand. */
  sanitize(value: unknown): T;
  merge(remote: T, local: T): T;
  write(value: T): void;
  same(a: T, b: T): boolean;
}

/** Alle Blöcke der Plattform: Sie alle belegen einen Code und werden beim Abgleich mit angefasst. */
const KNOWN_SALTS = [NARRENHOF_SALT, 'brett-und-blatt/drachenspiel-sicherung/v1', 'brett-und-blatt/spieler-sicherung/v1'];
export const DRACHENSPIEL_SALT = KNOWN_SALTS[1]!;
export const PLAYER_SALT = KNOWN_SALTS[2]!;

const KEY = 'brett-und-blatt:farbensortierer:sicherung';

export interface SyncState {
  code: string | null;
  /** Letzter erfolgreicher Abgleich (ms). */
  lastSync: number | null;
  /**
   * Passkeys, die von diesem Gerät aus angelegt oder benutzt wurden (Kennungen als Base64url).
   * Es dürfen beliebig viele sein – etwa einer in iCloud, einer bei Google, ein Sicherheitsschlüssel.
   * Jeder hat sein eigenes Schloss beim Server, darin jeweils der Sicherungscode.
   */
  passkeys: string[];
  busy: boolean;
  error: string | null;
}

/** Platzhalter für einen Passkey aus der ersten Fassung (Kennung unbekannt). */
const LEGACY_PASSKEY = 'alt';

let state: SyncState = loadState();
const listeners = new Set<() => void>();

function loadState(): SyncState {
  const base: SyncState = { code: null, lastSync: null, passkeys: [], busy: false, error: null };
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? 'null') as Partial<SyncState> | null;
    if (!raw) return base;
    return {
      ...base,
      code: typeof raw.code === 'string' ? parseCode(raw.code) : null,
      lastSync: typeof raw.lastSync === 'number' ? raw.lastSync : null,
      passkeys: Array.isArray(raw.passkeys)
        ? raw.passkeys.filter((id): id is string => typeof id === 'string' && /^[A-Za-z0-9_-]{1,400}$/.test(id)).slice(0, 50)
        : (raw as { passkey?: unknown }).passkey === true
          ? [LEGACY_PASSKEY]
          : [],
    };
  } catch {
    return base;
  }
}

function setState(patch: Partial<SyncState>): void {
  state = { ...state, ...patch };
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ code: state.code, lastSync: state.lastSync, passkeys: state.passkeys }));
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

/** Der Sicherungscode dieses Geräts, außerhalb von React. */
export function currentSyncCode(): string | null {
  return state.code;
}

/** Gibt es einen Spieleserver? Ohne ihn bleibt nur der Sicherungstext. */
export function syncAvailable(block: { serverUrl: Server }): boolean {
  return block.serverUrl() !== null;
}

export class SyncError extends Error {}

const OFFLINE = 'Keine Verbindung zum Spieleserver. Später noch einmal versuchen.';

// ---------------------------------------------------------------- Server

interface Remote {
  data: string;
  rev: number;
}

type Server = () => string | null;

async function request(serverUrl: Server, id: string, init?: RequestInit): Promise<Response> {
  const server = serverUrl();
  if (!server) throw new SyncError('Diese Fassung kennt keinen Spieleserver.');
  try {
    return await fetch(`${server}/sicherung/${id}`, { cache: 'no-store', ...init });
  } catch {
    throw new SyncError(OFFLINE);
  }
}

export async function fetchRemote(serverUrl: Server, id: string): Promise<Remote | null> {
  const res = await request(serverUrl, id);
  if (res.status === 404) return null;
  if (!res.ok) throw new SyncError(OFFLINE);
  return (await res.json()) as Remote;
}

/** Schreibt; true bei Erfolg, false wenn inzwischen ein anderes Gerät geschrieben hat. */
export async function putRemote(serverUrl: Server, id: string, data: string, rev: number): Promise<boolean> {
  const res = await request(serverUrl, id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data, rev }) });
  if (res.status === 409) return false;
  if (!res.ok) throw new SyncError(OFFLINE);
  return true;
}

async function openBlock<T>(block: SyncBlock<T>, keys: VaultKeys, data: string): Promise<T> {
  try {
    const value = (await open(keys, data)) as Record<string, unknown>;
    return block.sanitize(value?.[block.field]);
  } catch {
    throw new SyncError('Die Sicherung lässt sich mit diesem Code nicht öffnen.');
  }
}

/** Gehört der Code zu irgendeinem Spiel? Ein Lesezugriff hält dessen Block zugleich am Leben. */
async function touchOtherBlocks(serverUrl: Server, code: string, salt: string): Promise<boolean> {
  let found = false;
  for (const other of KNOWN_SALTS) {
    if (other === salt) continue;
    const keys = await keysFromCode(code, other);
    if (await fetchRemote(serverUrl, keys.id)) found = true;
  }
  return found;
}

/** Ein Abgleich: holen, zusammenführen, zurückschreiben (bei gleichzeitigem Schreiben erneut). */
async function syncWith<T>(block: SyncBlock<T>, code: string, requireExisting: boolean): Promise<void> {
  const keys = await keysFromCode(code, block.salt);
  const others = await touchOtherBlocks(block.serverUrl, code, block.salt);
  for (let attempt = 0; attempt < 4; attempt++) {
    const remote = await fetchRemote(block.serverUrl, keys.id);
    if (!remote && requireExisting && !others) throw new SyncError('Zu diesem Code gibt es keine Sicherung. Bitte genau abschreiben.');
    const remoteValue = remote ? await openBlock(block, keys, remote.data) : null;
    const merged = remoteValue ? block.merge(remoteValue, block.read()) : block.read();
    block.write(merged);
    if (remoteValue && block.same(merged, remoteValue)) return;
    if (await putRemote(block.serverUrl, keys.id, await seal(keys, { v: 1, [block.field]: merged }), remote?.rev ?? 0)) return;
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
export function createSync<T>(block: SyncBlock<T>): Promise<boolean> {
  return run(async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const code = randomCode();
      const keys = await keysFromCode(code, block.salt);
      if (await fetchRemote(block.serverUrl, keys.id)) continue;
      if (!(await putRemote(block.serverUrl, keys.id, await seal(keys, { v: 1, [block.field]: block.read() }), 0))) continue;
      setState({ code, passkeys: [] });
      return;
    }
    throw new SyncError('Kein freier Code gefunden. Noch einmal versuchen.');
  });
}

/** Verbindet dieses Gerät mit einer vorhandenen Sicherung und führt beide Stände zusammen. */
export function connectSync<T>(block: SyncBlock<T>, input: string): Promise<boolean> {
  const code = parseCode(input);
  if (!code) {
    setState({ error: 'Der Code hat 16 Zeichen (Buchstaben und Ziffern 2–9). Bitte genau abschreiben.' });
    return Promise.resolve(false);
  }
  return run(async () => {
    await syncWith(block, code, true);
    setState({ code, passkeys: [] });
  });
}

/** Abgleich jetzt. */
export function syncNow<T>(block: SyncBlock<T>): Promise<boolean> {
  const code = state.code;
  if (!code || !block.serverUrl()) return Promise.resolve(false);
  return run(() => syncWith(block, code, false));
}

let timer: ReturnType<typeof setTimeout> | null = null;

/** Abgleich in Kürze (mehrere Anlässe kurz hintereinander ergeben einen Abgleich). */
export function scheduleSync<T>(block: SyncBlock<T>, delayMs = 1500): void {
  if (!state.code || !block.serverUrl() || typeof window === 'undefined') return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    if (state.busy) scheduleSync(block, delayMs);
    else void syncNow(block);
  }, delayMs);
}

/** Trennt dieses Gerät von der Sicherung. Der Stand hier und die Sicherung bleiben. */
export function disconnectSync(): void {
  setState({ code: null, lastSync: null, passkeys: [], error: null });
}

export function clearSyncError(): void {
  if (state.error) setState({ error: null });
}

/** Adresse, die den Code mitbringt (für QR-Code und Teilen). */
export function syncLink(code: string, gameId: string): string {
  return `${window.location.origin}${window.location.pathname}#/neu/${gameId}?sicherung=${code}`;
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

function toBase64Url(bytes: ArrayBuffer): string {
  let binary = '';
  for (const b of new Uint8Array(bytes)) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)), (ch) => ch.charCodeAt(0));
}

function rememberPasskey(list: string[], rawId: ArrayBuffer): string[] {
  const id = toBase64Url(rawId);
  return [...list.filter((p) => p !== id), id].slice(-50);
}

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
  if (name === 'InvalidStateError') throw new SyncError('In diesem Passkey-Speicher gibt es schon einen Passkey für deine Sicherung. Wähle beim Anlegen einen anderen Speicher (z. B. Handy, Sicherheitsschlüssel).');
  if (name === 'NotAllowedError' || name === 'AbortError') throw new SyncError('Abgebrochen.');
  throw new SyncError(NO_PRF);
}

/**
 * Legt einen (weiteren) Passkey an und hinterlegt darunter verschlüsselt den Sicherungscode.
 * Schon bekannte Passkeys werden ausgeschlossen, damit derselbe Speicher keinen zweiten bekommt.
 */
export function createPasskey(serverUrl: Server): Promise<boolean> {
  const code = state.code;
  if (!code) return Promise.resolve(false);
  return run(async () => {
    const salt = await prfSalt();
    let secret: Uint8Array | null = null;
    let rawId: ArrayBuffer | null = null;
    const label = `Brett & Blatt-Sicherung (${new Date().toLocaleDateString('de-DE')})`;
    const known = state.passkeys.filter((id) => id !== LEGACY_PASSKEY);
    try {
      const credential = (await navigator.credentials.create({
        publicKey: {
          rp: { name: 'Brett & Blatt' },
          user: { id: random(16), name: label, displayName: label },
          excludeCredentials: known.map((id) => ({ type: 'public-key' as const, id: fromBase64Url(id) as BufferSource })),
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
      rawId = credential.rawId;
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
    const remote = await fetchRemote(serverUrl, keys.id);
    if (!(await putRemote(serverUrl, keys.id, await seal(keys, { v: 1, code }), remote?.rev ?? 0))) throw new SyncError(OFFLINE);
    setState({ passkeys: rawId ? rememberPasskey(state.passkeys, rawId) : state.passkeys });
  });
}

/** Holt mit einem Passkey den Sicherungscode und verbindet dieses Gerät. */
export function connectWithPasskey<T>(block: SyncBlock<T>): Promise<boolean> {
  return run(async () => {
    const salt = await prfSalt();
    let secret: Uint8Array | null = null;
    let rawId: ArrayBuffer | null = null;
    try {
      const assertion = (await navigator.credentials.get({
        publicKey: {
          challenge: random(32),
          userVerification: 'required',
          extensions: { prf: { eval: { first: salt } } } as AuthenticationExtensionsClientInputs,
        },
      })) as PublicKeyCredential | null;
      secret = prfBytes((assertion?.getClientExtensionResults() as { prf?: PrfOutputs } | undefined)?.prf);
      rawId = assertion?.rawId ?? null;
    } catch (error) {
      passkeyError(error);
    }
    if (!secret) throw new SyncError(NO_PRF);
    const keys = await deriveKeys(secret, 'passkey');
    const remote = await fetchRemote(block.serverUrl, keys.id);
    if (!remote) throw new SyncError('Zu diesem Passkey gibt es keine Sicherung.');
    let code: string | null = null;
    try {
      const value = (await open(keys, remote.data)) as { code?: unknown };
      code = typeof value?.code === 'string' ? parseCode(value.code) : null;
    } catch {
      code = null;
    }
    if (!code) throw new SyncError('Die Sicherung zu diesem Passkey lässt sich nicht öffnen.');
    await syncWith(block, code, true);
    setState({ code, passkeys: rawId ? rememberPasskey([], rawId) : [] });
  });
}
