import { resolveOptions, type BotLevel, type OptionSpec, type Options, type SeatKind, type TimePresetId } from '@brett-und-blatt/engine';
import type { LoadedGame } from './registry';

/*
 * Partie-Vorbereitung ohne Speicherzugriff (#607, K2b): Entwurf der Plätze und Optionen, Vorgaben,
 * sichtbare Optionen. Herausgelöst aus `screens/Setup.tsx`; benutzt von der klassischen Seite und
 * der Spielseite der Konsole.
 */

export interface SeatDraft {
  kind: SeatKind;
  name: string;
  level: BotLevel;
  botId?: string;
  /** Pass dieses Geräts (#139); fehlt bei freiem Namen. */
  passId?: string;
}

export interface SetupDraft {
  seats: SeatDraft[];
  options: Options;
  time: TimePresetId;
}

export const TIME_PRESETS: TimePresetId[] = ['relaxed', 'normal', 'fast'];

export function selectableBotsOf(module: LoadedGame['module']) {
  const extras = module.bots.filter((b) => b.selectable);
  if (extras.length === 0) return [module.bots[0]!];
  return [module.bots[0]!, ...extras.filter((b) => b !== module.bots[0])];
}

export function defaultDraft(game: LoadedGame): SetupDraft {
  return {
    seats: Array.from({ length: game.info.players.min }, (_, i) =>
      i < (game.info.minHumans ?? 1) ? { kind: 'human', name: '', level: 'medium' } : { kind: 'bot', name: '', level: 'medium' },
    ),
    options: resolveOptions(game.module),
    time: 'relaxed',
  };
}

/** Verborgene Optionen (z. B. eine eingefügte Partie) gelten nur für diese eine Partie und werden nicht gespeichert. */
export function withoutHidden(module: LoadedGame['module'], draft: SetupDraft): SetupDraft {
  const hidden = new Set(module.options.filter((spec) => spec.hidden).map((spec) => spec.id));
  return { ...draft, options: Object.fromEntries(Object.entries(draft.options).filter(([id]) => !hidden.has(id))) };
}

/** Wie viele Menschen noch fehlen (0 = Partie kann starten). */
export function humansMissing(game: LoadedGame, draft: SetupDraft): number {
  return Math.max(0, (game.info.minHumans ?? 1) - draft.seats.filter((seat) => seat.kind === 'human').length);
}

/** Die sichtbaren Optionen (ohne verborgene, `when` erfüllt) – für Formular, Übungslink und Zusammenfassung. */
export function visibleOptionsOf(game: LoadedGame, draft: SetupDraft): OptionSpec[] {
  const { module } = game;
  return module.options.filter(
    (spec) => !spec.hidden && (!spec.when || Object.entries(spec.when).every(([id, values]) => values.includes(draft.options[id] ?? module.options.find((o) => o.id === id)?.default ?? ''))),
  );
}
