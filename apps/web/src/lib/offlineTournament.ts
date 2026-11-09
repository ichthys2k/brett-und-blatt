import { Tournament, applyTournamentMessage, type PointRules, type TournamentClientMessage, type TournamentSettings, type TournamentSnapshot, type TournamentView } from '@brett-und-blatt/online';
import { GAME_SERVER } from './server';
import { storage, type Profile } from './storage';

/*
 * Turnierleitung ohne Netz (W-058 Stufe 6, #190): Ein Turnier vor Ort, das auf diesem Gerät angelegt wird, läuft ganz im
 * Browser – derselbe Turnierkern wie auf dem Server, nur ohne Verbindung. Der Zustand liegt in `localStorage` und
 * überlebt Neuladen und App-Neustart. Mit Netz lässt es sich auf den Server übertragen: Das Turnier wird dort mit
 * demselben Startwert der Auslosung angelegt und die Nachrichten der Leitung werden in der alten Reihenfolge
 * wiederholt; das ergibt denselben Stand. Weil das Turnier auf diesem Gerät entstanden ist, gibt es keine
 * Konflikte mit dem Server. Was Netz braucht, gibt es offline nicht: Helferlinks, Zuschaulink, Einschreibung per Link.
 */

const KEY = 'brett-und-blatt:offline-turniere';
const MAX_RECORDS = 12;

/** Kennung eines Turniers ohne Netz: nie gleich einem Servercode (acht Buchstaben und Ziffern). */
export const OFFLINE_PREFIX = 'LOKAL-';
export const isOfflineCode = (code: string): boolean => /^LOKAL-[A-Z0-9]{6}$/.test(code);

type LeaderMessage = Exclude<TournamentClientMessage, { type: 'hello' }>;

export interface OfflineRecord {
  code: string;
  seed: string;
  settings: TournamentSettings;
  fields: number;
  points?: PointRules;
  /** Alle angenommenen Nachrichten der Leitung in der Reihenfolge; daraus entsteht der Stand auf dem Server wieder. */
  log: LeaderMessage[];
  snapshot: TournamentSnapshot;
  createdAt: number;
  updatedAt: number;
  /** Servercode, sobald das Turnier übertragen ist; danach nur noch zum Ansehen. */
  syncedCode?: string;
}

function readAll(): Record<string, OfflineRecord> {
  try {
    const raw = window.localStorage.getItem(KEY);
    const data = raw ? (JSON.parse(raw) as unknown) : null;
    return data && typeof data === 'object' ? (data as Record<string, OfflineRecord>) : {};
  } catch {
    return {};
  }
}

function writeAll(all: Record<string, OfflineRecord>): boolean {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(all));
    return true;
  } catch {
    return false;
  }
}

const deps = { now: () => Date.now(), randomClaim: () => crypto.randomUUID().slice(0, 8).toUpperCase() };

