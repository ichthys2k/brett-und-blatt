import { PACK_NAME_MAX, PACK_PAIRS_MIN, PACK_ROWS_MAX, livePacks, packProblem, type UserPack } from '@brett-und-blatt/engine';
import { useState } from 'react';
import { Button } from '../components/controls';
import { TavernPage } from '../components/TavernPage';
import { deletePack, loadLibrary, rowsFromText, savePack, textFromRows } from '../lib/library';
import { paths } from '../lib/router';

const FIELD = 'min-h-11 w-full rounded-xl border border-line bg-surface px-3';

/** Bibliothek (#101): eigene Pakete anlegen, bearbeiten, löschen. Paare aus zwei Feldern, Einfügen aus einer Tabelle. */
export function Library() {
  const [library, setLibrary] = useState(loadLibrary);
  const [editing, setEditing] = useState<UserPack | 'new' | null>(null);
  const packs = livePacks(library);
  const refresh = () => setLibrary(loadLibrary());

  return (
    <TavernPage title="Meine Pakete" subtitle="Eigene Paare für Paare finden, zum Beispiel Vokabeln." back={paths.pass}>
      {editing ? (
        <Editor
          existing={editing === 'new' ? null : editing}
          onDone={() => {
            setEditing(null);
            refresh();
          }}
        />
      ) : (
        <>
          <Button variant="primary" className="w-full" onClick={() => setEditing('new')}>
            ➕ Neues Paket
          </Button>
          {packs.length === 0 ? (
            <p className="text-muted">Noch keine Pakete. Lege eins an, wähle es dann in der Einrichtung von „Paare finden“ unter „Eigenes Paket“.</p>
          ) : (
            <ul className="space-y-2">
              {packs.map((pack) => (
                <li key={pack.id} className="flex items-center gap-2 rounded-xl border border-line bg-surface p-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{pack.name}</span>
                    <span className="block text-xs text-muted">
                      {pack.rows.length} Paare{packProblem(pack) ? ` – ${packProblem(pack)}` : ''}
                    </span>
                  </span>
                  <Button variant="ghost" onClick={() => setEditing(pack)}>
                    ✏️ Bearbeiten
                  </Button>
                  <Button
                    variant="ghost"
                    aria-label={`${pack.name} löschen`}
                    onClick={() => {
                      if (window.confirm(`Das Paket „${pack.name}“ löschen?`)) {
                        deletePack(pack.id);
                        refresh();
                      }
                    }}
                  >
                    🗑️
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </TavernPage>
  );
}

function Editor({ existing, onDone }: { existing: UserPack | null; onDone: () => void }) {
  const [name, setName] = useState(existing?.name ?? '');
  const [text, setText] = useState(existing ? textFromRows(existing.rows) : '');
  const parsed = rowsFromText(text, existing?.rows ?? []);
  const problem = packProblem({ rows: parsed.rows });
  const nameOk = name.trim().length > 0;
  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!nameOk || problem) return;
        savePack(existing, name.trim(), parsed.rows);
        onDone();
      }}
    >
      <label className="block space-y-1 text-sm">
        <span>Name des Pakets</span>
        <input className={FIELD} required maxLength={PACK_NAME_MAX} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="block space-y-1 text-sm">
        <span>Paare, eine Karte je Zeile: Feld A und Feld B mit Semikolon oder Tab getrennt</span>
        <textarea className="min-h-48 w-full rounded-xl border border-line bg-surface px-3 py-2 font-mono text-sm" value={text} onChange={(e) => setText(e.target.value)} placeholder={'house;Haus\ndog;Hund\ncat;Katze'} />
      </label>
      <p className="text-xs text-muted">
        Du kannst Zeilen aus einer Tabelle (Excel, Anki-Text) einfügen. Höchstens {PACK_ROWS_MAX} Zeilen, je Feld bis 40 Zeichen.
      </p>
      <p role="status" className={problem ? 'text-sm text-danger' : 'text-sm'}>
        {parsed.rows.length} von mindestens {PACK_PAIRS_MIN} Paaren{parsed.skipped > 0 ? ` · ${parsed.skipped} Zeilen übersprungen (leer, ohne zweites Feld oder nicht erlaubt)` : ''}
      </p>
      {parsed.rows.length > 0 && (
        <ul className="grid max-h-40 grid-cols-1 gap-1 overflow-y-auto text-sm sm:grid-cols-2" aria-label="Vorschau">
          {parsed.rows.slice(0, 12).map((row) => (
            <li key={row.id} className="rounded-lg bg-surface-2 px-2 py-1">
              {row.a} ↔ {row.b}
            </li>
          ))}
        </ul>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" onClick={onDone}>
          Abbrechen
        </Button>
        <Button type="submit" variant="primary" disabled={!nameOk || !!problem}>
          Speichern
        </Button>
      </div>
    </form>
  );
}
