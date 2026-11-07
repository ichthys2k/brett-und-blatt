import type { TournamentClientMessage, TournamentServerMessage, TournamentSettings, TournamentView } from '@brett-und-blatt/online';
import { useEffect, useRef, useState } from 'react';
import { GAME_SERVER } from './server';
import { storage, type Profile } from './storage';


export async function createTournament(settings: TournamentSettings & { fields?: number }, profile: Profile): Promise<string> {
  const response = await fetch(`${GAME_SERVER}/turniere`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ settings, token: storage.deviceToken(), name: profile.name }),
  });
  if (!response.ok) throw new Error(`Server antwortet mit ${response.status}`);
  return ((await response.json()) as { code: string }).code;
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
export function useTournament(code: string, profile: Profile | null): [TournamentState, (message: TournamentClientMessage) => void] {
  const [state, setState] = useState<TournamentState>({ status: 'connecting', view: null, closed: null, error: null, claim: null });
  const socket = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!GAME_SERVER || !profile) return;
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
        else if (message.type === 'claimCode') setState((s) => ({ ...s, claim: { player: message.player, code: message.code } }));
        else {
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
