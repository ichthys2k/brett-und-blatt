import { encodePairsOption, livePacks, packProblem, sanitizeLibrary } from '@brett-und-blatt/engine';
import { useState } from 'react';

/** Wo die Bibliothek eines Passes liegt (Pass-Block `bibliothek`, je Pass getrennt). */
export const LIBRARY_KEY = 'brett-und-blatt:bibliothek';

function loadLibrary() {
  try {
    return sanitizeLibrary(JSON.parse(window.localStorage.getItem(LIBRARY_KEY) ?? 'null'));
  } catch {
    return [];
  }
}

/**
 * Auswahl eines eigenen Pakets in der Einrichtung (#101): trägt eine zufällige Auswahl der Paare als Wert der verborgenen Option ein.
 * Nur Pakete mit genug Paaren stehen zur Wahl; „Pakete verwalten“ führt in die Bibliothek.
 */
export function PackPicker({ options, setOption, optionId = 'pack' }: { options: Record<string, string>; setOption: (id: string, value: string) => void; optionId?: string }) {
  const [library] = useState(loadLibrary);
  const packs = livePacks(library).filter((pack) => !packProblem(pack));
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
            if (pack) setOption(optionId, encodePairsOption(pack, (n) => Math.floor(Math.random() * n)));
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
      <a className="text-sm underline" href="#/bibliothek">
        Pakete verwalten
      </a>
    </fieldset>
  );
}
