import { PIECE_SET_IDS, PIECE_SET_LABELS, setPieceSet, usePieceSet, type PieceSetId } from '@brett-und-blatt/ui';
import type { PieceGame } from '../lib/pieceGames';

/** Auswahl des Figurensatzes eines Spiels (#325): vier Kacheln mit Vorschau der wichtigsten Figur. */
export function PieceSetPicker({ game }: { game: PieceGame }) {
  const current = usePieceSet(game.id);
  return (
    <fieldset className="space-y-2 rounded-2xl border border-line bg-surface p-4">
      <legend className="px-1 font-semibold">{game.name}</legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {PIECE_SET_IDS.map((id: PieceSetId) => {
          const preview = game.previews[id];
          // Ein Satz ohne Vorschau und ohne Bilder wäre nicht wählbar (außer „Klassisch“).
          if (id !== 'classic' && !preview) return null;
          return (
            <label
              key={id}
              className={`flex cursor-pointer flex-col items-center gap-1 rounded-xl border p-2 text-center transition ${
                current === id ? 'border-accent bg-accent/15 ring-2 ring-accent' : 'border-line bg-surface-2 hover:bg-surface-3'
              }`}
            >
              <input type="radio" name={`pieces-${game.id}`} className="sr-only" checked={current === id} onChange={() => setPieceSet(game.id, id)} />
              <span className="grid size-16 place-items-center" aria-hidden="true">
                {id === 'classic' ? <span className="text-5xl leading-none">{game.classicGlyph}</span> : <img src={preview} alt="" className="size-16 object-contain" draggable={false} />}
              </span>
              <span className="text-sm font-medium">{PIECE_SET_LABELS[id]}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
