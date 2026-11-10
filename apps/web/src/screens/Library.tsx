import { PACK_NAME_MAX, PACK_PAIRS_MIN, PACK_ROWS_MAX, livePacks, packProblem, type UserPack } from '@brett-und-blatt/engine';
import { useState } from 'react';
import { Button } from '../components/controls';
import { TavernPage } from '../components/TavernPage';
import { deletePack, loadLibrary, rowsFromText, savePack, textFromRows } from '../lib/library';
import { QrCode } from '../components/OnlineParts';
import { currentPackLink, publishPack, stopPackShare } from '../lib/packShare';
import { GAME_SERVER } from '../lib/server';
import { paths } from '../lib/router';
import { AiHelp, AnkiExport, AnkiImport } from './AnkiText';

const FIELD = 'min-h-11 w-full rounded-xl border border-line bg-surface px-3';

/** Bibliothek (#101): eigene Pakete anlegen, bearbeiten, löschen. Paare aus zwei Feldern, Einfügen aus einer Tabelle. */
export function Library() {
  const [library, setLibrary] = useState(loadLibrary);
  const [editing, setEditing] = useState<UserPack | 'new' | null>(null);
  const [sharing, setSharing] = useState<UserPack | null>(null);
  const [anki, setAnki] = useState<'import' | 'export' | null>(null);
  const packs = livePacks(library);
  const refresh = () => setLibrary(loadLibrary());

  return (
    <TavernPage title="Meine Pakete" subtitle="Eigene Paare für Paare finden, zum Beispiel Vokabeln." back={paths.pass}>
      {anki === 'import' ? (
        <AnkiImport
          onDone={() => {
            setAnki(null);
            refresh();
          }}
        />
      ) : anki === 'export' ? (
        <AnkiExport onDone={() => setAnki(null)} />
      ) : sharing ? (
        <ShareBox pack={sharing} onClose={() => setSharing(null)} />
      ) : editing ? (
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
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => setAnki('import')}>📥 Aus Anki-Text importieren</Button>
            <Button onClick={() => setAnki('export')}>📤 Als Anki-Text exportieren</Button>
          </div>
          <AiHelp />
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
                  <Button variant="ghost" onClick={() => setEditing(pack)} disabled={pack.rows.length > PACK_ROWS_MAX} title={pack.rows.length > PACK_ROWS_MAX ? `Zu groß für diesen Editor (über ${PACK_ROWS_MAX} Paare)` : undefined}>
                    ✏️ Bearbeiten
                  </Button>
                  {GAME_SERVER && !packProblem(pack) && (
                    <Button variant="ghost" aria-label={`${pack.name} teilen`} onClick={() => setSharing(pack)}>
                      🔗
                    </Button>
                  )}
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

function ShareBox({ pack, onClose }: { pack: UserPack; onClose: () => void }) {
  const [link, setLink] = useState<string | null>(() => currentPackLink(pack.id));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    setMessage(null);
    try {
      await task();
    } catch {
      setMessage('Das hat nicht geklappt. Bitte später noch einmal versuchen.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="space-y-3" aria-labelledby="pack-share">
      <h2 id="pack-share" className="text-xl">
        „{pack.name}“ teilen
      </h2>
      <p className="text-sm text-muted">
        Das Paket wird verschlüsselt abgelegt; nur wer den Link oder QR-Code hat, kann es öffnen. Es gibt keine öffentliche Liste. Nach einem Jahr ohne Abruf wird es gelöscht. Geteilte Pakete stehen unter CC BY-SA 4.0.
      </p>
      <Button variant="primary" className="w-full" disabled={busy} onClick={() => run(async () => setLink(await publishPack(pack)))}>
        🔗 {link ? 'Link aktualisieren (neuer Stand)' : 'Link erstellen'}
      </Button>
      {link && (
        <div className="space-y-2">
          <input readOnly className={FIELD} value={link} aria-label="Link zum Paket" onFocus={(e) => e.currentTarget.select()} />
          <QrCode text={link} label={`QR-Code für das Paket ${pack.name}`} />
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => void navigator.clipboard?.writeText(link).then(() => setMessage('Link kopiert.'))}>Kopieren</Button>
            <Button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await stopPackShare(pack.id);
                  setLink(null);
                  setMessage('Geteilt wird nicht mehr; der Link zeigt nichts mehr.');
                })
              }
            >
              Teilen beenden
            </Button>
          </div>
        </div>
      )}
      {message && <p role="status" className="text-sm">{message}</p>}
      <Button variant="ghost" onClick={onClose}>
        Schließen
      </Button>
    </section>
  );
}
