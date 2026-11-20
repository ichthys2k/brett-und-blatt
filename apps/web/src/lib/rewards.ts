import { useSyncExternalStore } from 'react';
import { loadBook } from './chronikStore';
import { passBook } from './passes';
import { passSyncSoon, syncPassEntry } from './playerPass';
import { games } from './registry';
import { LEVELS, levelOf, type Level } from './stufen';
import { loadJesterAtelier, loadLearnDays } from './unlockSources';
import { buildProgress, type Progress } from './unlocks';

/*
 * Anzeige der Stufen (Belohnungskonzept #324, Schritte #573 und #574): Schalter „Belohnungen nicht anzeigen“, die zuletzt
 * gesehene Stufe und die Entscheidung, ob ein Hinweis erscheint. Die Entscheidung ist eine reine Funktion (`noticeFor`);
 * der Speicher liegt in `localStorage` unter zwei Schlüsseln, die als `belohnungen` und `stufe-gesehen` im Block
 * `einstellungen` mit dem Pass reisen. Die Stufe selbst wird nie gespeichert, sie ergibt sich aus den Zählern (`stufen.ts`).
 */

export const REWARDS_HIDDEN_KEY = 'brett-und-blatt:belohnungen';
export const LEVEL_SEEN_KEY = 'brett-und-blatt:stufe-gesehen';

export interface RewardNotice {
  /** `collected`: gesammelter Hinweis beim Start (rückwirkender Aufstieg); `up`: Aufstieg in einer Partie. */
  kind: 'up' | 'collected';
  rank: number;
  title: string;
  /** Text der ruhigen Zeile (zugleich für Screenreader). */
  text: string;
}

export interface NoticeInput {
  /** Zuletzt gesehene Stufe (0 bis 4); `null`: noch nie gespeichert, also erster Start nach der Einführung. */
  seen: number | null;
  /** Stufe aus den Zählern jetzt. */
  current: number;
  /** „Belohnungen nicht anzeigen“. */
  hidden: boolean;
  /** Gast-Pass: nie ein Hinweis. */
  guest: boolean;
  /** `start`: beim Start der App; `game`: nach einer Partie. */
  moment: 'start' | 'game';
}

/** Soll ein Hinweis erscheinen, und welche Stufe gilt danach als gesehen (`null`: nichts speichern)? Rein, ohne Speicher. */
export function noticeFor(input: NoticeInput): { show: 'up' | 'collected' | null; store: number | null } {
  const { seen, current, hidden, guest, moment } = input;
  if (guest) return { show: null, store: null };
  const rank = Math.max(0, Math.floor(current));
  if (seen === null) {
    // Erster Start nach der Einführung: wer schon Stufen hat, bekommt EINEN gesammelten Hinweis; danach gilt die Stufe als gesehen.
    // Endet vorher schon eine Partie, ist das kein rückwirkender Aufstieg mehr: still als gesehen merken.
    if (moment === 'game') return { show: null, store: rank };
    return { show: rank > 0 && !hidden ? 'collected' : null, store: rank };
  }
  if (rank <= seen) return { show: null, store: null };
  // Aufstieg seit dem letzten Sehen: nach einer Partie ein einzelner Hinweis, beim Start (z. B. nach Spiel auf anderem Gerät) ein gesammelter.
  return { show: hidden ? null : moment === 'game' ? 'up' : 'collected', store: rank };
}

/** Text der ruhigen Zeile. */
export function noticeText(kind: 'up' | 'collected', level: Level): string {
  return kind === 'up' ? `Neuer Titel: ${level.title}` : `Du bist jetzt ${level.title}. Schön, dass du dabei bist.`;
}

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Speicher gesperrt: der Hinweis fällt dann einfach weg
  }
}

export const rewardsHidden = (): boolean => read(REWARDS_HIDDEN_KEY) === 'aus';

const hiddenListeners = new Set<() => void>();

/** Für die Oberfläche: zeichnet neu, sobald der Schalter wechselt. */
export function useRewardsHidden(): boolean {
  return useSyncExternalStore(
    (listener) => {
      hiddenListeners.add(listener);
      return () => hiddenListeners.delete(listener);
    },
    rewardsHidden,
    () => false,
  );
}

export function setRewardsHidden(hidden: boolean): void {
  write(REWARDS_HIDDEN_KEY, hidden ? 'aus' : null);
  for (const listener of hiddenListeners) listener();
  syncPassEntry();
  passSyncSoon();
}

/** Liest die gespeicherte Stufe streng: nur eine Ziffer innerhalb der Stufenleiter, sonst „nie gesehen“. */
export function parseSeen(raw: string | null): number | null {
  if (raw === null || !/^\d$/.test(raw)) return null;
  const rank = Number(raw);
  return rank < LEVELS.length ? rank : null;
}

/** Die Zähler des aktiven Passes (ohne Entwürfe), Grundlage der Stufe. */
export function currentProgress(): Progress {
  return buildProgress({ book: loadBook(), learnDays: loadLearnDays(), jesterAtelier: loadJesterAtelier(), knownGameIds: new Set(games.map((game) => game.id)) });
}

/** Prüft, ob jetzt ein Hinweis fällig ist, und merkt sich die Stufe als gesehen. Gäste und Fehler: kein Hinweis. */
export function checkNotice(moment: 'start' | 'game'): RewardNotice | null {
  try {
    if (passBook.activeIsGuest()) return null;
    const level = levelOf(currentProgress());
    const decision = noticeFor({ seen: parseSeen(read(LEVEL_SEEN_KEY)), current: level.rank, hidden: rewardsHidden(), guest: false, moment });
    if (decision.store !== null) {
      write(LEVEL_SEEN_KEY, String(decision.store));
      syncPassEntry();
      passSyncSoon();
    }
    return decision.show ? { kind: decision.show, rank: level.rank, title: level.title, text: noticeText(decision.show, level) } : null;
  } catch {
    return null;
  }
}
