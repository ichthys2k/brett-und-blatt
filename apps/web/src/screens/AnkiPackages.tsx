import { ApkgError, packsOf, savePackRows, withoutScheduling, type ApkgData } from '@brett-und-blatt/engine';
import { useCallback, useEffect, useState, type ChangeEvent } from 'react';
import { Button } from '../components/controls';
import { QrCode } from '../components/OnlineParts';
import { APKG_LIMIT_TEXT, exportApkg, importApkg } from '../lib/ankiPackage';
import { currentArchiveLink, publishArchive, stopArchiveShare } from '../lib/archiveShare';
import { deletePackStored, keepStorage, listPacks, loadPack, savePack, type PackSummary } from '../lib/ankiStore';
import { downloadFile, safeFileName } from '../lib/download';
import { loadCollection, saveCollection } from '../lib/library';
import { navigate, paths } from '../lib/router';

/*
 * Anki-Pakete (.apkg) importieren, ansehen, wieder nach Anki exportieren (#101, L3). Ein importiertes Paket bleibt unverändert als Ganzes
 * gespeichert; „Paare übernehmen“ kopiert seine Paare in „Meine Pakete“, damit Paare finden, Schwarzer Peter und Bingo sie spielen.
 */

const FIELD = 'min-h-11 w-full rounded-xl border border-line bg-surface px-3';
const mb = (bytes: number): string => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);
const message = (error: unknown): string => (error instanceof ApkgError ? error.message : 'Das hat nicht geklappt. Bitte noch einmal versuchen.');

