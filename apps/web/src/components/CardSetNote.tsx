import { CARD_SET_GAMES, useActiveCardSet, useChangedCatalog } from '../lib/activeCardSet';
import { navigate, paths } from '../lib/router';

/** Hinweis vor dem Start (#270): Für diese Partie gilt das aktive Kartenset aus der Bibliothek. */
export function CardSetNote({ gameId }: { gameId: string }) {
  const set = useActiveCardSet();
  const changed = useChangedCatalog(gameId, set?.catalog);
  const part = CARD_SET_GAMES[gameId];
  if (!part || !set || !changed) return null;
  const count = Object.keys(changed[part]).length;
  return (
    <p className="rounded-2xl border border-line bg-surface p-3 text-sm shadow-sm" role="note">
      🎴 Eigenes Kartenset „{set.name}“ (Anki #{set.catalog.checksum}): {count} geänderte {count === 1 ? 'Karte gilt' : 'Karten gelten'} für diese Partie, auch für die Bots.{' '}
      <button type="button" className="underline" onClick={() => navigate(paths.library)}>
        In der Bibliothek ändern
      </button>
    </p>
  );
}
