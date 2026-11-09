import type { PointScheme, SeriesView } from '@brett-und-blatt/online';
import { GAME_SERVER } from './server';
import { storage } from './storage';

/*
 * Serien auf dem Server (#205): Anlegen, Anzeigen, Verwalten. Die Leitung der Serie ist das anlegende Gerät
 * (Geräte-Kennung als `Authorization: Bearer`); bekannte Serien merkt sich das Gerät in `localStorage`.
 */

const KNOWN_KEY = 'brett-und-blatt:serien';

export interface KnownSeries {
  code: string;
  name: string;
}

export function knownSeries(): KnownSeries[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KNOWN_KEY) ?? '[]') as unknown;
    return Array.isArray(raw) ? raw.filter((s): s is KnownSeries => typeof s?.code === 'string' && typeof s?.name === 'string').slice(0, 30) : [];
  } catch {
    return [];
  }
}

export function rememberSeries(series: KnownSeries): void {
  try {
    localStorage.setItem(KNOWN_KEY, JSON.stringify([series, ...knownSeries().filter((s) => s.code !== series.code)].slice(0, 30)));
  } catch {
    // Ohne Speicher bleibt die Serie nur über den Link erreichbar.
  }
}

export function forgetSeries(code: string): void {
  try {
    localStorage.setItem(KNOWN_KEY, JSON.stringify(knownSeries().filter((s) => s.code !== code)));
  } catch {
    // nichts zu tun
  }
}

const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${storage.deviceToken()}` });

/** Legt eine Serie an und gibt ihren Code zurück. */
export async function createSeries(name: string, scheme: PointScheme): Promise<string> {
  const response = await fetch(`${GAME_SERVER}/serien`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, scheme, token: storage.deviceToken() }) });
  if (!response.ok) throw new Error(`Server antwortet mit ${response.status}`);
  const { code } = (await response.json()) as { code: string };
  rememberSeries({ code, name: name.trim() });
  return code;
}

/** Lädt die Sicht; null, wenn es die Serie nicht gibt, `'failed'` bei Netzfehlern. */
export async function fetchSeries(code: string): Promise<SeriesView | null | 'failed'> {
  if (!GAME_SERVER) return 'failed';
  try {
    const response = await fetch(`${GAME_SERVER}/serien/${encodeURIComponent(code)}`, { headers: headers() });
    if (response.status === 404) return null;
    if (!response.ok) return 'failed';
    return (await response.json()) as SeriesView;
  } catch {
    return 'failed';
  }
}

export type SeriesAction = { action: 'rename'; name: string } | { action: 'scheme'; scheme: PointScheme } | { action: 'remove'; tournament: string } | { action: 'extend' } | { action: 'newKey' };

/** Verwaltungsaktion; gibt einen Fehlertext zurück oder null bei Erfolg. */
export async function manageSeries(code: string, action: SeriesAction): Promise<string | null> {
  try {
    const response = await fetch(`${GAME_SERVER}/serien/${encodeURIComponent(code)}`, { method: 'POST', headers: headers(), body: JSON.stringify(action) });
    if (response.ok) return null;
    return ((await response.json().catch(() => ({}))) as { error?: string }).error ?? `Server antwortet mit ${response.status}`;
  } catch {
    return 'Keine Verbindung zum Server.';
  }
}

export async function deleteSeries(code: string): Promise<string | null> {
  try {
    const response = await fetch(`${GAME_SERVER}/serien/${encodeURIComponent(code)}`, { method: 'DELETE', headers: headers() });
    if (response.ok) {
      forgetSeries(code);
      return null;
    }
    return ((await response.json().catch(() => ({}))) as { error?: string }).error ?? `Server antwortet mit ${response.status}`;
  } catch {
    return 'Keine Verbindung zum Server.';
  }
}
