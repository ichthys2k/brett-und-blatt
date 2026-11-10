import { CARD_SECTIONS, DEFAULT_CARD_SECTIONS, type CardSection, type CardSections, type ClassCard, type ClassView } from '@brett-und-blatt/online';
import { serializeCrest } from '@brett-und-blatt/engine';
import { currentCrest, hasCrest } from './crestStore';
import { GAME_SERVER } from './server';
import { buildSnapshot } from './passShare';
import { storage } from './storage';
import { ALBUM_KEY, sanitizeAlbum } from './album';
import { loadBook } from './chronikStore';
import { levelStats, ratingOf } from './botRating';
import { onGameRecorded } from './passRecorder';

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
    return Array.isArray(list) ? list.filter((x): x is CardSection => (CARD_SECTIONS as readonly string[]).includes(x)) : [];
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
  updateClassCardsSoon(0);
}

/** Die eigene Klassenkarte: nur, was die Klasse erlaubt und das Mitglied nicht ausgeblendet hat. */
export function buildClassCard(allowed: Record<CardSection, boolean>): Omit<ClassCard, 'at'> {
  const hidden = hiddenSections();
  const card: Omit<ClassCard, 'at'> = {};

  const shareSections = (['stamps', 'trophies', 'favorites'] as const).filter((section) => allowed[section] && !hidden.includes(section));
  if (shareSections.length > 0) {
    const snapshot = buildSnapshot(shareSections);
    if (snapshot?.stamps && allowed.stamps && !hidden.includes('stamps')) card.stamps = snapshot.stamps;
    if (snapshot?.trophies && allowed.trophies && !hidden.includes('trophies')) {
      const counts = new Map<string, number>();
      for (const trophy of snapshot.trophies) counts.set(trophy.gameId, (counts.get(trophy.gameId) ?? 0) + 1);
      card.trophies = [...counts].map(([gameId, count]) => ({ gameId, count }));
    }
    if (snapshot?.favorites && allowed.favorites && !hidden.includes('favorites')) card.favorites = snapshot.favorites;
  }

  if (allowed.album && !hidden.includes('album')) {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(ALBUM_KEY) : null;
      const album = sanitizeAlbum(raw ? JSON.parse(raw) : null);
      const entries = Object.entries(album).flatMap(([gameId, ch]) => {
        const count = Object.keys(ch.found ?? {}).length;
        return count > 0 ? [{ gameId, count }] : [];
      });
      if (entries.length > 0) card.album = entries;
    } catch {
      // ohne Album
    }
  }

  if (allowed.botRating && !hidden.includes('botRating')) {
    try {
      const book = loadBook();
      const allGames = new Set<string>();
      for (const games of Object.values(book.counts)) {
        for (const [id, buckets] of Object.entries(games)) {
          if (Object.keys(buckets).some((k) => k.startsWith('bots/'))) allGames.add(id);
        }
      }
      const botRatings = [...allGames].flatMap((gameId) => {
        const stats = levelStats(book, gameId);
        const games = stats.easy.played + stats.medium.played + stats.hard.played;
        const wins = stats.easy.won + stats.medium.won + stats.hard.won;
        if (games === 0) return [];
        const r = ratingOf(stats);
        return [{ gameId, games, ...(r.rating !== null ? { rating: r.rating } : {}), wins }];
      });
      if (botRatings.length > 0) card.botRating = botRatings;
    } catch {
      // ohne Bot-Wertung
    }
  }

  return card;
}

let updateCardsTimer: ReturnType<typeof setTimeout> | null = null;
const lastSentCardPerClass = new Map<string, string>();

/** Merkt sich die gesendete Karte, um doppeltes Senden zu vermeiden. */
export function markCardSent(code: string, card: Omit<ClassCard, 'at'>): void {
  lastSentCardPerClass.set(code, JSON.stringify(card));
}

/** Führt die Klassenkarte in allen bekannten Klassen nach, wenn sich der Spielstand geändert hat (#151). */
export function updateClassCardsSoon(delayMs = 1200): void {
  if (typeof window === 'undefined' || !GAME_SERVER) return;
  if (updateCardsTimer) clearTimeout(updateCardsTimer);
  updateCardsTimer = setTimeout(() => {
    updateCardsTimer = null;
    void updateClassCardsNow();
  }, delayMs);
}

export async function updateClassCardsNow(): Promise<void> {
  const classes = loadClasses();
  if (classes.length === 0) return;
  const card = buildClassCard(DEFAULT_CARD_SECTIONS);
  const cardKey = JSON.stringify(card);

  for (const c of classes) {
    if (lastSentCardPerClass.get(c.code) === cardKey) continue;
    try {
      const reply = await classAct(c.code, 'card', { card });
      if (reply.ok) {
        lastSentCardPerClass.set(c.code, cardKey);
      } else if (reply.status === 404) {
        forgetClass(c.code);
      }
    } catch {
      // stiller Hintergrund-Abgleich
    }
  }
}

// Nach jedem Partieende oder Fund werden die Klassenkarten aller gemerkten Klassen nachgeführt (#151).
if (typeof window !== 'undefined') {
  onGameRecorded(() => {
    updateClassCardsSoon();
  });
}

