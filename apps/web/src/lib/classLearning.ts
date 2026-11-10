import { encodePairsOption, packsOf, reconcileCards, rowIdOf, stripHtmlKeepMedia, streakOf, dayNumber, isDue, type ApkgCard } from '@brett-und-blatt/engine';
import type { ClassPack, ClassView } from '@brett-und-blatt/online';
import { importApkg } from './ankiPackage';
import { exportApkg } from './ankiPackage';
import { loadPack, loadPackLight, savePack as saveApkgPack } from './ankiStore';
import { currentArchiveLink, fetchArchive, publishArchive } from './archiveShare';
import { generateLeadKeys, openProgress, sealProgress, type LeadKeyPair } from './classCrypto';
import { classAct, classData, loadClasses } from './classes';
import { localMidnight } from './learnStore';
import { withoutScheduling } from '@brett-und-blatt/engine';

/*
 * Pakete und Lernstand in der Klasse (#101, L7 / #224). Die Leitung legt ein geteiltes Anki-Paket in die Klasse; Mitglieder übernehmen es.
 * Mit Einwilligung des Mitglieds und eingeschaltetem „Lernstand“ legt das Gerät den Stand der Klassenpakete verschlüsselt ab; nur die Leitung kann ihn öffnen.
 */

/** Der Hinweis zum Lernstand: Wortlaut von Cornelius bestätigt (10.11.2026). */
export const LEARNING_NOTICE =
  'In dieser Klasse sieht die Lehrkraft, was du gelernt hast: welche Karten du wiederholt hast und wie sicher du sie kannst – nur für die Pakete der Klasse. Sonst nichts aus deinem Pass (keine Partien, keine Notizen). Der Stand wird auf deinem Gerät verschlüsselt; der Server sieht nur unlesbare Daten, nur die Leitung kann ihn öffnen. Du kannst die Klasse jederzeit verlassen; dann sieht die Leitung nichts Neues mehr und der Stand wird gelöscht. Kinder: bitte gemeinsam mit den Eltern lesen.';

const read = (key: string): unknown => {
  try {
    return JSON.parse(window.localStorage.getItem(key) ?? 'null');
  } catch {
    return null;
  }
};
const write = (key: string, value: unknown): void => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ohne Speicher gilt es nur bis zum Neuladen
  }
};

// ---------------------------------------------------------------- Schlüssel der Leitung

export const LEAD_KEYS_KEY = 'brett-und-blatt:klassenschluessel';

export function loadLeadKeys(): LeadKeyPair | null {
  const value = read(LEAD_KEYS_KEY) as Partial<LeadKeyPair> | null;
  return value && typeof value.pub === 'string' && value.priv && typeof value.at === 'number' ? (value as LeadKeyPair) : null;
}
export const saveLeadKeys = (keys: LeadKeyPair): void => write(LEAD_KEYS_KEY, keys);
export async function ensureLeadKeys(): Promise<LeadKeyPair> {
  const known = loadLeadKeys();
  if (known) return known;
  const fresh = await generateLeadKeys();
  saveLeadKeys(fresh);
  return fresh;
}

// ---------------------------------------------------------------- Zuordnung Klassenpaket ↔ Paket auf diesem Gerät

export const CLASS_PACKS_KEY = 'brett-und-blatt:klassenpakete';
type Links = Record<string, Record<string, string>>;
const loadLinks = (): Links => {
  const value = read(CLASS_PACKS_KEY);
  return value && typeof value === 'object' ? (value as Links) : {};
};
export const classPackLinks = (code: string): Record<string, string> => loadLinks()[code] ?? {};
export function linkClassPack(code: string, classPackId: string, localId: string): void {
  const all = loadLinks();
  write(CLASS_PACKS_KEY, { ...all, [code]: { ...(all[code] ?? {}), [classPackId]: localId } });
}

// ---------------------------------------------------------------- Einwilligung

