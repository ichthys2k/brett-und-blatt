import { ApkgError, withoutScheduling, type ApkgData, packProblem, type UserPack } from '@brett-und-blatt/engine';
import { useEffect, useState } from 'react';
import { Button } from '../components/controls';
import { TavernPage } from '../components/TavernPage';
import { fetchArchive } from '../lib/archiveShare';
import { importApkg } from '../lib/ankiPackage';
import { keepStorage, savePack as saveApkgPack } from '../lib/ankiStore';
import { savePack } from '../lib/library';
import { fetchPack } from '../lib/packShare';
import { navigate, paths } from '../lib/router';

/** Ein geteiltes Paket (#101): ansehen und in die eigene Bibliothek übernehmen. Der Schlüssel steht nur im Link hinter dem #. */
export function PackView({ passKey, archive = false }: { passKey: string; archive?: boolean }) {
  if (archive) return <ArchiveView passKey={passKey} />;
  return <TextPackView passKey={passKey} />;
}

function TextPackView({ passKey }: { passKey: string }) {
  const [state, setState] = useState<UserPack | 'loading' | 'missing' | 'error'>('loading');
  useEffect(() => {
    let live = true;
    fetchPack(passKey).then((result) => live && setState(result));
    return () => {
      live = false;
    };
  }, [passKey]);

  return (
    <TavernPage title="Geteiltes Paket" subtitle="Von jemandem geteilt." back={paths.library}>
      {state === 'loading' && <p className="text-muted">Lade …</p>}
      {state === 'missing' && <p role="alert">Dieses Paket gibt es nicht (mehr). Vielleicht wurde das Teilen beendet.</p>}
      {state === 'error' && <p role="alert">Das Paket konnte nicht geöffnet werden. Ist der Link vollständig?</p>}
      {typeof state === 'object' && (
        <>
          <h2 className="text-2xl">{state.name}</h2>
          <p className="text-sm text-muted">{state.rows.length} Paare{packProblem(state) ? ` – ${packProblem(state)}` : ''}</p>
          <ul className="grid max-h-56 grid-cols-1 gap-1 overflow-y-auto text-sm sm:grid-cols-2" aria-label="Vorschau">
            {state.rows.slice(0, 20).map((row) => (
              <li key={row.id} className="rounded-lg bg-surface-2 px-2 py-1">
                {row.a} ↔ {row.b}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted">Geteilte Pakete stehen unter CC BY-SA 4.0: Du darfst sie nutzen, ändern und weitergeben, mit Nennung der Urheberin oder des Urhebers und unter derselben Lizenz.</p>
          <Button
            variant="primary"
            className="w-full"
            onClick={() => {
              savePack(null, state.name, state.rows);
              navigate(paths.library);
            }}
          >
            In meine Pakete übernehmen
          </Button>
        </>
      )}
    </TavernPage>
  );
}

const mb = (bytes: number): string => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);

/** Ein geteiltes Anki-Paket mit Medien (L7): abrufen, entschlüsseln, lesen und in die eigenen Anki-Pakete übernehmen. */
function ArchiveView({ passKey }: { passKey: string }) {
  const [state, setState] = useState<{ data: ApkgData; bytes: number } | 'loading' | 'missing' | 'error'>('loading');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    (async () => {
      const bytes = await fetchArchive(passKey);
      if (typeof bytes === 'string') return live && setState(bytes);
      try {
        const data = await importApkg(bytes);
        if (live) setState({ data, bytes: bytes.length });
      } catch (error) {
        if (live) setState('error');
      }
    })();
    return () => {
      live = false;
    };
  }, [passKey]);

  const name = typeof state === 'object' ? (state.data.collection.decks.find((d) => d.id !== 1)?.name.split('::')[0] ?? 'Geteiltes Anki-Paket') : '';
  return (
    <TavernPage title="Geteiltes Anki-Paket" subtitle="Von jemandem geteilt." back={paths.library}>
      {state === 'loading' && <p className="text-muted">Lade …</p>}
      {state === 'missing' && <p role="alert">Dieses Paket gibt es nicht (mehr). Vielleicht wurde das Teilen beendet.</p>}
      {state === 'error' && <p role="alert">Das Paket konnte nicht geöffnet werden. Ist der Link vollständig?</p>}
      {typeof state === 'object' && (
        <>
          <h2 className="text-2xl">{name}</h2>
          <p className="text-sm text-muted">
            {state.data.collection.notes.length} Notizen · {state.data.cards.length} Karten · {state.data.media.size} Medien ({mb(state.bytes)})
          </p>
          {state.data.warnings.length > 0 && (
            <ul className="list-disc pl-5 text-sm text-muted" aria-label="Hinweise">
              {state.data.warnings.slice(0, 5).map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted">Übernimm nur Pakete, denen du vertraust. Skripte aus fremden Vorlagen laufen bei uns nie. Wer ein Paket teilt, versichert, dass er es teilen darf.</p>
          {problem && (
            <p role="alert" className="text-sm text-danger">
              {problem}
            </p>
          )}
          <Button
            variant="primary"
            className="w-full"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setProblem(null);
              try {
                await keepStorage();
                // Der Lernstand des Absenders gehört nicht dazu: für dich beginnt das Paket neu.
                await saveApkgPack(name, withoutScheduling(state.data));
                navigate(paths.library);
              } catch {
                setProblem('Das Speichern hat nicht geklappt (Speicher voll?).');
                setBusy(false);
              }
            }}
          >
            In meine Anki-Pakete übernehmen
          </Button>
        </>
      )}
    </TavernPage>
  );
}
