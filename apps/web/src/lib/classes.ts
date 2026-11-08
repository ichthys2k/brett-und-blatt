import type { ClassView } from '@brett-und-blatt/online';
import { serializeCrest } from '@brett-und-blatt/engine';
import { currentCrest, hasCrest } from './crestStore';
import { GAME_SERVER } from './server';
import { storage } from './storage';

/*
 * Klassen im Browser (#150): Aufrufe an den Spieleserver und die Merkliste dieses Passes.
 * Die Geräte-Kennung (`storage.deviceToken()`) weist das Mitglied aus; sie geht nie in eine Ansicht.
 */

export const CLASSES_KEY = 'brett-und-blatt:klassen';
export interface KnownClass {
  code: string;
  name: string;
}

export function loadClasses(): KnownClass[] {
  try {
    const list = JSON.parse(window.localStorage.getItem(CLASSES_KEY) ?? '[]');
    return Array.isArray(list) ? list.filter((c): c is KnownClass => typeof c?.code === 'string' && typeof c?.name === 'string').slice(0, 20) : [];
  } catch {
    return [];
  }
}
export function rememberClass(entry: KnownClass): void {
  const others = loadClasses().filter((c) => c.code !== entry.code);
  try {
    window.localStorage.setItem(CLASSES_KEY, JSON.stringify([entry, ...others].slice(0, 20)));
  } catch {
    // ohne Speicher gibt es keine Merkliste; die Klasse bleibt auf dem Server
  }
}
export function forgetClass(code: string): void {
  try {
    window.localStorage.setItem(CLASSES_KEY, JSON.stringify(loadClasses().filter((c) => c.code !== code)));
  } catch {
    // nichts zu tun
  }
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
