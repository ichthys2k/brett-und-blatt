import type { ClassView } from '@brett-und-blatt/online';
import { serializeCrest } from '@brett-und-blatt/engine';
import { currentCrest, hasCrest, onCrestSaved } from './crestStore';
import { GAME_SERVER } from './server';
import { buildSnapshot } from './passShare';
import { storage } from './storage';
import type { CardSection, ClassCard } from '@brett-und-blatt/online';

/*
 * Klassen im Browser (#150): Aufrufe an den Spieleserver und die Merkliste dieses Passes.
 * Die Geräte-Kennung (`storage.deviceToken()`) weist das Mitglied aus; sie geht nie in eine Ansicht.
 */

import { requestPassSync } from '@brett-und-blatt/ui/sync';

export const CLASSES_KEY = 'brett-und-blatt:klassen';
export interface KnownClass {
  code: string;
  name: string;
  /** Zeitpunkt der letzten Änderung (Hinzufügen oder Entfernen), jüngerer Eintrag gewinnt beim Abgleich. */
  at?: number;
  /** Löschvermerk für den Abgleich über den Ausweis: auf einem anderen Gerät entfernt. */
  removed?: boolean;
}

/** Bereinigt Klassen-Einträge aus dem Speicher oder entfernten Quellen. */
export function sanitizeKnownClasses(value: unknown): KnownClass[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((c): c is KnownClass => !!c && typeof c.code === 'string' && typeof c.name === 'string')
    .map((c) => ({
      code: c.code,
      name: c.name.slice(0, 40),
      ...(typeof c.at === 'number' ? { at: c.at } : {}),
      ...(c.removed ? { removed: true } : {}),
    }))
    .slice(0, 50);
}

/** Führt die lokale und entfernte Klassenliste zusammen; das jüngere Datum je Code entscheidet. */
export function mergeKnownClasses(remote: KnownClass[], local: KnownClass[]): KnownClass[] {
  const map = new Map<string, KnownClass>();
  for (const item of sanitizeKnownClasses(local)) map.set(item.code, item);
  for (const item of sanitizeKnownClasses(remote)) {
    const existing = map.get(item.code);
    if (!existing) {
      map.set(item.code, item);
    } else {
      const localAt = existing.at ?? 0;
      const remoteAt = item.at ?? 0;
      if (remoteAt >= localAt) {
        map.set(item.code, item);
      }
    }
  }
  return Array.from(map.values()).slice(0, 50);
}

/** Prüft, ob zwei Klassenlisten inhaltlich identisch sind. */
export function sameKnownClasses(a: KnownClass[], b: KnownClass[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((item, i) => item.code === b[i]?.code && item.name === b[i]?.name && !!item.removed === !!b[i]?.removed && item.at === b[i]?.at);
}

/** Alle gemerkten Klassen, die nicht gelöscht wurden (für die Ansicht). */
export function loadClasses(): KnownClass[] {
  try {
    const list = JSON.parse(window.localStorage.getItem(CLASSES_KEY) ?? '[]');
    return Array.isArray(list)
      ? list.filter((c): c is KnownClass => typeof c?.code === 'string' && typeof c?.name === 'string' && !c.removed).slice(0, 20)
      : [];
  } catch {
    return [];
  }
}

/** Alle gemerkten Klassen inkl. Löschvermerke (für den Abgleich mit dem Pass). */
export function loadAllClassEntries(): KnownClass[] {
  try {
    const list = JSON.parse(window.localStorage.getItem(CLASSES_KEY) ?? '[]');
    return sanitizeKnownClasses(list);
  } catch {
    return [];
  }
}

export function rememberClass(entry: { code: string; name: string }): void {
  const others = loadAllClassEntries().filter((c) => c.code !== entry.code);
  const updated: KnownClass = { code: entry.code, name: entry.name, at: Date.now(), removed: false };
  try {
    window.localStorage.setItem(CLASSES_KEY, JSON.stringify([updated, ...others].slice(0, 50)));
  } catch {
    // ohne Speicher gibt es keine Merkliste; die Klasse bleibt auf dem Server
  }
  requestPassSync();
}

export function forgetClass(code: string): void {
  const all = loadAllClassEntries();
  const found = all.find((c) => c.code === code);
  const others = all.filter((c) => c.code !== code);
  const updated: KnownClass = found
    ? { ...found, removed: true, at: Date.now() }
    : { code, name: '', removed: true, at: Date.now() };
  try {
    window.localStorage.setItem(CLASSES_KEY, JSON.stringify([updated, ...others].slice(0, 50)));
  } catch {
    // nichts zu tun
  }
  requestPassSync();
}

function identity(): { token: string; name: string; avatar: string; crest?: string } {
  const profile = storage.loadProfile();
  return { token: storage.deviceToken(), name: profile?.name ?? '', avatar: profile?.avatar ?? '', ...(hasCrest() ? { crest: serializeCrest(currentCrest()) } : {}) };
}

export type ClassReply = { ok: true; view: ClassView } | { ok: false; status: number; error: string; view?: ClassView };

export async function createClassOnServer(className: string): Promise<{ code: string } | { error: string }> {
  if (!GAME_SERVER) return { error: 'Es gibt gerade keinen Spieleserver.' };
  try {
    const response = await fetch(`${GAME_SERVER}/klassen`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...identity(), className }) });
    if (response.status === 201) return (await response.json()) as { code: string };
    return { error: response.status === 400 ? 'Der Name der Klasse oder dein Profil ist nicht erlaubt.' : 'Das hat nicht geklappt. Bitte später noch einmal versuchen.' };
  } catch {
    return { error: 'Keine Verbindung zum Spieleserver.' };
  }
}

