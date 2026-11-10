import { addDeck, deckSummaries, exportTextFile, importTextFile, parseTextFile, suggestImport, type DuplicateMode, type TextImportLog, type TextImportOptions } from '@brett-und-blatt/engine';
import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { Button } from '../components/controls';
import { exportApkg } from '../lib/ankiPackage';
import { loadMedia } from '../lib/ankiStore';
import { OWN } from '../lib/collectionSource';
import { downloadFile } from '../lib/download';
import { loadCollection, saveCollection } from '../lib/library';

/*
 * Import und Export im Anki-Textformat (#101, L2): Text einfügen oder eine Datei wählen, Spalten den Feldern zuordnen, Duplikate wie in Anki
 * behandeln; Export von Stapeln als Text mit den Kopfzeilen, die Anki versteht. Die Logik steht in `packages/engine/src/anki/textfile.ts`.
 */

const FIELD = 'min-h-11 w-full rounded-xl border border-line bg-surface px-3';
const AREA = 'min-h-40 w-full rounded-xl border border-line bg-surface px-3 py-2 font-mono text-sm';
/** Obergrenze für eine Textdatei (die Pakete mit Medien kommen mit dem Paketimport). */
const FILE_MAX = 5 * 1024 * 1024;

export const AI_PROMPT = `Erzeuge 20 Karteikarten zum Thema „…“ für den Import in Anki.
Ausgabe: nur die Liste, eine Karte je Zeile, Vorderseite und Rückseite mit einem Tabulator getrennt.
Keine Kopfzeile, keine Nummerierung, kein Text davor oder danach.
Zeilenumbrüche innerhalb einer Karte als <br>. Nutze für Fettdruck <b>…</b>.`;

const DELIMITER_NAME = { tab: 'Tabulator', pipe: 'Senkrechtstrich', semicolon: 'Semikolon', colon: 'Doppelpunkt', comma: 'Komma', space: 'Leerzeichen' } as const;

export function AiHelp() {
  const [copied, setCopied] = useState(false);
  return (
    <details className="rounded-xl border border-line p-3">
      <summary className="cursor-pointer font-medium">Karten mit einer KI erzeugen</summary>
      <div className="mt-2 space-y-2 text-sm">
        <p className="text-muted">Gib einer KI diese Anfrage (Thema einsetzen) und füge die Antwort unter „Aus Anki-Text importieren“ ein. Das Format ist dasselbe wie in Anki.</p>
        <textarea readOnly className={AREA} value={AI_PROMPT} aria-label="Vorlage für die Anfrage an eine KI" onFocus={(e) => e.currentTarget.select()} />
        <Button
          onClick={() =>
            void navigator.clipboard?.writeText(AI_PROMPT).then(
              () => setCopied(true),
              () => setCopied(false),
            )
          }
        >
          {copied ? 'Kopiert' : 'Anfrage kopieren'}
        </Button>
      </div>
    </details>
  );
}

