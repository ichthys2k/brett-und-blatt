import { LocalSession, type SessionConfig } from '@brett-und-blatt/engine';
import { createBotRunner } from './botRunner';
import { loadGame, type LoadedGame } from './registry';
import { storage } from './storage';

export interface ActiveGame {
  game: LoadedGame;
  session: LocalSession;
}

let active: ActiveGame | null = null;
let botRunner: ReturnType<typeof createBotRunner> | null = null;

function runner() {
  botRunner ??= createBotRunner();
  return botRunner;
}

export function getActiveGame(): ActiveGame | null {
  return active;
}

export async function startGame(config: SessionConfig): Promise<ActiveGame> {
  const game = await loadGame(config.gameId);
  active?.session.dispose();
  const session = new LocalSession(game.module, config, { botRunner: runner() });
  active = { game, session };
  saveProgress(session);
  return active;
}

/** Setzt die laufende Partie fort – aus dem Speicher, falls die Seite neu geladen wurde. */
export async function resumeGame(): Promise<ActiveGame | null> {
  if (active && !active.session.result) return active;
  const snapshot = storage.loadActive();
  if (!snapshot) return null;
  try {
    const game = await loadGame(snapshot.config.gameId);
    const session = LocalSession.restore(game.module, snapshot, { botRunner: runner() });
    active = { game, session };
    return active;
  } catch {
    storage.clearActive();
    return null;
  }
}

export function discardGame(): void {
  active?.session.dispose();
  active = null;
  storage.clearActive();
}

/** Nach jedem Zug: laufende Partien merken, beendete vergessen. */
export function saveProgress(session: LocalSession): void {
  if (session.result) storage.clearActive();
  else storage.saveActive(session.snapshot());
}