/** Eine Aktion in einer Klasse; `view` fragt nur den Stand ab. */
export async function classAct(code: string, action: string, extra: Record<string, unknown> = {}): Promise<ClassReply> {
  if (!GAME_SERVER) return { ok: false, status: 0, error: 'Es gibt gerade keinen Spieleserver.' };
  try {
    const response = await fetch(`${GAME_SERVER}/klassen/${encodeURIComponent(code)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...(action === 'join' || action === 'update' ? identity() : { token: storage.deviceToken() }), ...extra, action }),
    });
    const data = (await response.json().catch(() => ({}))) as { view?: ClassView; error?: string };
    if (response.ok && data.view) return { ok: true, view: data.view };
    if (response.ok) return { ok: false, status: 200, error: '' };
    return { ok: false, status: response.status, error: data.error === 'rate' ? 'Zu viele Versuche. Bitte später noch einmal.' : (data.error ?? 'Fehler'), ...(data.view ? { view: data.view } : {}) };
  } catch {
    return { ok: false, status: 0, error: 'Keine Verbindung zum Spieleserver.' };
  }
}

/** Eine Aktion, deren Antwort Daten statt der Klassenansicht enthält (z. B. `getProgress`). */
export async function classData<T>(code: string, action: string, extra: Record<string, unknown> = {}): Promise<T | null> {
  if (!GAME_SERVER) return null;
  try {
    const response = await fetch(`${GAME_SERVER}/klassen/${encodeURIComponent(code)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: storage.deviceToken(), ...extra, action }) });
    return response.ok ? ((await response.json()) as T) : null;
  } catch {
    return null;
  }
}

const HIDE_KEY = 'brett-und-blatt:klassen-ausblenden';
/** Teile, die dieses Mitglied den anderen nicht zeigen will (dieser Pass, nur weglassen). */
export function hiddenSections(): CardSection[] {
  try {
    const list = JSON.parse(window.localStorage.getItem(HIDE_KEY) ?? '[]');
    return Array.isArray(list) ? list.filter((x): x is CardSection => x === 'stamps' || x === 'trophies' || x === 'favorites') : [];
  } catch {
    return [];
  }
}
export function setSectionHidden(section: CardSection, hidden: boolean): void {
  const next = hiddenSections().filter((x) => x !== section);
  if (hidden) next.push(section);
  try {
    window.localStorage.setItem(HIDE_KEY, JSON.stringify(next));
  } catch {
    // ohne Speicher gilt die Wahl nur bis zum Schließen
  }
}

/** Die eigene Klassenkarte: nur, was die Klasse erlaubt und das Mitglied nicht ausgeblendet hat. */
export function buildClassCard(allowed: Record<CardSection, boolean>): Omit<ClassCard, 'at'> {
  const hidden = hiddenSections();
  const use = (['stamps', 'trophies', 'favorites'] as const).filter((section) => allowed[section] && !hidden.includes(section));
  const snapshot = buildSnapshot(use);
  const card: Omit<ClassCard, 'at'> = {};
  if (snapshot?.stamps) card.stamps = snapshot.stamps;
  if (snapshot?.trophies) {
    const counts = new Map<string, number>();
    for (const trophy of snapshot.trophies) counts.set(trophy.gameId, (counts.get(trophy.gameId) ?? 0) + 1);
    card.trophies = [...counts].map(([gameId, count]) => ({ gameId, count }));
  }
  if (snapshot?.favorites) card.favorites = snapshot.favorites;
  return card;
}

/** Aktualisiert Name, Bild und Wappen bei allen Klassen, in denen man Mitglied ist (#150). */
export function updateClassesAfterProfileChange(): void {
  const classes = loadClasses();
  if (classes.length === 0) return;
  for (const item of classes) {
    void classAct(item.code, 'update').catch(() => undefined);
  }
}

onCrestSaved(updateClassesAfterProfileChange);


