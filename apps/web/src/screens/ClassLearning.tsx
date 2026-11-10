import type { ClassPack, ClassView } from '@brett-und-blatt/online';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '../components/controls';
import { listPacks, type PackSummary } from '../lib/ankiStore';
import { QrCode } from '../components/OnlineParts';
import { LEARNING_NOTICE, classGameLink, hasDueConsent, loadDueAggregate, sendDue, setDueConsent, withdrawDue, type DueAggregate, addPackToClass, adoptClassPack, classPackLinks, ensureLeadKeys, frontTexts, hasLearningConsent, loadMemberProgress, sendProgress, setLearningConsent, withdrawProgress, type MemberProgress } from '../lib/classLearning';
import { classAct } from '../lib/classes';
import { navigate, paths } from '../lib/router';

type Apply = (action: string, extra?: Record<string, unknown>) => Promise<ClassView | undefined>;

/** Der Hinweis zum Lernstand (Wortlaut bestätigt). */
export function LearningNotice({ className = '' }: { className?: string }) {
  return (
    <p role="note" className={`rounded-xl border border-line bg-surface-2 p-3 text-sm ${className}`}>
      {LEARNING_NOTICE}
    </p>
  );
}

// ---------------------------------------------------------------- Pakete der Klasse

/** Pakete der Klasse: Mitglieder übernehmen sie, die Leitung legt eigene Anki-Pakete hinein. */
export function ClassPacks({ code, view, apply }: { code: string; view: ClassView; apply: Apply }) {
  const [links, setLinks] = useState(() => classPackLinks(code));
  const [mine, setMine] = useState<PackSummary[]>([]);
  const [pick, setPick] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    if (view.lead) void listPacks().then(setMine, () => setMine([]));
  }, [view.lead]);

  const run = async (id: string, task: () => Promise<void>) => {
    setBusy(id);
    setNote(null);
    try {
      await task();
    } catch {
      setNote('Das hat nicht geklappt. Bitte später noch einmal versuchen.');
    } finally {
      setBusy(null);
    }
  };
  if (view.packs.length === 0 && !view.lead) return null;
  return (
    <section className="space-y-2" aria-labelledby="class-packs">
      <h2 id="class-packs" className="text-xl">
        Pakete der Klasse
      </h2>
      {view.packs.length === 0 && <p className="text-sm text-muted">Noch kein Paket in dieser Klasse.</p>}
      <ul className="space-y-2">
        {view.packs.map((pack: ClassPack) => {
          const local = links[pack.id];
          return (
            <li key={pack.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface p-3">
              <span className="min-w-0 flex-1 truncate font-medium">📦 {pack.name}</span>
              {local ? (
                <Button onClick={() => navigate(paths.learning(local))}>Lernen</Button>
              ) : view.lead ? null : (
                <Button
                  variant="primary"
                  disabled={busy === pack.id}
                  onClick={() =>
                    void run(pack.id, async () => {
                      const result = await adoptClassPack(code, pack);
                      if (typeof result === 'string' && (result === 'missing' || result === 'error')) setNote(result === 'missing' ? 'Das Paket gibt es nicht mehr.' : 'Das Paket konnte nicht geöffnet werden.');
                      else setLinks(classPackLinks(code));
                    })
                  }
                >
                  Übernehmen
                </Button>
              )}
              {view.lead && (
                <Button variant="ghost" aria-label={`${pack.name} aus der Klasse nehmen`} disabled={busy === pack.id} onClick={() => void run(pack.id, async () => void (await apply('removePack', { id: pack.id })))}>
                  🗑️
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {view.lead && (
        <div className="space-y-2 rounded-xl border border-line p-3">
          <p className="text-sm text-muted">
            Lege eines deiner Anki-Pakete in die Klasse (Import unter „Meine Pakete“). Es wird ohne Lernstand, mit Bildern und Tönen, verschlüsselt abgelegt. Der Schlüssel geht an die Mitglieder der Klasse; der Server gibt ihn nur an sie weiter, könnte das Paket damit aber lesen. Lege nur Pakete hinein, die du teilen darfst.
          </p>
          {mine.length === 0 ? (
            <p className="text-sm text-muted">Du hast noch kein Anki-Paket importiert.</p>
          ) : (
            <div className="flex gap-2">
              <select className="min-h-11 w-full rounded-xl border border-line bg-surface px-3" aria-label="Paket für die Klasse wählen" value={pick} onChange={(e) => setPick(e.target.value)}>
                <option value="">Paket wählen …</option>
                {mine.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.cards} Karten)
                  </option>
                ))}
              </select>
              <Button
                variant="primary"
                disabled={!pick || busy === 'add'}
                onClick={() =>
                  void run('add', async () => {
                    const chosen = mine.find((p) => p.id === pick);
                    if (!chosen) return;
                    const result = await addPackToClass(code, chosen.id, chosen.name);
                    if (!result.ok) setNote(result.error);
                    else {
                      setPick('');
                      setLinks(classPackLinks(code));
                      await apply('view');
                    }
                  })
                }
              >
                In die Klasse
              </Button>
            </div>
          )}
        </div>
      )}
      {note && (
        <p role="status" className="text-sm">
          {note}
        </p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- Lernstand: Mitglied

/** Mitglied: Hinweis, Einwilligung und Widerruf. Gesendet wird erst nach der Einwilligung. */
export function LearningMember({ code, view }: { code: string; view: ClassView }) {
  const [consent, setConsent] = useState(() => hasLearningConsent(code));
  const [note, setNote] = useState<string | null>(null);
  if (!view.learning || view.lead) return null;
  return (
    <section className="space-y-2 rounded-xl border border-line bg-surface p-3" aria-labelledby="class-learning-member">
      <h2 id="class-learning-member" className="text-xl">
        Lernstand für die Leitung
      </h2>
      <LearningNotice />
      {consent ? (
        <>
          <p role="status" className="text-sm">
            Du hast zugestimmt: Die Leitung sieht deinen Lernstand der Pakete dieser Klasse.
          </p>
          <Button
            onClick={() =>
              void withdrawProgress(code).then(() => {
                setConsent(false);
                setNote('Die Leitung sieht nichts mehr; der abgelegte Stand ist gelöscht.');
              })
            }
          >
            Nicht mehr teilen
          </Button>
        </>
      ) : (
        <Button
          variant="primary"
          className="w-full"
          onClick={() => {
            setLearningConsent(code, true);
            setConsent(true);
            void sendProgress(code, view);
          }}
        >
          Ich habe das gelesen und bin einverstanden
        </Button>
      )}
      {note && (
        <p role="status" className="text-sm">
          {note}
        </p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- Lernstand: Leitung

const KIND = ['neu', 'lernen', 'wiederholen', 'neu lernen'];

/** Leitung: Lernstand ein- oder ausschalten und die Stände der Mitglieder lesen. */
export function LearningLead({ code, view, apply }: { code: string; view: ClassView; apply: Apply }) {
  const [rows, setRows] = useState<MemberProgress[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [fronts, setFronts] = useState<Map<string, string>>(new Map());
  const me = view.me;

  // Der öffentliche Schlüssel der Leitung muss in der Klasse stehen, damit Mitglieder für sie verschlüsseln können.
  useEffect(() => {
    if (!view.learning || !me) return;
    void ensureLeadKeys().then(async (keys) => {
      if (!view.leadKeys.some((k) => k.id === me && k.key === keys.pub)) await classAct(code, 'leadKey', { key: keys.pub });
    });
  }, [code, me, view.learning, view.leadKeys]);

  const reload = useCallback(async () => {
    if (!me) return;
    const list = await loadMemberProgress(code, me);
    if (!list) return setProblem('Die Stände konnten nicht geholt werden.');
    setProblem(null);
    setRows(list);
    const texts = new Map<string, string>();
    for (const pack of view.packs) for (const [guid, text] of await frontTexts(code, pack.id)) texts.set(guid, text);
    setFronts(texts);
  }, [code, me, view.packs]);
  useEffect(() => {
    if (view.learning) void reload();
    else setRows(null);
  }, [view.learning, view.members, reload]);

  const nameOf = (id: string) => view.members.find((m) => m.id === id);
  return (
    <section className="space-y-2" aria-labelledby="class-learning-lead">
      <h2 id="class-learning-lead" className="text-xl">
        Lernstand der Mitglieder
      </h2>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1 h-4 w-4 accent-accent" checked={view.learning} onChange={(e) => void apply('configure', { learning: e.target.checked })} />
        <span>
          Ich möchte den Lernstand der Mitglieder zu den Paketen dieser Klasse sehen. Jedes Mitglied (bei Kindern die Eltern) bekommt zuerst den Hinweis unten und muss zustimmen. Der Stand ist verschlüsselt; nur du kannst ihn öffnen. Beim Ausschalten wird alles Abgelegte gelöscht.
        </span>
      </label>
      <LearningNotice />
      {view.learning && problem && (
        <p role="alert" className="text-sm text-danger">
          {problem}
        </p>
      )}
      {view.learning && rows && rows.length === 0 && <p className="text-sm text-muted">Noch hat niemand zugestimmt und gelernt.</p>}
      {view.learning && rows && rows.length > 0 && (
        <ul className="space-y-2">
          {rows.map((row) => {
            const member = nameOf(row.id);
            return (
              <li key={row.id} className="space-y-1 rounded-xl border border-line bg-surface p-3">
                <button type="button" className="flex min-h-11 w-full items-center gap-2 text-left" aria-expanded={open === row.id} onClick={() => setOpen(open === row.id ? null : row.id)}>
                  <span aria-hidden="true" className="text-2xl">
                    {member?.avatar ?? '👤'}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">{member?.name ?? 'Mitglied'}</span>
                  <span className="flex-none text-xs text-muted">{new Date(row.at).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}</span>
                </button>
                {!row.data && <p className="text-sm text-muted">Dieser Stand ist mit einem anderen Schlüssel verschlüsselt und lässt sich hier nicht öffnen. Er wird beim nächsten Abgleich des Mitglieds neu abgelegt.</p>}
                {row.data?.packs.map((p) => {
                  const pack = view.packs.find((x) => x.id === p.id);
                  return (
                    <div key={p.id} className="space-y-1 text-sm">
                      <p>
                        <strong>{pack?.name ?? 'Paket'}</strong>: {p.learned} von {p.cards} Karten gelernt · {p.review} in Wiederholung · {p.due} fällig · {p.lapses} Mal vergessen · {p.answers7} Antworten in 7 Tagen
                        {p.streak > 0 ? ` · 🔥 ${p.streak} ${p.streak === 1 ? 'Tag' : 'Tage'} in Folge` : ''}
                      </p>
                      {open === row.id && p.weak.length > 0 && (
                        <table className="w-full text-left text-xs">
                          <caption className="sr-only">Schwache Karten von {member?.name}</caption>
                          <thead>
                            <tr>
                              <th scope="col">Karte</th>
                              <th scope="col">Stand</th>
                              <th scope="col">Wiederholt</th>
                              <th scope="col">Vergessen</th>
                            </tr>
                          </thead>
                          <tbody>
                            {p.weak.map(([guid, kind, reps, lapses]) => (
                              <tr key={guid}>
                                <td className="max-w-40 truncate">{fronts.get(guid) || guid.slice(0, 6)}</td>
                                <td>{KIND[kind] ?? '?'}</td>
                                <td>{reps}</td>
                                <td>{lapses}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  );
                })}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- Fällige Karten der Klasse

/** Wortlaut der Zustimmung zu den fälligen Karten (Entwurf, von Cornelius noch zu bestätigen). */
export const DUE_NOTICE = 'Dein Gerät meldet der Klasse nur, welche Karten der Klassenpakete bei dir gerade fällig sind – ohne deinen Namen und ohne Zahlen. Daraus entsteht für die Leitung eine Liste der Karten, die in der Klasse am häufigsten fällig sind, zum Beispiel für ein Klassenspiel. Erst ab drei Meldungen gibt es überhaupt eine Liste. Du kannst jederzeit widerrufen; dann wird deine Meldung gelöscht.';

/** Mitglied: anonyme Meldung fälliger Karten. */
export function DueMember({ code, view }: { code: string; view: ClassView }) {
  const [consent, setConsent] = useState(() => hasDueConsent(code));
  if (!view.dueCards || view.lead) return null;
  return (
    <section className="space-y-2 rounded-xl border border-line bg-surface p-3" aria-labelledby="class-due-member">
      <h2 id="class-due-member" className="text-xl">
        Fällige Karten der Klasse
      </h2>
      <p role="note" className="rounded-xl border border-line bg-surface-2 p-3 text-sm">
        {DUE_NOTICE}
      </p>
      {consent ? (
        <>
          <p role="status" className="text-sm">
            Du meldest anonym deine fälligen Karten.
          </p>
          <Button
            onClick={() =>
              void withdrawDue(code).then(() => {
                setConsent(false);
              })
            }
          >
            Nicht mehr melden
          </Button>
        </>
      ) : (
        <Button
          variant="primary"
          className="w-full"
          onClick={() => {
            setDueConsent(code, true);
            setConsent(true);
            void sendDue(code, view);
          }}
        >
          Ich habe das gelesen und melde mit
        </Button>
      )}
    </section>
  );
}

/** Leitung: Sammeln ein- und ausschalten, die häufigsten fälligen Karten sehen, ein Klassenspiel daraus machen. */
export function DueLead({ code, view, apply }: { code: string; view: ClassView; apply: Apply }) {
  const [aggregate, setAggregate] = useState<DueAggregate | null>(null);
  const [fronts, setFronts] = useState<Map<string, string>>(new Map());
  const [packId, setPackId] = useState('');
  const [game, setGame] = useState<{ link: string; pairs: number; preferred: number } | 'none' | null>(null);
  useEffect(() => {
    if (!view.dueCards) return void setAggregate(null);
    void loadDueAggregate(code).then(setAggregate);
  }, [code, view.dueCards, view.members]);
  useEffect(() => {
    void (async () => {
      const texts = new Map<string, string>();
      for (const pack of view.packs) for (const [guid, text] of await frontTexts(code, pack.id)) texts.set(guid, text);
      setFronts(texts);
    })();
  }, [code, view.packs]);
  const chosen = view.packs.find((p) => p.id === (packId || view.packs[0]?.id));
  return (
    <section className="space-y-2" aria-labelledby="class-due-lead">
      <h2 id="class-due-lead" className="text-xl">
        Fällige Karten der Klasse
      </h2>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1 h-4 w-4 accent-accent" checked={view.dueCards} onChange={(e) => void apply('configure', { dueCards: e.target.checked })} />
        <span>Geräte dürfen anonym melden, welche Karten der Klassenpakete bei ihnen fällig sind (ohne Namen; jedes Mitglied stimmt selbst zu; Liste erst ab drei Meldungen). Beim Ausschalten werden alle Meldungen gelöscht.</span>
      </label>
      {view.dueCards && aggregate && (
        <>
          <p role="status" className="text-sm text-muted">
            {aggregate.reporters} {aggregate.reporters === 1 ? 'Meldung' : 'Meldungen'}
            {aggregate.cards.length === 0 ? ' – erst ab drei Meldungen gibt es eine Liste.' : ''}
          </p>
          {aggregate.cards.length > 0 && (
            <ol className="list-decimal space-y-0.5 pl-5 text-sm" aria-label="Häufigste fällige Karten">
              {aggregate.cards.slice(0, 10).map(({ card, n }) => (
                <li key={card}>
                  {fronts.get(card) || card.slice(0, 8)} <span className="text-muted">({n} von {aggregate.reporters})</span>
                </li>
              ))}
            </ol>
          )}
          {view.packs.length > 0 && (
            <div className="space-y-2 rounded-xl border border-line p-3">
              <h3 className="text-lg">Klassenspiel „Paare finden“</h3>
              <p className="text-sm text-muted">Ein Link (oder QR-Code für die Tafel), der „Paare finden“ mit Paaren aus dem Klassenpaket startet, die fälligen Karten zuerst. Jeder spielt allein am eigenen Gerät.</p>
              <div className="flex gap-2">
                <select className="min-h-11 w-full rounded-xl border border-line bg-surface px-3" aria-label="Klassenpaket für das Spiel" value={chosen?.id ?? ''} onChange={(e) => (setPackId(e.target.value), setGame(null))}>
                  {view.packs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <Button
                  variant="primary"
                  disabled={!chosen}
                  onClick={() => void (chosen ? classGameLink(code, chosen, aggregate.cards).then((g) => setGame(g ?? 'none')) : undefined)}
                >
                  Link erstellen
                </Button>
              </div>
              {game === 'none' && <p role="alert" className="text-sm">Aus diesem Paket lassen sich keine Paare machen (mindestens 6 Notizen mit zwei Textfeldern, ohne Bild und Ton) oder du hast es nicht auf diesem Gerät.</p>}
              {game && game !== 'none' && (
                <div className="space-y-2">
                  <p className="text-sm">
                    {game.pairs} Paare, davon {game.preferred} fällige zuerst.
                  </p>
                  <input readOnly className="min-h-11 w-full rounded-xl border border-line bg-surface px-3" value={game.link} aria-label="Link zum Klassenspiel" onFocus={(e) => e.currentTarget.select()} />
                  <QrCode text={game.link} label="QR-Code für das Klassenspiel" />
                  <Button onClick={() => void navigator.clipboard?.writeText(game.link)}>Link kopieren</Button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