export const CONSENT_KEY = 'brett-und-blatt:klassenlernen';
export const hasLearningConsent = (code: string): boolean => (read(CONSENT_KEY) as Record<string, boolean> | null)?.[code] === true;
export function setLearningConsent(code: string, on: boolean): void {
  const all = (read(CONSENT_KEY) as Record<string, boolean> | null) ?? {};
  if (on) all[code] = true;
  else delete all[code];
  write(CONSENT_KEY, all);
}

// ---------------------------------------------------------------- Pakete

/** Leitung: ein eigenes Anki-Paket (ohne Lernstand, mit Medien) teilen und in die Klasse legen. */
export async function addPackToClass(code: string, localId: string, name: string): Promise<{ ok: true; view: ClassView } | { ok: false; error: string }> {
  const stored = await loadPack(localId);
  if (!stored) return { ok: false, error: 'Das Paket gibt es nicht mehr.' };
  const bytes = await exportApkg({ collection: stored.pack.collection, media: stored.media, conf: stored.pack.conf, dconf: stored.pack.dconf }, { scheduling: false, media: true });
  const link = await publishArchive(localId, bytes);
  const key = /[?&]k=([A-Za-z0-9_-]{43})/.exec(link)?.[1] ?? '';
  const reply = await classAct(code, 'addPack', { name, key });
  if (!reply.ok) return { ok: false, error: reply.error };
  const added = reply.view.packs.find((p) => p.key === key);
  if (added) linkClassPack(code, added.id, localId);
  return { ok: true, view: reply.view };
}

/** Mitglied: ein Paket der Klasse auf dieses Gerät holen. Der Lernstand beginnt neu. */
export async function adoptClassPack(code: string, pack: ClassPack): Promise<string | 'missing' | 'error'> {
  const bytes = await fetchArchive(pack.key);
  if (typeof bytes === 'string') return bytes;
  try {
    const data = await importApkg(bytes);
    const id = await saveApkgPack(pack.name, withoutScheduling(data));
    linkClassPack(code, pack.id, id);
    return id;
  } catch {
    return 'error';
  }
}

// ---------------------------------------------------------------- Lernstand

export interface PackProgress {
  id: string;
  cards: number;
  learned: number;
  review: number;
  due: number;
  lapses: number;
  answers7: number;
  streak: number;
  /** Die schwächsten Karten: [Notiz-Kennung (guid), Art, Wiederholungen, Vergessen, Intervall in Tagen]. */
  weak: [string, number, number, number, number][];
}
export interface ProgressPayload {
  v: 1;
  at: number;
  packs: PackProgress[];
}

export const WEAK_MAX = 150;

/** Der Lernstand der Klassenpakete auf diesem Gerät. Pakete, die noch nicht übernommen wurden, fehlen. */
export async function buildProgress(code: string, packs: readonly ClassPack[], now = Date.now()): Promise<ProgressPayload> {
  const links = classPackLinks(code);
  const out: PackProgress[] = [];
  for (const classPack of packs) {
    const localId = links[classPack.id];
    const pack = localId ? await loadPackLight(localId) : null;
    if (!pack) continue;
    const crt = pack.crt ?? localMidnight(now);
    const cards: ApkgCard[] = reconcileCards(pack.collection, pack.cards);
    const guids = new Map(pack.collection.notes.map((n) => [n.id, n.guid]));
    const today = dayNumber(crt, now);
    const days = new Set(pack.revlog.map((r) => dayNumber(crt, r.id)));
    const learnt = cards.filter((c) => c.type > 0);
    const weak = learnt
      .filter((c) => c.lapses > 0 || isDue(c, crt, now))
      .sort((a, b) => b.lapses - a.lapses || a.due - b.due)
      .slice(0, WEAK_MAX)
      .map((c): [string, number, number, number, number] => [guids.get(c.nid) ?? '', c.type, c.reps, c.lapses, c.ivl]);
    out.push({
      id: classPack.id,
      cards: cards.length,
      learned: learnt.length,
      review: cards.filter((c) => c.type === 2).length,
      due: learnt.filter((c) => isDue(c, crt, now)).length,
      lapses: cards.reduce((sum, c) => sum + c.lapses, 0),
      answers7: pack.revlog.filter((r) => r.id > now - 7 * 86_400_000).length,
      streak: streakOf(days, today),
      weak,
    });
  }
  return { v: 1, at: now, packs: out };
}