export function ApkgImport({ onDone }: { onDone: () => void }) {
  const [data, setData] = useState<ApkgData | null>(null);
  const [name, setName] = useState('');
  const [keepProgress, setKeepProgress] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const pick = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    setData(null);
    setSaved(false);
    try {
      const read = await importApkg(new Uint8Array(await file.arrayBuffer()));
      setData(read);
      setName(file.name.replace(/\.(apkg|colpkg)$/i, ''));
      setKeepProgress(false);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };
  const learned = data ? data.cards.filter((c) => c.reps > 0 || c.type > 0).length : 0;
  const store = async () => {
    if (!data) return;
    setBusy(true);
    setError(null);
    try {
      await keepStorage();
      await savePack(name.trim() || 'Anki-Paket', keepProgress ? data : withoutScheduling(data));
      setSaved(true);
      setData(null);
    } catch {
      setError('Das Paket konnte nicht gespeichert werden (vermutlich ist kein Speicherplatz frei).');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-3" aria-labelledby="apkg-import">
      <h2 id="apkg-import" className="text-xl">
        Anki-Paket importieren
      </h2>
      <p className="text-sm text-muted">Eine Datei <code>.apkg</code> oder <code>.colpkg</code> aus Anki, bis {APKG_LIMIT_TEXT}. Alles bleibt auf diesem Gerät; Skripte in den Karten werden nicht ausgeführt.</p>
      <label className="block space-y-1 text-sm">
        <span>Datei wählen</span>
        <input type="file" accept=".apkg,.colpkg" className={FIELD} onChange={pick} disabled={busy} />
      </label>
      {busy && <p role="status" className="text-sm">Einen Moment …</p>}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {data && (
        <div className="space-y-3">
          <p role="status" className="rounded-xl border border-line bg-surface-2 p-3 text-sm">
            {data.collection.notes.length} Notizen, {data.cards.length} Karten, {data.collection.decks.length} Stapel, {data.collection.notetypes.length} Notiztypen, {data.media.size} Mediendateien ({mb([...data.media.values()].reduce((s, b) => s + b.length, 0))}).
          </p>
          {data.warnings.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-sm" aria-label="Hinweise">
              {data.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
          <label className="block space-y-1 text-sm">
            <span>Name</span>
            <input className={FIELD} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
          </label>
          {learned > 0 && (
            <label className="flex min-h-11 items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1 size-5 accent-accent" checked={keepProgress} onChange={(e) => setKeepProgress(e.target.checked)} />
              <span>
                Lernfortschritt übernehmen ({learned} Karten schon gelernt)
                <span className="block text-xs text-muted">Bei fremden Stapeln lieber nicht: Sonst übernimmst du deren Abstände und Markierungen.</span>
              </span>
            </label>
          )}
        </div>
      )}
      {saved && (
        <p role="status" className="text-sm">
          Gespeichert. Das Paket steht unter „Anki-Pakete“.
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={onDone}>{saved ? 'Fertig' : 'Abbrechen'}</Button>
        <Button variant="primary" disabled={!data || busy} onClick={store}>
          Speichern
        </Button>
      </div>
    </section>
  );
}

/** Liste der gespeicherten Pakete mit Export, „Paare übernehmen“ und Löschen. */
export function ApkgList({ onPacksChanged }: { onPacksChanged: () => void }) {
  const [packs, setPacks] = useState<PackSummary[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [options, setOptions] = useState<{ id: string; scheduling: boolean; media: boolean; latest: boolean } | null>(null);
  const [sharing, setSharing] = useState<string | null>(null);
  const [links, setLinks] = useState<Record<string, string | null>>({});
  const refresh = useCallback(() => {
    listPacks().then(setPacks, () => setPacks([]));
  }, []);
  useEffect(refresh, [refresh]);
  if (!packs || packs.length === 0) return null;

  const run = async (id: string, task: () => Promise<void>) => {
    setBusy(id);
    setNote(null);
    try {
      await task();
    } catch (e) {
      setNote(message(e));
    } finally {
      setBusy(null);
    }
  };
  const exportPack = (pack: PackSummary, scheduling: boolean, media: boolean, latest: boolean) =>
    run(pack.id, async () => {
      const stored = await loadPack(pack.id);
      if (!stored) return;
      const bytes = await exportApkg({ collection: stored.pack.collection, cards: stored.pack.cards, revlog: stored.pack.revlog, media: stored.media, crt: stored.pack.crt, conf: stored.pack.conf, dconf: stored.pack.dconf }, { scheduling, media, format: latest ? 'latest' : 'legacy2' });
      downloadFile(`${safeFileName(pack.name)}.apkg`, bytes as BlobPart, 'application/octet-stream');
      setOptions(null);
    });
  /** Teilen: das Paket ohne Lernstand als `.apkg` (Medien dabei), im Browser verschlüsselt, als eine Datei in R2. */
  const sharePack = (pack: PackSummary) =>
    run(pack.id, async () => {
      const stored = await loadPack(pack.id);
      if (!stored) return;
      const bytes = await exportApkg({ collection: stored.pack.collection, media: stored.media, conf: stored.pack.conf, dconf: stored.pack.dconf }, { scheduling: false, media: true });
      const link = await publishArchive(pack.id, bytes);
      setLinks((old) => ({ ...old, [pack.id]: link }));
    });
  const takePairs = (pack: PackSummary) =>
    run(pack.id, async () => {
      const stored = await loadPack(pack.id);
      if (!stored) return;
      let col = loadCollection();
      let count = 0;
      for (const view of packsOf(stored.pack.collection)) {
        col = savePackRows(col, null, view.name.includes(pack.name) ? view.name : `${pack.name}: ${view.name}`, view.rows.map((r) => ({ a: r.a, b: r.b }))).col;
        count += view.rows.length;
      }
      if (count === 0) {
        setNote('In diesem Paket stecken keine Paare (Notizen mit zwei Textfeldern, ohne Bild und Ton).');
        return;
      }
      saveCollection(col);
      onPacksChanged();
      setNote(`${count} Paare stehen jetzt unter „Meine Pakete“.`);
    });

  return (
    <section className="space-y-2" aria-labelledby="apkg-list">
      <h2 id="apkg-list" className="text-lg">
        Anki-Pakete
      </h2>
      <ul className="space-y-2">
        {packs.map((pack) => (
          <li key={pack.id} className="space-y-2 rounded-xl border border-line bg-surface p-3">
            <div>
              <span className="block truncate font-medium">{pack.name}</span>
              <span className="block text-xs text-muted">
                {pack.notes} Notizen · {pack.cards} Karten · {pack.decks} Stapel · {pack.media} Medien ({mb(pack.mediaBytes)}){pack.learned > 0 ? ` · ${pack.learned} gelernt` : ''}
              </span>
            </div>
            {options?.id === pack.id ? (
              <div className="space-y-2">
                {pack.learned > 0 && (
                  <label className="flex min-h-11 items-center gap-2 text-sm">
                    <input type="checkbox" className="size-5 accent-accent" checked={options.scheduling} onChange={(e) => setOptions({ ...options, scheduling: e.target.checked })} />
                    <span>Lernfortschritt mitgeben</span>
                  </label>
                )}
                {pack.media > 0 && (
                  <label className="flex min-h-11 items-center gap-2 text-sm">
                    <input type="checkbox" className="size-5 accent-accent" checked={options.media} onChange={(e) => setOptions({ ...options, media: e.target.checked })} />
                    <span>Bilder und Ton mitgeben</span>
                  </label>
                )}
                <label className="flex min-h-11 items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-1 size-5 accent-accent" checked={options.latest} onChange={(e) => setOptions({ ...options, latest: e.target.checked })} />
                  <span>
                    Neues Paketformat (kleiner)
                    <span className="block text-xs text-muted">Nur für neuere Anki-Versionen. Ohne Haken lesen es alle.</span>
                  </span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={() => setOptions(null)}>Abbrechen</Button>
                  <Button variant="primary" disabled={busy === pack.id} onClick={() => void exportPack(pack, options.scheduling, options.media, options.latest)}>
                    .apkg speichern
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" onClick={() => navigate(paths.collection(pack.id))}>
                  ✏️ Bearbeiten
                </Button>
                <Button variant="ghost" disabled={busy === pack.id} onClick={() => setOptions({ id: pack.id, scheduling: pack.learned > 0, media: true, latest: false })}>
                  📤 Exportieren
                </Button>
                <Button variant="ghost" disabled={busy === pack.id} onClick={() => (setSharing(sharing === pack.id ? null : pack.id), setLinks((old) => ({ ...old, [pack.id]: old[pack.id] ?? currentArchiveLink(pack.id) })))}>
                  🔗 Teilen
                </Button>
                <Button variant="ghost" disabled={busy === pack.id} onClick={() => void takePairs(pack)}>
                  🧩 Paare übernehmen
                </Button>
                <Button
                  variant="ghost"
                  aria-label={`${pack.name} löschen`}
                  disabled={busy === pack.id}
                  onClick={() => {
                    if (window.confirm(`Das Anki-Paket „${pack.name}“ löschen?`)) void run(pack.id, async () => (await deletePackStored(pack.id), refresh()));
                  }}
                >
                  🗑️
                </Button>
              </div>
            )}
            {sharing === pack.id && (
              <div className="space-y-2 rounded-xl border border-line p-3">
                <p className="text-sm text-muted">
                  Das Paket wird mit allen Bildern und Tönen, aber ohne deinen Lernstand, im Browser verschlüsselt und als eine Datei abgelegt. Nur wer den Link oder QR-Code hat, kann es öffnen; es gibt keine öffentliche Liste. Nach einem Jahr ohne Abruf wird es gelöscht. Teile nur, was du teilen darfst.
                </p>
                <Button variant="primary" className="w-full" disabled={busy === pack.id} onClick={() => void sharePack(pack)}>
                  🔗 {links[pack.id] ? 'Link aktualisieren (neuer Stand)' : 'Link erstellen'}
                </Button>
                {links[pack.id] && (
                  <div className="space-y-2">
                    <input readOnly className={FIELD} value={links[pack.id]!} aria-label="Link zum Paket" onFocus={(e) => e.currentTarget.select()} />
                    <QrCode text={links[pack.id]!} label={`QR-Code für das Paket ${pack.name}`} />
                    <div className="grid grid-cols-2 gap-2">
                      <Button onClick={() => void navigator.clipboard?.writeText(links[pack.id]!).then(() => setNote('Link kopiert.'))}>Kopieren</Button>
                      <Button
                        disabled={busy === pack.id}
                        onClick={() =>
                          void run(pack.id, async () => {
                            await stopArchiveShare(pack.id);
                            setLinks((old) => ({ ...old, [pack.id]: null }));
                            setNote('Geteilt wird nicht mehr; der Link zeigt nichts mehr.');
                          })
                        }
                      >
                        Teilen beenden
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
      {note && (
        <p role="status" className="text-sm">
          {note}
        </p>
      )}
    </section>
  );
}

export { listPacks };
