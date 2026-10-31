import type { GameEvent } from '@brett-und-blatt/engine';
import { useRef } from 'react';

/**
 * Zählt mit, wie oft neue Ereignisse eine bestimmte Art enthielten – der Wert wechselt genau dann,
 * wenn ein passendes Ereignis neu hinzukommt. Beim ersten Zeichnen zählt nichts, damit ein
 * geöffnetes Spiel keine alten Effekte abspielt. Gut als `key` oder Auslöser für Animationen.
 */
export function useEventCounter(events: GameEvent[], match: (event: GameEvent) => boolean): number {
  return useLatestEvent(events, match).count;
}

/** Wie `useEventCounter`, liefert zusätzlich das zuletzt passende Ereignis (bleibt bis zum nächsten stehen). */
export function useLatestEvent(events: GameEvent[], match: (event: GameEvent) => boolean): { count: number; event: GameEvent | null } {
  const state = useRef<{ events: GameEvent[]; count: number; event: GameEvent | null }>({ events, count: 0, event: null });
  if (state.current.events !== events) {
    state.current.events = events;
    const found = events.find(match);
    if (found) {
      state.current.count += 1;
      state.current.event = found;
    }
  }
  return { count: state.current.count, event: state.current.event };
}

export interface ScorePopProps {
  /** Angezeigter Wert; Zahlen bekommen ein Vorzeichen („+12“). */
  value: number | string;
  /** Wechselt er, steigt das Fähnchen neu auf (z. B. aus `useEventCounter`). 0 zeigt nichts. */
  trigger: number;
  /** Großer, goldener Auftritt für seltene Glanzleistungen (Prämie, volle Reihe). */
  big?: boolean;
  className?: string;
}

/**
 * Punkte-Fähnchen: „+12“ springt auf, steigt nach oben und verblasst (etwa 1,3 s). Wird in ein
 * Element mit `position: relative` gelegt, z. B. eine Zelle von `GridBoard`, und erscheint
 * mittig darüber. Für Vorleseprogramme unsichtbar – die Punkte stehen ohnehin in der Anzeige.
 */
export function ScorePop({ value, trigger, big, className = '' }: ScorePopProps) {
  if (!trigger) return null;
  const text = typeof value === 'number' ? (value > 0 ? `+${value}` : String(value)) : value;
  return (
    <span key={trigger} className={`bub-pop ${className}`} data-big={big || undefined} aria-hidden="true">
      {text}
    </span>
  );
}