/** Legt den eigenen Lernstand verschlüsselt für die Leitung ab (nur mit Einwilligung, eingeschaltetem Lernstand und vorhandenem Schlüssel). */
export async function sendProgress(code: string, view: ClassView): Promise<boolean> {
  if (!view.me || view.lead || !view.learning || !hasLearningConsent(code) || view.leadKeys.length === 0 || view.packs.length === 0) return false;
  const payload = await buildProgress(code, view.packs);
  if (payload.packs.length === 0) return false;
  const blob = await sealProgress(payload, view.leadKeys);
  const reply = await classAct(code, 'progress', { blob });
  return reply.ok;
}

/** Widerruf: nichts mehr senden und das Abgelegte beim Server löschen. */
export async function withdrawProgress(code: string): Promise<void> {
  setLearningConsent(code, false);
  await classAct(code, 'progress', { blob: '' });
}

export interface MemberProgress {
  id: string;
  at: number;
  data: ProgressPayload | null;
}

/** Leitung: die abgelegten Stände holen und mit dem eigenen Schlüssel öffnen. */
export async function loadMemberProgress(code: string, leadId: string): Promise<MemberProgress[] | null> {
  const keys = loadLeadKeys();
  if (!keys) return null;
  const reply = await classData<{ progress?: { id: string; at: number; blob: string }[] }>(code, 'getProgress');
  if (!reply || !Array.isArray(reply.progress)) return null;
  return Promise.all(
    reply.progress.map(async (entry) => {
      const value = (await openProgress(entry.blob, leadId, keys.priv)) as ProgressPayload | null;
      return { id: entry.id, at: entry.at, data: value && value.v === 1 && Array.isArray(value.packs) ? value : null };
    }),
  );
}

/** Der Text der Vorderseite einer Notiz im Paket der Leitung (für die Liste schwacher Karten). */
export async function frontTexts(code: string, classPackId: string): Promise<Map<string, string>> {
  const localId = classPackLinks(code)[classPackId];
  const pack = localId ? await loadPackLight(localId) : null;
  return new Map((pack?.collection.notes ?? []).map((n) => [n.guid, stripHtmlKeepMedia(n.fields[0] ?? '').replace(/\s+/g, ' ').trim().slice(0, 80)]));
}

// ---------------------------------------------------------------- Fällige Karten der Klasse

export const DUE_CONSENT_KEY = 'brett-und-blatt:klassenfaellig';
export const hasDueConsent = (code: string): boolean => (read(DUE_CONSENT_KEY) as Record<string, boolean> | null)?.[code] === true;
export function setDueConsent(code: string, on: boolean): void {
  const all = (read(DUE_CONSENT_KEY) as Record<string, boolean> | null) ?? {};
  if (on) all[code] = true;
  else delete all[code];
  write(DUE_CONSENT_KEY, all);
}

/** Die Kennungen (guid der Notiz) der Karten der Klassenpakete, die bei diesem Gerät jetzt fällig sind. Keine Namen, keine Zahlen. */
export async function buildDue(code: string, packs: readonly ClassPack[], now = Date.now()): Promise<string[]> {
  const links = classPackLinks(code);
  const out = new Set<string>();
  for (const classPack of packs) {
    const localId = links[classPack.id];
    const pack = localId ? await loadPackLight(localId) : null;
    if (!pack) continue;
    const crt = pack.crt ?? localMidnight(now);
    const guids = new Map(pack.collection.notes.map((n) => [n.id, n.guid]));
    for (const card of reconcileCards(pack.collection, pack.cards)) {
      const guid = guids.get(card.nid);
      if (guid && card.type > 0 && isDue(card, crt, now) && /^[\x21-\x7e]{1,40}$/.test(guid)) out.add(guid);
    }
  }
  return [...out].slice(0, 300);
}

