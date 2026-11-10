import { parseClassCode, CLASS_CODE_LENGTH, type CardSection, type ClassView } from '@brett-und-blatt/online';
import { PlayerCrest } from '@brett-und-blatt/ui';
import { parseCrest } from '@brett-und-blatt/engine';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ClassPacks, LearningLead, LearningMember, LearningNotice } from './ClassLearning';
import { Button } from '../components/controls';
import { EmojiKeypad, QrCode } from '../components/OnlineParts';
import { TavernPage } from '../components/TavernPage';
import { buildClassCard, classAct, createClassOnServer, forgetClass, hiddenSections, loadClasses, rememberClass, setSectionHidden } from '../lib/classes';
import { createClassPasses, loadChildPasses, printChildCards, resetChildPin } from '../lib/classPasses';
import { parseNames } from '../lib/classPassesCore';
import { findGame } from '../lib/registry';
import { STAMP_ICON, STAMP_LABEL, type StampKind } from '../lib/stamps';
import { GAME_SERVER } from '../lib/server';
import { navigate, paths } from '../lib/router';
import { storage } from '../lib/storage';

const FIELD = 'min-h-11 w-full rounded-xl border border-line bg-surface px-3';

/** Klassen (#150): eigene Klassen, neue Klasse anlegen, mit Emoji-Code beitreten. */
export function Classes() {
  const profile = storage.loadProfile();
  const [known, setKnown] = useState(loadClasses);
  const [name, setName] = useState('');
  const [pasted, setPasted] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);

  if (!GAME_SERVER) return <TavernPage title="Klassen" back={paths.online}><p className="text-muted">Es gibt gerade keinen Spieleserver.</p></TavernPage>;
  if (!profile)
    return (
      <TavernPage title="Klassen" back={paths.online}>
        <p className="text-muted">Für Klassen brauchst du einen Namen.</p>
        <button type="button" className="bub-menu-button" onClick={() => navigate(paths.pass)}>
          Profil anlegen
        </button>
      </TavernPage>
    );

  const open = (input: string) => {
    const code = parseClassCode(input);
    if (!code) return setError('Das ist kein Klassencode. Er besteht aus sechs Bildern.');
    navigate(paths.class(code));
  };

  return (
    <TavernPage title="Klassen" subtitle="Eine Gruppe, die bleibt: Klasse, AG, Verein oder Familie." back={paths.online}>
      {known.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xl">Meine Klassen</h2>
          <ul className="space-y-1">
            {known.map((item) => (
              <li key={item.code}>
                <Button className="w-full justify-start" onClick={() => navigate(paths.class(item.code))}>
                  🎒 {item.name}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-xl">Mit Code beitreten</h2>
        <p className="text-sm text-muted">Den Code mit sechs Bildern gibt dir die Lehrkraft, oder du scannst den QR-Code.</p>
        <EmojiKeypad length={CLASS_CODE_LENGTH} onComplete={open} />
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            open(pasted);
          }}
        >
          <input className={FIELD} aria-label="Klassencode oder Link" placeholder="🐶🐱🦊🐻🐸🐧" value={pasted} onChange={(e) => setPasted(e.target.value)} />
          <Button type="submit">Weiter</Button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl">Neue Klasse</h2>
        {!creating ? (
          <Button className="w-full" onClick={() => setCreating(true)}>
            ➕ Klasse anlegen
          </Button>
        ) : (
          <form
            className="space-y-2"
            onSubmit={async (event) => {
              event.preventDefault();
              setBusy(true);
              setError(null);
              const result = await createClassOnServer(name.trim());
              setBusy(false);
              if ('error' in result) return setError(result.error);
              rememberClass({ code: result.code, name: name.trim() });
              setKnown(loadClasses());
              navigate(paths.class(result.code));
            }}
          >
            <label className="block space-y-1 text-sm">
              <span>Name der Klasse</span>
              <input className={FIELD} required maxLength={30} value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <Button type="submit" variant="primary" className="w-full" disabled={busy || !name.trim()}>
              Anlegen
            </Button>
            <p className="text-xs text-muted">Du wirst die Leitung. Ohne Aktivität wird eine Klasse nach einem Jahr gelöscht.</p>
          </form>
        )}
      </section>

      {error && (
        <p role="alert" className="rounded-xl bg-danger/10 p-3 text-danger">
          {error}
        </p>
      )}
    </TavernPage>
  );
}

/** Eine Klasse (#150): Mitglieder, Beitritt, für die Leitung Steuerung und QR-Code. */
export function ClassPage({ code }: { code: string }) {
  const [view, setView] = useState<ClassView | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [message, setMessage] = useState<string | null>(null);
  const [renaming, setRenaming] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [hidden, setHidden] = useState<CardSection[]>(hiddenSections);
  const sent = useRef('');
  const [names, setNames] = useState('');
  const [progress, setProgress] = useState<string | null>(null);
  const [children, setChildren] = useState(() => loadChildPasses().filter((c) => c.classCode === code));
  const alive = useRef(true);

  const apply = useCallback(
    async (action: string, extra: Record<string, unknown> = {}) => {
      const reply = await classAct(code, action, extra);
      if (!alive.current) return;
      if (reply.ok) {
        setView(reply.view);
        setState('ready');
        setMessage(null);
        if (reply.view.me) {
          rememberClass({ code, name: reply.view.name });
          // Die eigene Klassenkarte nachführen, wenn sie sich geändert hat (oder die Klasse etwas anderes zeigt).
          const card = buildClassCard(reply.view.sections);
          const key = JSON.stringify([card, reply.view.sections]);
          if (action === 'view' && key !== sent.current) {
            sent.current = key;
            void classAct(code, 'card', { card }).then((r) => r.ok && alive.current && setView(r.view));
          }
        }
        return reply.view;
      }
      if (reply.status === 404) {
        forgetClass(code);
        setState('missing');
      } else if (reply.view) {
        setView(reply.view);
        setMessage(reply.error);
      } else if (action === 'view') setState((current) => (current === 'ready' ? current : 'error'));
      else setMessage(reply.error);
      return undefined;
    },
    [code],
  );

  useEffect(() => {
    alive.current = true;
    void apply('view');
    const timer = window.setInterval(() => void apply('view'), 10_000);
    return () => {
      alive.current = false;
      window.clearInterval(timer);
    };
  }, [apply]);

  const profile = storage.loadProfile();
  const link = `${window.location.origin}${window.location.pathname}#/klasse/${encodeURIComponent(code)}`;

  return (
    <TavernPage title={view?.name ?? 'Klasse'} back={paths.classes}>
      {state === 'loading' && <p className="text-muted">Lade …</p>}
      {state === 'missing' && <p role="alert">Diese Klasse gibt es nicht (mehr). Prüfe den Code.</p>}
      {state === 'error' && <p role="alert">Keine Verbindung. Bitte später noch einmal versuchen.</p>}

      {view && !view.me && (
        <section className="space-y-3">
          {view.waiting ? (
            <p>Du wartest auf die Zusage der Leitung. Diese Seite aktualisiert sich selbst.</p>
          ) : !profile ? (
            <button type="button" className="bub-menu-button" onClick={() => navigate(paths.pass)}>
              Zuerst ein Profil anlegen
            </button>
          ) : view.open ? (
            <>
              <p>
                Willst du der Klasse <strong>{view.name}</strong> beitreten? Die anderen sehen dann deinen Namen, dein Bild und dein Wappen.
              </p>
              {view.learning && <LearningNotice />}
              <Button variant="primary" className="w-full" onClick={() => void apply('join')}>
                Beitreten{view.approval ? ' (die Leitung muss zustimmen)' : ''}
              </Button>
            </>
          ) : (
            <p>Der Beitritt ist gerade geschlossen.</p>
          )}
        </section>
      )}

      {view?.me && (
        <>
          <section className="space-y-2" aria-labelledby="class-members">
            <h2 id="class-members" className="text-xl">
              Mitglieder ({view.members.length})
            </h2>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {view.members.map((member) => {
                const crest = member.crest ? parseCrest(member.crest) : null;
                return (
                  <li key={member.id} className="flex items-center gap-2 rounded-xl border border-line bg-surface p-2">
                    <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-label={`Profil von ${member.name} ansehen`} onClick={() => setSelected(member.id)}>
                      {crest ? <PlayerCrest spec={crest} size={36} label={`Wappen von ${member.name}`} /> : <span className="text-2xl" aria-hidden="true">{member.avatar}</span>}
                      <span className="min-w-0 flex-1 truncate">
                        {member.name}
                        {member.lead && <span className="ml-1 text-xs text-muted">(Leitung)</span>}
                      </span>
                    </button>
                    {view.lead && member.id !== view.me && (
                      <span className="flex gap-1">
                        <Button variant="ghost" aria-label={`${member.name} ${member.lead ? 'als Leitung entfernen' : 'zur Leitung machen'}`} onClick={() => void apply('lead', { id: member.id, lead: !member.lead })}>
                          {member.lead ? '⭐' : '☆'}
                        </Button>
                        {!member.lead && (
                          <Button variant="ghost" aria-label={`${member.name} entfernen`} onClick={() => void apply('remove', { id: member.id })}>
                            ✕
                          </Button>
                        )}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          {selected && (() => {
            const member = view.members.find((m) => m.id === selected);
            if (!member) return null;
            return (
              <section className="space-y-2 rounded-xl border border-line bg-surface p-3" aria-labelledby="class-profile">
                <h2 id="class-profile" className="text-xl">{member.name}</h2>
                {!member.card ? <p className="text-sm text-muted">Hier gibt es noch nichts zu sehen.</p> : (
                  <>
                    {member.card.stamps && member.card.stamps.length > 0 && (
                      <ul className="space-y-1 text-sm">
                        {member.card.stamps.map((item) => (
                          <li key={item.gameId}>{findGame(item.gameId)?.name ?? item.gameId}: {item.kinds.map((kind) => <span key={kind} title={STAMP_LABEL[kind as StampKind]} aria-label={STAMP_LABEL[kind as StampKind]}>{STAMP_ICON[kind as StampKind]} </span>)}</li>
                        ))}
                      </ul>
                    )}
                    {member.card.trophies && member.card.trophies.length > 0 && (
                      <p className="text-sm">🏆 {member.card.trophies.map((t) => `${findGame(t.gameId)?.name ?? t.gameId} ${t.count}`).join(' · ')}</p>
                    )}
                    {member.card.favorites && member.card.favorites.length > 0 && <p className="text-sm">⭐ {member.card.favorites.map((id) => findGame(id)?.name ?? id).join(' · ')}</p>}
                  </>
                )}
                <Button variant="ghost" onClick={() => setSelected(null)}>Schließen</Button>
              </section>
            );
          })()}

          {view.sections.stamps && (() => {
            const games = [...new Set(view.members.flatMap((m) => m.card?.stamps?.map((s) => s.gameId) ?? []))];
            if (games.length === 0) return null;
            return (
              <section className="space-y-2" aria-labelledby="class-wall">
                <h2 id="class-wall" className="text-xl">Stempelwand</h2>
                <ul className="space-y-1">
                  {games.map((gameId) => (
                    <li key={gameId} className="flex flex-wrap items-center gap-2 rounded-lg bg-surface p-2 text-sm">
                      <span className="min-w-32 font-medium">{findGame(gameId)?.name ?? gameId}</span>
                      {view.members.flatMap((m) => {
                        const entry = m.card?.stamps?.find((s) => s.gameId === gameId);
                        return entry ? [<span key={m.id} className="rounded-full bg-surface-2 px-2 py-0.5" title={`${m.name}: ${entry.kinds.map((k) => STAMP_LABEL[k as StampKind]).join(', ')}`}>{m.avatar} {entry.kinds.length}</span>] : [];
                      })}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })()}

          <fieldset className="space-y-1 rounded-xl border border-line bg-surface p-3 text-sm">
            <legend className="px-1">Das zeige ich den anderen</legend>
            {(['stamps', 'trophies', 'favorites'] as const).map((section) => (
              <label key={section} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-accent"
                  disabled={!view.sections[section]}
                  checked={view.sections[section] && !hidden.includes(section)}
                  onChange={(e) => {
                    setSectionHidden(section, !e.target.checked);
                    setHidden(hiddenSections());
                    sent.current = '';
                    void apply('view');
                  }}
                />
                {{ stamps: 'Stempel', trophies: 'Pokale', favorites: 'Lieblingsspiele' }[section]}
                {!view.sections[section] && <span className="text-xs text-muted">(von der Leitung ausgeschaltet)</span>}
              </label>
            ))}
          </fieldset>

          {view.lead && view.pending.length > 0 && (
            <section className="space-y-2" aria-labelledby="class-pending">
              <h2 id="class-pending" className="text-xl">
                Möchten beitreten
              </h2>
              <ul className="space-y-1">
                {view.pending.map((entry) => (
                  <li key={entry.id} className="flex items-center gap-2 rounded-xl border border-line bg-surface p-2">
                    <span aria-hidden="true" className="text-2xl">{entry.avatar}</span>
                    <span className="flex-1">{entry.name} möchte beitreten – zulassen?</span>
                    <Button variant="primary" onClick={() => void apply('accept', { id: entry.id })}>Ja</Button>
                    <Button onClick={() => void apply('reject', { id: entry.id })}>Nein</Button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <ClassPacks code={code} view={view} apply={apply} />

          <LearningMember code={code} view={view} />

          {view.lead && (
            <section className="space-y-3 rounded-xl border border-line bg-surface p-3" aria-labelledby="class-lead">
              <h2 id="class-lead" className="text-xl">
                Für die Leitung
              </h2>
              <p className="text-sm text-muted">Zeig den QR-Code an der Tafel oder schick den Link. Der Code: <span className="text-xl">{code}</span></p>
              <QrCode text={link} label={`QR-Code für die Klasse ${view.name}`} />
              <Button onClick={() => void navigator.clipboard?.writeText(link).then(() => setMessage('Link kopiert.'))}>Link kopieren</Button>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4 accent-accent" checked={view.open} onChange={(e) => void apply('configure', { open: e.target.checked })} />
                Beitritt ist offen
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4 accent-accent" checked={view.approval} onChange={(e) => void apply('configure', { approval: e.target.checked })} />
                Beitritte bestätigen
              </label>
              <fieldset className="space-y-1 text-sm">
                <legend className="mb-1">Das dürfen die Klassenkarten zeigen</legend>
                {(['stamps', 'trophies', 'favorites'] as const).map((section) => (
                  <label key={section} className="flex items-center gap-2">
                    <input type="checkbox" className="h-4 w-4 accent-accent" checked={view.sections[section]} onChange={(e) => void apply('configure', { sections: { [section]: e.target.checked } })} />
                    {{ stamps: 'Stempel (Stempelwand)', trophies: 'Pokale', favorites: 'Lieblingsspiele' }[section]}
                  </label>
                ))}
              </fieldset>
              <LearningLead code={code} view={view} apply={apply} />
              <form
                className="flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (renaming.trim()) void apply('configure', { name: renaming.trim() }).then(() => setRenaming(''));
                }}
              >
                <input className={FIELD} aria-label="Neuer Name der Klasse" maxLength={30} placeholder="Klasse umbenennen" value={renaming} onChange={(e) => setRenaming(e.target.value)} />
                <Button type="submit">OK</Button>
              </form>
              <section className="space-y-2" aria-labelledby="class-passes">
                <h3 id="class-passes" className="text-lg">Klassenausweise</h3>
                <p className="text-sm text-muted">Für Kinder ohne eigenen Ausweis: ein Name je Zeile. Jedes Kind bekommt Spielercode und Start-PIN und ist gleich in der Klasse. Die Karten druckst du aus.</p>
                <textarea className="min-h-24 w-full rounded-xl border border-line bg-surface px-3 py-2" rows={4} aria-label="Namen, ein Kind je Zeile" value={names} onChange={(e) => setNames(e.target.value)} />
                <Button
                  disabled={progress !== null || parseNames(names).length === 0}
                  onClick={async () => {
                    const list = parseNames(names);
                    setProgress(`0 von ${list.length}`);
                    const result = await createClassPasses(code, list, (done, total) => setProgress(`${done} von ${total}`));
                    setChildren(loadChildPasses().filter((c) => c.classCode === code));
                    setProgress(null);
                    setNames('');
                    setMessage(result.error ? `${result.created.length} angelegt, dann ein Fehler: ${result.error}` : `${result.created.length} Ausweise angelegt.`);
                    void apply('view');
                    if (result.created.length > 0) printChildCards(result.created, view.name);
                  }}
                >
                  {progress ? `Lege an … ${progress}` : 'Ausweise anlegen und Karten drucken'}
                </Button>
                {children.length > 0 && (
                  <>
                    <ul className="space-y-1 text-sm">
                      {children.map((child) => (
                        <li key={child.playerCode} className="flex items-center gap-2 rounded-lg bg-surface-2 p-2">
                          <span aria-hidden="true">{child.avatar}</span>
                          <span className="flex-1">{child.name} · PIN {child.pin}</span>
                          <Button
                            variant="ghost"
                            onClick={() =>
                              void resetChildPin(child)
                                .then((next) => {
                                  setChildren(loadChildPasses().filter((c) => c.classCode === code));
                                  setMessage(`Neue PIN für ${next.name}: ${next.pin}`);
                                })
                                .catch(() => setMessage('Die PIN ließ sich nicht zurücksetzen. Später noch einmal versuchen.'))
                            }
                          >
                            PIN zurücksetzen
                          </Button>
                        </li>
                      ))}
                    </ul>
                    <Button onClick={() => printChildCards(children, view.name)}>Alle Karten drucken</Button>
                    <p className="text-xs text-muted">Hat ein Kind seine PIN geändert, zeigt die Liste noch die Start-PIN; „PIN zurücksetzen“ gilt trotzdem.</p>
                  </>
                )}
              </section>
              <Button
                onClick={() => {
                  if (window.confirm('Die Klasse wirklich auflösen? Alle Mitglieder verlieren sie.'))
                    void classAct(code, 'dissolve').then((reply) => {
                      if (reply.ok || reply.status === 200) {
                        forgetClass(code);
                        navigate(paths.classes);
                      } else setMessage(reply.ok ? null : reply.error);
                    });
                }}
              >
                Klasse auflösen
              </Button>
            </section>
          )}

          <Button
            variant="ghost"
            onClick={() =>
              void classAct(code, 'leave').then((reply) => {
                if (reply.ok) {
                  forgetClass(code);
                  navigate(paths.classes);
                } else setMessage(reply.error);
              })
            }
          >
            Klasse verlassen
          </Button>
        </>
      )}

      {message && (
        <p role="status" className="rounded-xl bg-surface-2 p-3 text-sm">
          {message}
        </p>
      )}
    </TavernPage>
  );
}
