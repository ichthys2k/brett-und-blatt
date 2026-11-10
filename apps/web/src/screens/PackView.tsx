import { packProblem, type UserPack } from '@brett-und-blatt/engine';
import { useEffect, useState } from 'react';
import { Button } from '../components/controls';
import { TavernPage } from '../components/TavernPage';
import { savePack } from '../lib/library';
import { fetchPack } from '../lib/packShare';
import { navigate, paths } from '../lib/router';

/** Ein geteiltes Paket (#101): ansehen und in die eigene Bibliothek übernehmen. Der Schlüssel steht nur im Link hinter dem #. */
export function PackView({ passKey }: { passKey: string }) {
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