export function AnkiImport({ onDone }: { onDone: () => void }) {
  const [col] = useState(loadCollection);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [opts, setOpts] = useState<TextImportOptions | null>(null);
  const [deckChoice, setDeckChoice] = useState<number | 'new'>(0);
  const [deckName, setDeckName] = useState('');
  const [log, setLog] = useState<TextImportLog | null>(null);
  const file = useMemo(() => (text.trim() ? parseTextFile(text) : null), [text]);
  useEffect(() => {
    if (!file) return setOpts(null);
    const suggested = suggestImport(col, file);
    setOpts(suggested);
    setDeckChoice(suggested.deckId);
    setLog(null);
  }, [file, col]);

  const pick = async (event: ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0];
    if (!chosen) return;
    if (chosen.size > FILE_MAX) return setError('Die Datei ist zu groß (höchstens 5 MB).');
    setError(null);
    setText(await chosen.text());
  };
  const notetype = opts ? col.notetypes.find((nt) => nt.id === opts.notetypeId) : undefined;
  const columns = file ? Array.from({ length: file.columnCount }, (_, i) => i + 1) : [];
  const label = (c: number) => `Spalte ${c}${file?.headers.columns?.[c - 1] ? ` (${file.headers.columns[c - 1]})` : ''}`;

  const run = () => {
    if (!file || !opts) return;
    let target = col;
    let deckId = opts.deckId;
    if (deckChoice === 'new') {
      const added = addDeck(col, deckName.trim() || 'Import');
      target = added.col;
      deckId = added.deck.id;
    } else deckId = deckChoice;
    const result = importTextFile(target, file, { ...opts, deckId });
    saveCollection(result.col);
    setLog(result.log);
  };

  return (
    <section className="space-y-3" aria-labelledby="anki-import">
      <h2 id="anki-import" className="text-xl">
        Aus Anki-Text importieren
      </h2>
      <p className="text-sm text-muted">Text oder CSV im Format des Anki-Text-Imports: eine Karte je Zeile, Felder durch Tabulator, Semikolon oder Komma getrennt. Kopfzeilen wie <code>#separator:tab</code> gelten.</p>
      <label className="block space-y-1 text-sm">
        <span>Datei wählen (.txt, .csv, .tsv)</span>
        <input type="file" accept=".txt,.csv,.tsv,text/plain,text/csv,text/tab-separated-values" className={FIELD} onChange={pick} />
      </label>
      <label className="block space-y-1 text-sm">
        <span>… oder Text einfügen</span>
        <textarea className={AREA} value={text} onChange={(e) => setText(e.target.value)} placeholder={'house\tHaus\ndog\tHund'} />
      </label>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {file && opts && notetype && (
        <div className="space-y-3">
          <p role="status" className="text-sm">
            {file.rows.length} Zeilen, {file.columnCount} Spalten · Trennzeichen: {DELIMITER_NAME[file.delimiter]} · {file.isHtml ? 'mit HTML' : 'ohne HTML (Text wird maskiert)'}
          </p>
          {file.rows.length > 0 && (
            <ul className="max-h-32 space-y-1 overflow-y-auto text-sm" aria-label="Vorschau">
              {file.rows.slice(0, 4).map((row, i) => (
                <li key={i} className="truncate rounded-lg bg-surface-2 px-2 py-1">
                  {row.join(' · ')}
                </li>
              ))}
            </ul>
          )}
          <label className="block space-y-1 text-sm">
            <span>Notiztyp</span>
            <select
              className={FIELD}
              value={opts.notetypeId}
              onChange={(e) => {
                const nt = col.notetypes.find((x) => x.id === Number(e.target.value))!;
                const regular = columns.filter((c) => ![opts.guidColumn, opts.deckColumn, opts.notetypeColumn, opts.tagsColumn].includes(c));
                setOpts({ ...opts, notetypeId: nt.id, fieldColumns: nt.flds.map((_, i) => regular[i] ?? 0) });
              }}
            >
              {col.notetypes.map((nt) => (
                <option key={nt.id} value={nt.id}>
                  {nt.name}
                </option>
              ))}
            </select>
          </label>
          {!opts.notetypeColumn &&
            notetype.flds.map((f, i) => (
              <label key={f.name} className="block space-y-1 text-sm">
                <span>Feld „{f.name}“ aus</span>
                <select className={FIELD} value={opts.fieldColumns[i] ?? 0} onChange={(e) => setOpts({ ...opts, fieldColumns: opts.fieldColumns.map((c, j) => (j === i ? Number(e.target.value) : c)) })}>
                  <option value={0}>(leer lassen)</option>
                  {columns.map((c) => (
                    <option key={c} value={c}>
                      {label(c)}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          <label className="block space-y-1 text-sm">
            <span>Tags aus</span>
            <select className={FIELD} value={opts.tagsColumn ?? 0} onChange={(e) => setOpts({ ...opts, tagsColumn: Number(e.target.value) || undefined })}>
              <option value={0}>(keine)</option>
              {columns.map((c) => (
                <option key={c} value={c}>
                  {label(c)}
                </option>
              ))}
            </select>
          </label>
          {!opts.deckColumn && (
            <label className="block space-y-1 text-sm">
              <span>Stapel</span>
              <select className={FIELD} value={deckChoice} onChange={(e) => setDeckChoice(e.target.value === 'new' ? 'new' : Number(e.target.value))}>
                {deckSummaries(col).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.notes})
                  </option>
                ))}
                <option value="new">Neuer Stapel …</option>
              </select>
            </label>
          )}
          {deckChoice === 'new' && !opts.deckColumn && (
            <label className="block space-y-1 text-sm">
              <span>Name des neuen Stapels</span>
              <input className={FIELD} value={deckName} maxLength={80} onChange={(e) => setDeckName(e.target.value)} />
            </label>
          )}
          <label className="block space-y-1 text-sm">
            <span>Wenn eine Karte schon da ist (gleiches erstes Feld)</span>
            <select className={FIELD} value={opts.duplicates} onChange={(e) => setOpts({ ...opts, duplicates: e.target.value as DuplicateMode })}>
              <option value="update">Aktualisieren</option>
              <option value="ignore">Auslassen</option>
              <option value="new">Als neue Karte aufnehmen</option>
            </select>
          </label>
          <label className="block space-y-1 text-sm">
            <span>Vergleichen im</span>
            <select className={FIELD} value={opts.matchScope} onChange={(e) => setOpts({ ...opts, matchScope: e.target.value as TextImportOptions['matchScope'] })}>
              <option value="notetype">Notiztyp</option>
              <option value="notetype+deck">Notiztyp und Stapel</option>
            </select>
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" className="size-5 accent-accent" checked={opts.isHtml} onChange={(e) => setOpts({ ...opts, isHtml: e.target.checked })} />
            <span>Die Felder enthalten HTML</span>
          </label>
        </div>
      )}
      {log && (
        <p role="status" className="rounded-xl border border-line bg-surface-2 p-3 text-sm">
          {log.new} neu, {log.updated} aktualisiert, {log.duplicate} schon vorhanden, {log.skipped} übersprungen
          {log.unknownNotetype > 0 ? ` (${log.unknownNotetype} mit unbekanntem Notiztyp)` : ''}
          {log.createdDecks.length > 0 ? ` · neue Stapel: ${log.createdDecks.join(', ')}` : ''}. Stapel mit Paaren erscheinen unter „Meine Pakete“.
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={onDone}>{log ? 'Fertig' : 'Abbrechen'}</Button>
        <Button variant="primary" disabled={!file || !opts || file.rows.length === 0} onClick={run}>
          Importieren
        </Button>
      </div>
    </section>
  );
}

export function AnkiExport({ onDone }: { onDone: () => void }) {
  const [col] = useState(loadCollection);
  const [deck, setDeck] = useState<number | 'all'>('all');
  const [guid, setGuid] = useState(true);
  const [notetype, setNotetype] = useState(true);
  const [deckCol, setDeckCol] = useState(true);
  const [tags, setTags] = useState(true);
  const [html, setHtml] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const out = useMemo(() => exportTextFile(col, { ...(deck === 'all' ? {} : { deckId: deck }), guid, notetype, deck: deckCol, tags, html }), [col, deck, guid, notetype, deckCol, tags, html]);
  const count = out.split('\n').filter((line) => line && !line.startsWith('#')).length;
  const checks: [string, boolean, (v: boolean) => void][] = [
    ['Kennung (guid) – damit Anki bearbeitete Karten wiedererkennt', guid, setGuid],
    ['Notiztyp', notetype, setNotetype],
    ['Stapel', deckCol, setDeckCol],
    ['Tags', tags, setTags],
    ['Mit HTML (sonst reiner Text)', html, setHtml],
  ];
  const save = () => downloadFile('brett-und-blatt-karten.txt', out, 'text/plain;charset=utf-8');
  const savePackage = async () => {
    try {
      const media = await loadMedia(OWN);
      const bytes = await exportApkg({ collection: col, media, ...(deck === 'all' ? {} : { deckId: deck }) }, { scheduling: false, media: true });
      downloadFile('brett-und-blatt.apkg', bytes as BlobPart, 'application/octet-stream');
    } catch {
      setMessage('Das Paket konnte nicht erstellt werden.');
    }
  };
  return (
    <section className="space-y-3" aria-labelledby="anki-export">
      <h2 id="anki-export" className="text-xl">
        Als Anki-Text exportieren
      </h2>
      <label className="block space-y-1 text-sm">
        <span>Stapel</span>
        <select className={FIELD} value={deck} onChange={(e) => setDeck(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
          <option value="all">Alle Karten</option>
          {deckSummaries(col).map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} ({d.notes})
            </option>
          ))}
        </select>
      </label>
      {checks.map(([name, value, set]) => (
        <label key={name} className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" className="size-5 accent-accent" checked={value} onChange={(e) => set(e.target.checked)} />
          <span>{name}</span>
        </label>
      ))}
      <p role="status" className="text-sm">
        {count} Karten
      </p>
      <textarea readOnly className={AREA} value={out} aria-label="Exportierter Text" onFocus={(e) => e.currentTarget.select()} />
      <div className="grid grid-cols-2 gap-2">
        <Button
          disabled={count === 0}
          onClick={() =>
            void navigator.clipboard?.writeText(out).then(
              () => setMessage('Kopiert.'),
              () => setMessage('Kopieren war nicht möglich. Markiere den Text und kopiere ihn von Hand.'),
            )
          }
        >
          Kopieren
        </Button>
        <Button disabled={count === 0} onClick={save}>
          Als Datei speichern
        </Button>
      </div>
      <Button className="w-full" disabled={count === 0} onClick={() => void savePackage()}>
        📦 Als Anki-Paket (.apkg) speichern
      </Button>
      {message && <p role="status" className="text-sm">{message}</p>}
      <Button variant="ghost" onClick={onDone}>
        Schließen
      </Button>
    </section>
  );
}
