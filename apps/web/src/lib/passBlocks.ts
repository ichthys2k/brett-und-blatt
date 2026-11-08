import { registerPassBlock } from '@brett-und-blatt/ui/sync';
import { onFavoritesChanged, readFavoritesState, sanitizeFavorites, writeFavoritesState, type FavoritesState } from './favorites';
import { passSyncSoon } from './playerPass';

/*
 * Blöcke des Spielerpasses, die die Web-App selbst beisteuert (Vorhaben #135). Jeder Block meldet sich bei
 * `registerPassBlock` an; der Abgleich läuft über den Passschlüssel (`passSyncSoon`).
 */

/** Block `einstellungen` (Probe für #137): zunächst nur die Lieblingsspiele; die jüngere Änderung gewinnt. */
export type Settings = FavoritesState;

export function mergeSettings(remote: Settings, local: Settings): Settings {
  return remote.changed > local.changed ? remote : local;
}

export function sanitizeSettings(value: unknown): Settings {
  const { favorites, changed } = (value && typeof value === 'object' ? value : {}) as { favorites?: unknown; changed?: unknown };
  return { favorites: sanitizeFavorites(favorites), changed: typeof changed === 'number' && Number.isFinite(changed) && changed > 0 ? Math.floor(changed) : 0 };
}

let registered = false;

/** Meldet die Blöcke der Web-App an und verbindet Änderungen mit dem Abgleich. Einmal beim Start. */
export function registerWebPassBlocks(): void {
  if (registered) return;
  registered = true;
  registerPassBlock<Settings>({
    name: 'einstellungen',
    read: readFavoritesState,
    write: writeFavoritesState,
    sanitize: sanitizeSettings,
    merge: mergeSettings,
    same: (a, b) => a.changed === b.changed && JSON.stringify(a.favorites) === JSON.stringify(b.favorites),
  });
  onFavoritesChanged(passSyncSoon);
}
