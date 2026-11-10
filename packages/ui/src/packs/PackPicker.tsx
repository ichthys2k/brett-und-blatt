import { collectionFromStored, dueRowIds, encodePairsOption, livePacks, packProblem, packsOf, sanitizeLearnBook, type UserPack } from '@brett-und-blatt/engine';
import { useState } from 'react';

/** Wo die Bibliothek eines Passes liegt (Pass-Block `bibliothek`, je Pass getrennt). */
export const LIBRARY_KEY = 'brett-und-blatt:bibliothek';

/** Wo das Lernbuch liegt (Pass-Block `lernen`, #101 L5). */
export const LEARN_KEY = 'brett-und-blatt:lernen';

function loadLibrary() {
  try {
    const col = collectionFromStored(JSON.parse(window.localStorage.getItem(LIBRARY_KEY) ?? 'null'));
    return { col, packs: packsOf(col) };
  } catch {
    return { col: collectionFromStored(null), packs: [] as UserPack[] };
  }
}

/** Die Kennungen der Zeilen eines Pakets, die heute fällig sind (leer ohne Lernstand). */
function dueRows(col: ReturnType<typeof loadLibrary>['col'], pack: UserPack): Set<string> {
  try {
    const book = sanitizeLearnBook(JSON.parse(window.localStorage.getItem(LEARN_KEY) ?? 'null'));
    if (book.crt === 0 || Object.keys(book.cards).length === 0) return new Set();
    return dueRowIds(col, book, pack.rows.map((row) => row.id), Date.now());
  } catch {
    return new Set();
  }
}

/**
 * Auswahl eines eigenen Pakets in der Einrichtung (#101): trägt eine zufällige Auswahl der Paare als Wert der verborgenen Option ein.
 * Nur Pakete mit genug Paaren stehen zur Wahl; „Pakete verwalten“ führt in die Bibliothek.
 */
export function PackPicker({ options, setOption, optionId = 'pack' }: { options: Record<string, string>; setOption: (id: string, value: string) => void; optionId?: string }) {
  const [{ col, packs: library }] = useState(loadLibrary);
  const packs = livePacks(library).filter((pack) => !packProblem(pack));
  const [preferDue, setPreferDue] = useState(true);
  const [chosen, setChosen] = useState('');
  const choose = (pack: UserPack, prefer: boolean) => setOption(optionId, encodePairsOption(pack, (n) => Math.floor(Math.random() * n), prefer ? dueRows(col, pack) : undefined));
  const dueCount = chosen ? dueRows(col, packs.find((p) => p.id === chosen) ?? { id: '', name: '', rows: [], at: 0 }).size : 0;
  const current = options[optionId] ?? '';
  let currentName = '';
  try {
    currentName = current ? ((JSON.parse(current) as { n?: string }).n ?? '') : '';
  } catch {
    currentName = '';
  }
  return (
    <fieldset className="space-y-2 rounded-xl border border-line p-3">
      <legend className="px-1 text-sm">Eigenes Paket</legend>
      {currentName && (
        <p className="flex items-center justify-between gap-2 text-sm">
          <span>
            Es spielt: <strong>{currentName}</strong>
          </span>
          <button type="button" className="text-muted underline" onClick={() => setOption(optionId, '')}>
            Nicht verwenden
          </button>
        </p>
      )}
      {packs.length > 0 ? (
        <select
          className="min-h-11 w-full rounded-xl border border-line bg-surface px-3"
          aria-label="Eigenes Paket wählen"
          value=""
          onChange={(event) => {
            const pack = packs.find((p) => p.id === event.target.value);
            if (pack) {
              setChosen(pack.id);
              choose(pack, preferDue);
            }
          }}
        >
          <option value="">{currentName ? 'Anderes Paket wählen …' : 'Paket wählen …'}</option>
          {packs.map((pack) => (
            <option key={pack.id} value={pack.id}>
              {pack.name} ({pack.rows.length} Paare)
            </option>
          ))}
        </select>
      ) : (
        <p className="text-sm text-muted">Noch kein Paket mit mindestens 6 Paaren.</p>
      )}
      {packs.length > 0 && (
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-5 accent-accent"
            checked={preferDue}
            onChange={(event) => {
              setPreferDue(event.target.checked);
              const pack = packs.find((p) => p.id === chosen);
              if (pack) choose(pack, event.target.checked);
            }}
          />
          <span>
            Fällige Karten bevorzugen
            {chosen && preferDue ? ` (${dueCount} ${dueCount === 1 ? 'Karte fällig' : 'Karten fällig'})` : ''}
          </span>
        </label>
      )}
      <a className="text-sm underline" href="#/bibliothek">
        Pakete verwalten
      </a>
    </fieldset>
  );
}
