import { useInputContext, useInputIntent } from '@brett-und-blatt/ui';
import { t } from '../i18n';
import { findGame } from '../lib/registry';

/** Y (`secondary`) schaltet das Lieblingsspiel der fokussierten Kachel um (Element mit `data-kns-game`, #615). */
export function useFavoriteKey(favorites: readonly string[], toggle: (gameId: string) => void): void {
  const ctx = useInputContext();
  useInputIntent((intent) => {
    if (intent !== 'secondary') return false;
    const id = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>('[data-kns-game]')?.dataset.knsGame;
    if (!id) return false;
    const wasFavorite = favorites.includes(id);
    toggle(id);
    const name = findGame(id)?.name ?? id;
    ctx?.announce(t(wasFavorite ? 'console.favorite.removed' : 'console.favorite.added', { name }));
    return true;
  }, 5);
}