/** Meldet anonym die fälligen Karten (nur mit Einwilligung und eingeschaltetem Sammeln). */
export async function sendDue(code: string, view: ClassView): Promise<boolean> {
  if (!view.me || !view.dueCards || !hasDueConsent(code) || view.packs.length === 0) return false;
  const reply = await classAct(code, 'due', { cards: await buildDue(code, view.packs) });
  return reply.ok;
}

export async function withdrawDue(code: string): Promise<void> {
  setDueConsent(code, false);
  await classAct(code, 'due', { cards: [] });
}

export interface DueAggregate {
  on: boolean;
  reporters: number;
  cards: { card: string; n: number }[];
}
export const loadDueAggregate = (code: string): Promise<DueAggregate | null> => classData<DueAggregate>(code, 'dueCards');

/**
 * Der Link zu einem Klassenspiel „Paare finden“: die Paare des Klassenpakets, die fälligen Karten zuerst (höchstens 18). Wer den Link öffnet,
 * spielt allein am eigenen Gerät; das Spiel kennt keine Namen. Liefert null, wenn das Paket auf diesem Gerät fehlt oder zu wenige Paare hat.
 */
export async function classGameLink(code: string, classPack: ClassPack, due: readonly { card: string; n: number }[]): Promise<{ link: string; pairs: number; preferred: number } | null> {
  const localId = classPackLinks(code)[classPack.id];
  const pack = localId ? await loadPackLight(localId) : null;
  if (!pack) return null;
  const rows = packsOf(pack.collection).flatMap((p) => p.rows);
  if (rows.length < 6) return null;
  const ids = new Map(pack.collection.notes.map((n) => [rowIdOf(n.id), n.guid]));
  const wanted = new Set(due.map((d) => d.card));
  const prefer = new Set(rows.filter((row) => wanted.has(ids.get(row.id) ?? '')).map((row) => row.id));
  const value = encodePairsOption({ name: classPack.name, rows }, (n) => Math.floor(Math.random() * n), prefer);
  const link = `${window.location.origin}${window.location.pathname}#/neu/pairs?pack=${encodeURIComponent(value)}&autostart=1`;
  return { link, pairs: Math.min(rows.length, 18), preferred: Math.min(prefer.size, 18) };
}

// ---------------------------------------------------------------- Abgleich im Hintergrund

let timer: number | undefined;
let soon: number | undefined;

async function syncAll(): Promise<void> {
  for (const known of loadClasses()) {
    if (!hasLearningConsent(known.code) && !hasDueConsent(known.code)) continue;
    const reply = await classAct(known.code, 'view');
    if (!reply.ok) continue;
    if (hasLearningConsent(known.code)) await sendProgress(known.code, reply.view).catch(() => false);
    if (hasDueConsent(known.code)) await sendDue(known.code, reply.view).catch(() => false);
  }
}

/** Einmal beim Start: der Lernstand geht alle fünf Minuten und kurz nach dem Lernen an die Leitung (nur bei Einwilligung). */
export function startClassProgressSync(): void {
  if (timer !== undefined) return;
  void syncAll();
  timer = window.setInterval(() => void syncAll(), 5 * 60_000);
  window.addEventListener('bub-learn-changed', () => {
    window.clearTimeout(soon);
    soon = window.setTimeout(() => void syncAll(), 15_000);
  });
}
export const announceLearning = (): void => void window.dispatchEvent(new Event('bub-learn-changed'));
export { currentArchiveLink };
