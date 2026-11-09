import type { TournamentClientMessage, TournamentServerMessage, TournamentSettings, TournamentView } from '@brett-und-blatt/online';
import { useEffect, useRef, useState } from 'react';
import { GAME_SERVER } from './server';
import { applyOfflineMessage, deleteOfflineRecord, isOfflineCode, loadOfflineRecord, offlineView } from './offlineTournament';
import { storage, type Profile } from './storage';


export async function createTournament(settings: TournamentSettings & { fields?: number }, profile: Profile, entrants: string[] = []): Promise<string> {
  const response = await fetch(`${GAME_SERVER}/turniere`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ settings, token: storage.deviceToken(), name: profile.name, ...(entrants.length > 0 ? { entrants } : {}) }),
  });
  if (!response.ok) throw new Error(`Server antwortet mit ${response.status}`);
  return ((await response.json()) as { code: string }).code;
}

/** Ergebnis eines Löschversuchs. */
export type DeleteOutcome = 'deleted' | 'gone' | 'denied' | 'failed';

/** Gibt es das Turnier noch? null, wenn der Server nicht antwortet. */
export async function tournamentExists(code: string): Promise<boolean | null> {
  if (isOfflineCode(code)) return loadOfflineRecord(code) !== null;
  if (!GAME_SERVER) return null;
  try {
    const response = await fetch(`${GAME_SERVER}/turniere/${encodeURIComponent(code)}`);
    if (!response.ok) return null;
    return ((await response.json()) as { exists?: boolean }).exists !== false;
  } catch {
    return null;
  }
}

/**
 * Löscht ein Turnier auf dem Server (nur die Hauptleitung darf). Öffnet dafür kurz eine eigene
 * Verbindung, damit es auch aus der Liste heraus geht, ohne die Turnierseite zu öffnen.
 */
export function deleteTournament(code: string, profile: Profile): Promise<DeleteOutcome> {
  if (isOfflineCode(code)) {
    const existed = loadOfflineRecord(code) !== null;
    deleteOfflineRecord(code);
    return Promise.resolve(existed ? 'deleted' : 'gone');
  }
  return new Promise((resolve) => {
    if (!GAME_SERVER) return resolve('failed');
    let done = false;
    const ws = new WebSocket(`${GAME_SERVER.replace(/^http/, 'ws')}/turniere/${encodeURIComponent(code)}`);
    const finish = (outcome: DeleteOutcome) => {
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
    const timer = window.setTimeout(() => finish('failed'), 10_000);
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'hello', token: storage.deviceToken(), name: profile.name, avatar: profile.avatar } satisfies TournamentClientMessage));
      ws.send(JSON.stringify({ type: 'delete' } satisfies TournamentClientMessage));
    };
    ws.onmessage = (event) => {
      if (typeof event.data !== 'string') return;
      const message = JSON.parse(event.data) as TournamentServerMessage;
      if (message.type === 'deleted') finish('deleted');
      else if (message.type === 'error' && /Löschen/.test(message.message)) finish('denied');
    };
    ws.onerror = () => {
      // Kein Turnier mehr (404) oder kein Netz: nachfragen.
      void tournamentExists(code).then((exists) => finish(exists === false ? 'gone' : 'failed'));
    };
    ws.onclose = () => {
      void tournamentExists(code).then((exists) => finish(exists === false ? 'deleted' : 'failed'));
    };
  });
}

/**
 * Holt die aktuelle Sicht eines Turniers (für die Serienauswertung): öffnet kurz eine Verbindung, wartet auf den Stand
 * und schließt wieder. null, wenn es das Turnier nicht gibt oder kein Zugang besteht.
 */
export function fetchTournamentView(code: string, profile: Profile): Promise<TournamentView | null> {
  if (isOfflineCode(code)) return Promise.resolve(offlineView(code));
  return new Promise((resolve) => {
    if (!GAME_SERVER) return resolve(null);
    let done = false;
    const ws = new WebSocket(`${GAME_SERVER.replace(/^http/, 'ws')}/turniere/${encodeURIComponent(code)}`);
    const finish = (view: TournamentView | null) => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      try {
        ws.close();
      } catch {
        // Schon zu.
      }
      resolve(view);
    };
    const timer = window.setTimeout(() => finish(null), 10_000);
    ws.onopen = () => ws.send(JSON.stringify({ type: 'hello', token: storage.deviceToken(), name: profile.name, avatar: profile.avatar } satisfies TournamentClientMessage));
    ws.onmessage = (event) => {
      if (typeof event.data !== 'string') return;
      const message = JSON.parse(event.data) as TournamentServerMessage;
      if (message.type === 'tournament') finish(message.view);
      else if (message.type === 'closed' || message.type === 'deleted') finish(null);
    };
    ws.onerror = () => finish(null);
    ws.onclose = () => finish(null);
  });
}