function randomHex(bytes: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function loadOfflineRecord(code: string): OfflineRecord | null {
  return readAll()[code] ?? null;
}

export function listOfflineRecords(): OfflineRecord[] {
  return Object.values(readAll()).sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Legt ein Turnier ohne Netz an. null, wenn der Speicher voll oder gesperrt ist. */
export function createOfflineTournament(settings: TournamentSettings, profile: Profile, fields = 0, points?: PointRules): string | null {
  const all = readAll();
  const code = `${OFFLINE_PREFIX}${randomHex(3).toUpperCase()}`;
  const seed = randomHex(12);
  const t = Tournament.create(code, seed, { ...settings, mode: 'local', isPublic: false }, { token: storage.deviceToken(), name: profile.name }, deps, fields, points);
  all[code] = { code, seed, settings: t.snapshot().settings, fields, ...(points ? { points } : {}), log: [], snapshot: t.snapshot(), createdAt: Date.now(), updatedAt: Date.now() };
  // Älteste überzählige verwerfen, aber nie ein noch nicht übertragenes.
  const records = Object.values(all).sort((a, b) => b.updatedAt - a.updatedAt);
  for (const old of records.slice(MAX_RECORDS)) if (old.syncedCode) delete all[old.code];
  return writeAll(all) ? code : null;
}

/** Die Sicht auf ein Turnier ohne Netz, null wenn es das nicht (mehr) gibt. */
export function offlineView(code: string): TournamentView | null {
  const record = loadOfflineRecord(code);
  return record ? Tournament.restore(record.snapshot, deps).view(storage.deviceToken()) : null;
}

export type OfflineResult = { ok: true; view: TournamentView; claim?: { player: string; code: string } } | { ok: false; error: string } | { ok: true; deleted: true };

/** Wendet eine Nachricht der Leitung an, speichert und liefert die neue Sicht. */
export function applyOfflineMessage(code: string, profile: Profile, message: LeaderMessage): OfflineResult {
  // Die Leitung gehört bei einem Turnier ohne Netz zu diesem Gerät; übergeben lässt sie sich erst nach dem Abgleich.
  if (message.type === 'leaderCode' || message.type === 'takeLeader') return { ok: false, error: 'Ohne Netz lässt sich die Leitung nicht übergeben. Erst mit dem Server abgleichen.' };
  const all = readAll();
  const record = all[code];
  if (!record) return { ok: false, error: 'Dieses Turnier gibt es nicht mehr.' };
  if (record.syncedCode) return { ok: false, error: 'Dieses Turnier ist schon auf den Server übertragen; dort geht es weiter.' };
  const t = Tournament.restore(record.snapshot, deps);
  const token = storage.deviceToken();
  const result = applyTournamentMessage(t, { token, name: profile.name, avatar: profile.avatar }, message);
  if (result.kind === 'error') return { ok: false, error: result.message };
  if (result.kind === 'delete') {
    delete all[code];
    writeAll(all);
    return { ok: true, deleted: true };
  }
  record.snapshot = t.snapshot();
  record.log.push(message);
  record.updatedAt = Date.now();
  if (!writeAll(all)) return { ok: false, error: 'Der Speicher dieses Geräts ist voll oder gesperrt; die Änderung wurde nicht gespeichert.' };
  return { ok: true, view: t.view(token), ...(result.claim ? { claim: result.claim } : {}) };
}

export function deleteOfflineRecord(code: string): void {
  const all = readAll();
  delete all[code];
  writeAll(all);
}

export type SyncOutcome = { ok: true; code: string } | { ok: false; error: string };

/**
 * Überträgt ein Turnier ohne Netz auf den Server: anlegen mit demselben Startwert, dann alle Nachrichten der Leitung
 * der Reihe nach wiederholen. Schlägt etwas fehl, bleibt die Kopie auf diesem Gerät unverändert.
 */
export async function syncOfflineTournament(code: string, profile: Profile): Promise<SyncOutcome> {
  const record = loadOfflineRecord(code);
  if (!record) return { ok: false, error: 'Dieses Turnier gibt es nicht mehr.' };
  if (record.syncedCode) return { ok: true, code: record.syncedCode };
  if (!GAME_SERVER) return { ok: false, error: 'Kein Server eingestellt.' };
  let serverCode: string;
  try {
    const response = await fetch(`${GAME_SERVER}/turniere`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: { ...record.settings, fields: record.fields, ...(record.points ? { points: record.points } : {}) }, token: storage.deviceToken(), name: profile.name, seed: record.seed }),
    });
    if (!response.ok) return { ok: false, error: `Der Server antwortet mit ${response.status}.` };
    serverCode = ((await response.json()) as { code: string }).code;
  } catch {
    return { ok: false, error: 'Der Server ist nicht erreichbar. Später noch einmal versuchen.' };
  }
  const outcome = await replay(serverCode, profile, record.log);
  if (!outcome.ok) return outcome;
  const all = readAll();
  if (all[code]) {
    all[code]!.syncedCode = serverCode;
    writeAll(all);
  }
  return { ok: true, code: serverCode };
}

/** Wiederholt die Nachrichten auf dem Server und prüft, dass keine abgelehnt wurde. */
function replay(serverCode: string, profile: Profile, log: LeaderMessage[]): Promise<SyncOutcome> {
  return new Promise((resolve) => {
    const ws = new WebSocket(`${GAME_SERVER!.replace(/^http/, 'ws')}/turniere/${encodeURIComponent(serverCode)}`);
    let done = false;
    const finish = (outcome: SyncOutcome) => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      try {
        ws.close();
      } catch {
        // Schon zu.
      }
      resolve(outcome);
    };
    const timer = window.setTimeout(() => finish({ ok: false, error: 'Der Server antwortet nicht. Das Turnier ist dort angelegt, aber nicht vollständig; auf diesem Gerät bleibt die Kopie.' }), 30_000);
    const hello = { type: 'hello', token: storage.deviceToken(), name: profile.name, avatar: profile.avatar } satisfies TournamentClientMessage;
    let views = 0;
    ws.onopen = () => {
      ws.send(JSON.stringify(hello));
      for (const message of log) ws.send(JSON.stringify(message));
      // Die Nachrichten laufen auf dem Server der Reihe nach; die Antwort auf dieses zweite „hello“ kommt als letzte.
      ws.send(JSON.stringify(hello));
    };
    ws.onmessage = (event) => {
      if (typeof event.data !== 'string' || event.data === 'pong') return;
      const message = JSON.parse(event.data) as { type: string; message?: string };
      if (message.type === 'error') finish({ ok: false, error: `Der Server hat eine Eingabe abgelehnt: ${message.message ?? ''} Auf diesem Gerät bleibt die Kopie.` });
      // Jede angenommene Nachricht schickt den neuen Stand: zwei „hello“ und eine Sicht je Nachricht der Leitung.
      else if (message.type === 'tournament' && ++views >= log.length + 2) finish({ ok: true, code: serverCode });
    };
    ws.onerror = () => finish({ ok: false, error: 'Die Verbindung zum Server ist abgebrochen.' });
  });
}
