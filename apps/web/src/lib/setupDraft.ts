import { randomSeed, resolveOptions, timePresetsOf, BOT_LEVELS, type SeatConfig } from '@brett-und-blatt/engine';
import { t } from '../i18n';
import { startGame } from './activeGame';
import { botName } from './botPortraits';
import { passBook } from './passes';
import type { LoadedGame } from './registry';
import { storage } from './storage';
import { TIME_PRESETS, defaultDraft, selectableBotsOf, withoutHidden, type SeatDraft, type SetupDraft } from './setupDraftCore';

/*
 * Partie-Vorbereitung mit Speicher (#607, K2b): gemerkte Einstellungen lesen, Plätze in die Form der
 * Spielleitung bringen, Partie starten. Herausgelöst aus `screens/Setup.tsx`.
 */

/** Gespeicherte Einstellungen nur übernehmen, wenn sie zum aktuellen Spiel passen. URL-Parameter überschreiben gezielt einzelne Optionen. */
export function restoreDraft(game: LoadedGame, params?: Record<string, string>): SetupDraft {
  const saved = storage.loadSetup<SetupDraft>(game.info.id);
  const fallback = defaultDraft(game);
  const mergedOptions = resolveOptions(game.module, { ...(saved?.options ?? {}), ...(params ?? {}) });
  if (!saved || !Array.isArray(saved.seats)) {
    return { ...fallback, options: mergedOptions };
  }
  const { min, max } = game.info.players;
  const selectableBots = selectableBotsOf(game.module);
  const seats = saved.seats.filter((s) => s && (s.kind === 'human' || s.kind === 'bot')).slice(0, max);
  return {
    seats:
      seats.length >= min
        ? seats.map((s) => {
            const matchedBot = s.botId ? selectableBots.find((b) => b.id === s.botId) : undefined;
            const level = BOT_LEVELS.includes(s.level) ? s.level : 'medium';
            const validLevel = matchedBot && !matchedBot.levels.includes(level) ? matchedBot.levels[0]! : level;
            return {
              kind: s.kind,
              name: String(s.name ?? ''),
              level: validLevel,
              ...(matchedBot ? { botId: matchedBot.id } : {}),
              ...(s.kind === 'human' && s.passId && passBook.list().some((p) => p.id === s.passId) ? { passId: s.passId } : {}),
            };
          })
        : fallback.seats,
    options: mergedOptions,
    time: TIME_PRESETS.includes(saved.time) ? saved.time : fallback.time,
  };
}

export function toSeatConfigs(seats: SeatDraft[], gameId: string): SeatConfig[] {
  const profile = storage.loadProfile();
  const botCount = seats.filter((s) => s.kind === 'bot').length;
  let botNumber = 0;
  return seats.map((seat, i) => {
    if (seat.kind === 'human') {
      const entry = seat.passId ? passBook.list().find((p) => p.id === seat.passId) : undefined;
      if (entry) return { kind: 'human', name: entry.name || seat.name.trim() || t('setup.defaultName', { n: i + 1 }), avatar: entry.avatar || undefined, passId: entry.id };
      return { kind: 'human', name: seat.name.trim() || t('setup.defaultName', { n: i + 1 }), avatar: profile?.avatar };
    }
    botNumber++;
    const botLabel = botName(gameId);
    return { kind: 'bot', name: botCount > 1 ? `${botLabel} ${botNumber}` : botLabel, level: seat.level, ...(seat.botId ? { botId: seat.botId } : {}) };
  });
}

/** Speichert die Einstellungen und startet die Partie (ohne Navigation). */
export async function launchGame(game: LoadedGame, draft: SetupDraft): Promise<void> {
  const { info, module, ui } = game;
  storage.saveSetup(info.id, withoutHidden(module, draft));
  await startGame({
    gameId: info.id,
    seats: toSeatConfigs(draft.seats, info.id),
    options: ui.prepareOptions ? ui.prepareOptions(draft.options) : draft.options,
    seed: randomSeed(),
    time: timePresetsOf(module, draft.options)[draft.time],
  });
}