/** Turnier ohne Netz (Stufe 6): derselbe Turnierkern im Browser, Stand in `localStorage`. */
function useOfflineTournament(code: string, profile: Profile | null): [TournamentState, (message: TournamentClientMessage) => void] {
  const offline = isOfflineCode(code);
  const [state, setState] = useState<TournamentState>(() => {
    const view = offline ? offlineView(code) : null;
    return { status: offline && !view ? 'gone' : 'open', view, closed: null, error: null, claim: null };
  });
  const errorTimer = useRef<number | undefined>(undefined);
  const send = (message: TournamentClientMessage) => {
    if (!offline || message.type === 'hello') return;
    const result = applyOfflineMessage(code, profile ?? { name: 'Leitung', avatar: '🏆' }, message);
    if (!result.ok) {
      setState((s) => ({ ...s, error: result.error }));
      window.clearTimeout(errorTimer.current);
      errorTimer.current = window.setTimeout(() => setState((s) => ({ ...s, error: null })), 4000);
    } else if ('deleted' in result) setState({ status: 'gone', view: null, closed: null, error: null, claim: null });
    else setState((s) => ({ ...s, view: result.view, error: null, ...(result.claim ? { claim: result.claim } : {}) }));
  };
  // Nach einer Übertragung auf den Server ändert sich der Stand von außen; beim erneuten Öffnen neu lesen.
  useEffect(() => {
    if (!offline) return;
    const view = offlineView(code);
    setState({ status: view ? 'open' : 'gone', view, closed: null, error: null, claim: null });
  }, [code, offline]);
  return [state, send];
}

/** Hält die Turnierseite live (Server) oder liest ein Turnier ohne Netz vom Gerät; die Seite merkt den Unterschied nicht. */
export function useTournament(code: string, profile: Profile | null): [TournamentState, (message: TournamentClientMessage) => void] {
  const online = useOnlineTournament(code, profile);
  const offline = useOfflineTournament(code, profile);
  return isOfflineCode(code) ? offline : online;
}

export interface TournamentState {
  status: 'connecting' | 'open' | 'reconnecting' | 'gone';
  view: TournamentView | null;
  /** Fremde: Name des Turniers, zu dem sie keinen Zugang haben. */
  closed: string | null;
  error: string | null;
  claim: { player: string; code: string } | null;
}

const PING_MS = 30_000;

/**
 * Hält die Turnierseite live: eine schlafende WebSocket-Verbindung, über die bei jeder
 * Änderung der neue Stand kommt. Bei Abbruch wird mit wachsenden Pausen neu verbunden.
 */
function useOnlineTournament(code: string, profile: Profile | null): [TournamentState, (message: TournamentClientMessage) => void] {
  const [state, setState] = useState<TournamentState>({ status: 'connecting', view: null, closed: null, error: null, claim: null });
  const socket = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Turniere ohne Netz (Stufe 6) liegen auf diesem Gerät; für sie gibt es keine Verbindung.
    if (!GAME_SERVER || !profile || isOfflineCode(code)) return;
    let stopped = false;
    let retries = 0;
    let retryTimer: number | undefined;
    let pingTimer: number | undefined;
    let errorTimer: number | undefined;

    const connect = () => {
      if (stopped) return;
      const ws = new WebSocket(`${GAME_SERVER!.replace(/^http/, 'ws')}/turniere/${encodeURIComponent(code)}`);
      socket.current = ws;
      let opened = false;
      ws.onopen = () => {
        opened = true;
        retries = 0;
        ws.send(JSON.stringify({ type: 'hello', token: storage.deviceToken(), name: profile.name, avatar: profile.avatar } satisfies TournamentClientMessage));
        pingTimer = window.setInterval(() => ws.readyState === WebSocket.OPEN && ws.send('ping'), PING_MS);
        setState((s) => ({ ...s, status: 'open' }));
      };
      ws.onmessage = (event) => {
        if (typeof event.data !== 'string' || event.data === 'pong') return;
        const message = JSON.parse(event.data) as TournamentServerMessage;
        if (message.type === 'tournament') setState((s) => ({ ...s, view: message.view, closed: null }));
        else if (message.type === 'closed') setState((s) => ({ ...s, view: null, closed: message.name }));
        else if (message.type === 'deleted') setState((s) => ({ ...s, status: 'gone', view: null }));
        else if (message.type === 'claimCode') setState((s) => ({ ...s, claim: { player: message.player, code: message.code } }));
        else if (message.type === 'error') {
          setState((s) => ({ ...s, error: message.message }));
          window.clearTimeout(errorTimer);
          errorTimer = window.setTimeout(() => setState((s) => ({ ...s, error: null })), 4000);
        }
      };
      ws.onclose = () => {
        window.clearInterval(pingTimer);
        if (stopped || socket.current !== ws) return;
        socket.current = null;
        if (!opened && retries >= 2) {
          // Mehrfach keine Verbindung: Vielleicht gibt es das Turnier nicht mehr.
          fetch(`${GAME_SERVER}/turniere/${encodeURIComponent(code)}`)
            .then((r) => r.json() as Promise<{ exists?: boolean }>)
            .then((r) => r.exists === false && setState((s) => ({ ...s, status: 'gone' })))
            .catch(() => {});
        }
        setState((s) => ({ ...s, status: s.status === 'gone' ? 'gone' : 'reconnecting' }));
        const delay = Math.min(30_000, 1000 * 2 ** retries) * (0.75 + Math.random() * 0.5);
        retries++;
        retryTimer = window.setTimeout(connect, delay);
      };
    };

    const onVisible = () => {
      if (document.hidden || stopped || socket.current) return;
      window.clearTimeout(retryTimer);
      connect();
    };

    connect();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      window.clearTimeout(retryTimer);
      window.clearInterval(pingTimer);
      window.clearTimeout(errorTimer);
      document.removeEventListener('visibilitychange', onVisible);
      socket.current?.close();
      socket.current = null;
    };
  }, [code, profile]);

  const send = (message: TournamentClientMessage) => {
    if (socket.current?.readyState === WebSocket.OPEN) socket.current.send(JSON.stringify(message));
  };
  return [state, send];
}
