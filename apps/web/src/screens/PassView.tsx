import { parseCrest } from '@brett-und-blatt/engine';
import { PlayerCrest } from '@brett-und-blatt/ui';
import { useEffect, useState } from 'react';
import { TavernPage } from '../components/TavernPage';
import { fetchShare, type PassSnapshot } from '../lib/passShare';
import { findGame } from '../lib/registry';
import { STAMP_ICON, STAMP_LABEL } from '../lib/stamps';

const nameOf = (id: string) => findGame(id)?.name ?? id;

/** Ein geteilter Pass (#149): Schnappschuss, nur lesen. Schlüssel und Kennung stehen nur im Link hinter dem #. */
export function PassView({ passKey }: { passKey: string }) {
  const [state, setState] = useState<PassSnapshot | 'loading' | 'missing' | 'error'>('loading');
  useEffect(() => {
    let live = true;
    setState('loading');
    fetchShare(passKey).then((result) => live && setState(result));
    return () => {
      live = false;
    };
  }, [passKey]);

  return (
    <TavernPage title="Spielerpass" subtitle="Von jemandem geteilt – ein Schnappschuss.">
      {state === 'loading' && <p className="text-muted">Lade …</p>}
      {state === 'missing' && <p role="alert">Diesen Pass gibt es nicht (mehr). Vielleicht wurde das Teilen beendet.</p>}
      {state === 'error' && <p role="alert">Der Pass konnte nicht geöffnet werden. Ist der Link vollständig?</p>}
      {typeof state === 'object' && <Snapshot snapshot={state} />}
    </TavernPage>
  );
}

function Snapshot({ snapshot }: { snapshot: PassSnapshot }) {
  const crest = snapshot.crest ? parseCrest(snapshot.crest) : null;
  return (
    <>
      <section className="flex items-center gap-4 rounded-xl border border-line bg-surface p-4">
        {crest ? <PlayerCrest spec={crest} size={72} label={`Wappen von ${snapshot.name}`} /> : <span className="text-5xl" aria-hidden="true">{snapshot.avatar}</span>}
        <div>
          <h2 className="text-2xl">{snapshot.name}</h2>
          {snapshot.at > 0 && <p className="text-sm text-muted">Stand {new Date(snapshot.at).toLocaleDateString('de-DE', { dateStyle: 'long' })}</p>}
        </div>
      </section>
      {snapshot.stamps && (
        <section className="space-y-2">
          <h2 className="text-xl">Stempel</h2>
          {snapshot.stamps.length === 0 ? <p className="text-sm text-muted">Noch keine.</p> : (
            <ul className="space-y-1">
              {snapshot.stamps.map((item) => (
                <li key={item.gameId} className="flex flex-wrap items-center gap-2 rounded-lg bg-surface p-2">
                  <span className="min-w-32 font-medium">{nameOf(item.gameId)}</span>
                  {item.kinds.map((kind) => (
                    <span key={kind} title={STAMP_LABEL[kind]} aria-label={STAMP_LABEL[kind]}>{STAMP_ICON[kind]}</span>
                  ))}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {snapshot.trophies && (
        <section className="space-y-2">
          <h2 className="text-xl">Pokalschrank</h2>
          {snapshot.trophies.length === 0 ? <p className="text-sm text-muted">Noch keine Pokale.</p> : (
            <ul className="space-y-1">
              {snapshot.trophies.map((trophy) => (
                <li key={`${trophy.gameId}-${trophy.at}`} className="rounded-lg bg-surface p-2 text-sm">
                  🏆 {nameOf(trophy.gameId)} · {new Date(trophy.at).toLocaleDateString('de-DE')}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {snapshot.favorites && snapshot.favorites.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xl">Lieblingsspiele</h2>
          <p>{snapshot.favorites.map((id) => `⭐ ${nameOf(id)}`).join(' · ')}</p>
        </section>
      )}
    </>
  );
}
