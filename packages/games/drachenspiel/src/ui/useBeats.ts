import type { GameEvent, SeatId } from '@brett-und-blatt/engine';
import { useEffect, useRef, useState } from 'react';
import type { DrachenspielView } from '../types';
import { buildBeats, type Beat } from './sequence';

const LOG_LENGTH = 40;

interface Run {
  events: GameEvent[];
  beats: Beat[];
  index: number;
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

/**
 * Spielt die Ereignisse eines Zugs Schritt für Schritt ab. Liefert den laufenden Schritt oder null,
 * wenn nichts mehr läuft und die echte Sicht gilt. Kommt mitten drin der nächste Zug, beginnt dessen
 * Reihe sofort; die Regeln hängen nie an der Wiedergabe.
 */
export function useBeats(view: DrachenspielView, events: GameEvent[], nameOf: (seat: SeatId) => string) {
  const committedView = useRef(view);
  const [run, setRun] = useState<Run>({ events, beats: [], index: 0 });
  const [log, setLog] = useState<string[]>([]);

  let current = run;
  if (run.events !== events) {
    current = { events, beats: buildBeats(events, committedView.current, nameOf, prefersReducedMotion()), index: 0 };
    setRun(current);
  }

  useEffect(() => {
    committedView.current = view;
  });

  const beat = current.beats[current.index] ?? null;

  useEffect(() => {
    if (!beat) return;
    const timer = window.setTimeout(() => {
      setRun((latest) => (latest.events === events ? { ...latest, index: latest.index + 1 } : latest));
    }, beat.durationMs);
    return () => window.clearTimeout(timer);
  }, [beat, events]);

  useEffect(() => {
    if (beat && beat.log.length > 0) setLog((previous) => [...previous, ...beat.log].slice(-LOG_LENGTH));
  }, [beat]);

  return { beat, log };
}
