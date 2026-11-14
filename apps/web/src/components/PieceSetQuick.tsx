import { PIECE_GAMES } from '../lib/pieceGames';
import { t } from '../i18n';
import { PieceSetPicker } from './PieceSetPicker';

/** Figurensatz mitten in der Partie wechseln (#325): ein Aufklappfeld mit den Kacheln des Spiels; nur bei Spielen mit Figurensätzen. */
export function PieceSetQuick({ gameId }: { gameId: string }) {
  const game = PIECE_GAMES.find((g) => g.id === gameId);
  if (!game) return null;
  return (
    <details className="rounded-xl border border-line bg-surface-2 open:w-full">
      <summary className="min-h-9 cursor-pointer list-none px-3 py-1.5 text-sm font-medium">🎨 {t('pieces.quick')}</summary>
      <div className="p-2">
        <PieceSetPicker game={game} compact />
      </div>
    </details>
  );
}
