import { ORG_KINDS, ORG_ROLES, canGrantRole, parseOrgCode, type OrgKind, type OrgRequestMine, type OrgRole, type OrgView } from '@brett-und-blatt/online';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '../components/controls';
import { EmojiKeypad, QrCode } from '../components/OnlineParts';
import { TavernPage } from '../components/TavernPage';
import { KIND_LABEL, ROLE_HELP, ROLE_LABEL, roleList } from '../lib/orgLabels';
import { loadMyOrgRequests, loadOrgs, forgetOrg, orgAct, rememberOrg, submitOrgRequest } from '../lib/orgServer';
import { navigate, paths } from '../lib/router';
import { GAME_SERVER } from '../lib/server';
import { storage } from '../lib/storage';

const FIELD = 'min-h-11 w-full rounded-xl border border-line bg-surface px-3';

/** „Verein oder Schule“ (#229): eigene Organisationen, Antrag stellen, mit Einladung beitreten. */
export function Orgs() {
  const profile = storage.loadProfile();
  const [known, setKnown] = useState(loadOrgs);
  const [requests, setRequests] = useState<OrgRequestMine[]>([]);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<OrgKind>('verein');
  const [purpose, setPurpose] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void loadMyOrgRequests().then((list) => alive && setRequests(list));
    return () => {
      alive = false;
    };
  }, []);

  if (!GAME_SERVER)
    return (
      <TavernPage title="Verein oder Schule" back={paths.online}>
        <p className="text-muted">Es gibt gerade keinen Spieleserver.</p>
      </TavernPage>
    );
  if (!profile)
    return (
      <TavernPage title="Verein oder Schule" back={paths.online}>
        <p className="text-muted">Dafür brauchst du einen Namen.</p>
        <button type="button" className="bub-menu-button" onClick={() => navigate(paths.pass)}>
          Profil anlegen
        </button>
      </TavernPage>
    );

  const apply = async () => {
    setBusy(true);
    setError(null);
    setInfo(null);
    const result = await submitOrgRequest({ orgName: name, kind, purpose });
    setBusy(false);
    if ('error' in result) return setError(result.error);
    setInfo('Dein Antrag ist angekommen. Du erfährst hier und auf „Online Spiel“, sobald entschieden ist.');
    setName('');
    setPurpose('');
    setRequests(await loadMyOrgRequests());
  };

  const open = (input: string) => {
    const code = parseOrgCode(input);
    if (!code) return setError('Das ist kein Code. Er besteht aus sechs Bildern.');
    navigate(paths.org(code));
  };
  const openRequests = requests.filter((r) => r.status === 'open');

  return (
    <TavernPage title="Verein oder Schule" subtitle="Eine Gruppe mit Rollen: Wer darf Turniere leiten, Ergebnisse eintragen oder nur zusehen." back={paths.online}>
      {known.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xl">Meine Gruppen</h2>
          <ul className="space-y-1">
            {known.map((item) => (
              <li key={item.code}>
                <Button className="w-full justify-start" onClick={() => navigate(paths.org(item.code))}>
                  🏛️ {item.name}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2" aria-labelledby="org-join">
        <h2 id="org-join" className="text-xl">
          Mit Code öffnen
        </h2>
        <p className="text-sm text-muted">Den Code aus sechs Bildern bekommst du vom Betreiber. Eine Einladung öffnet die Gruppe von selbst.</p>
        <EmojiKeypad length={6} onComplete={open} />
      </section>

      <section className="space-y-2" aria-labelledby="org-apply">
        <h2 id="org-apply" className="text-xl">
          Eine Gruppe beantragen
        </h2>
        <p className="text-sm text-muted">Der Betreiber der Seite gibt jede neue Gruppe frei. Du wirst ihr Betreiber und kannst dann Rollen vergeben.</p>
        {openRequests.length > 0 ? (
          <ul className="space-y-1 text-sm">
            {openRequests.map((r) => (
              <li key={r.id} className="rounded-xl bg-surface-2 p-3">
                ⏳ „{r.orgName}“ ({KIND_LABEL[r.kind]}) wartet auf Freigabe.
              </li>
            ))}
          </ul>
        ) : (
          <form
            className="space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              void apply();
            }}
          >
            <input className={FIELD} aria-label="Name der Gruppe" placeholder="Name, z. B. SV Beispiel" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
            <select className={FIELD} aria-label="Art" value={kind} onChange={(e) => setKind(e.target.value as OrgKind)}>
              {ORG_KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>
            <textarea className={`${FIELD} py-2`} rows={3} aria-label="Wofür ist die Gruppe gedacht?" placeholder="Wofür ist die Gruppe gedacht? (kurz)" maxLength={200} value={purpose} onChange={(e) => setPurpose(e.target.value)} />
            <Button type="submit" variant="primary" className="w-full" disabled={busy || !name.trim() || !purpose.trim()}>
              Antrag stellen
            </Button>
          </form>
        )}
      </section>

      {error && (
        <p role="alert" className="rounded-xl bg-danger/10 p-3 text-danger">
          {error}
        </p>
      )}
      {info && (
        <p role="status" className="rounded-xl bg-surface-2 p-3 text-sm">
          {info}
        </p>
      )}
    </TavernPage>
  );
}

const roleOptions = (view: OrgView): OrgRole[] => ORG_ROLES.filter((role) => canGrantRole(view.me?.roles ?? [], role, view.leaderMayGrant));

function whenText(at: number): string {
  return new Date(at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}
const LOG_TEXT: Record<string, string> = { create: 'angelegt', join: 'beigetreten', invite: 'Einladung erstellt', inviteRevoked: 'Einladung zurückgezogen', offer: 'Rolle angeboten', accept: 'Rolle angenommen', decline: 'Rolle abgelehnt', revoke: 'Rolle entzogen', remove: 'entfernt', leave: 'ausgetreten', config: 'Einstellung geändert' };

/** Eine Gruppe: Mitglieder, eigene Rollen, Einladungen, Rollen vergeben, Protokoll. */
export function Org({ code, invite }: { code: string; invite?: string }) {
  const [view, setView] = useState<OrgView | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [inviteInput, setInviteInput] = useState(invite ?? '');
  const [newInvite, setNewInvite] = useState<{ code: string; roles: OrgRole[] } | null>(null);
  const [inviteRoles, setInviteRoles] = useState<OrgRole[]>([]);
  const [name, setName] = useState('');
  const [offerFor, setOfferFor] = useState<{ id: string; roles: OrgRole[] } | null>(null);
  const profile = storage.loadProfile();

  const apply = useCallback((reply: Awaited<ReturnType<typeof orgAct>>) => {
    if (reply.ok) {
      setView(reply.view);
      setError(null);
      rememberOrg({ code, name: reply.view.name });
      return reply;
    }
    if (reply.status === 404) setMissing(true);
    else setError(reply.error);
    if (reply.view) setView(reply.view);
    return reply;
  }, [code]);

  useEffect(() => {
    let alive = true;
    void orgAct(code, 'view').then((reply) => alive && apply(reply));
    return () => {
      alive = false;
    };
  }, [code, apply]);

  const act = async (action: string, extra: Record<string, unknown> = {}) => {
    setBusy(true);
    const reply = apply(await orgAct(code, action, extra));
    setBusy(false);
    return reply;
  };

  if (!GAME_SERVER)
    return (
      <TavernPage title="Verein oder Schule" back={paths.orgs}>
        <p className="text-muted">Es gibt gerade keinen Spieleserver.</p>
      </TavernPage>
    );
  if (missing)
    return (
      <TavernPage title="Verein oder Schule" back={paths.orgs}>
        <p className="text-muted">Diese Gruppe gibt es nicht (mehr).</p>
        <Button
          onClick={() => {
            forgetOrg(code);
            navigate(paths.orgs);
          }}
        >
          Aus meiner Liste entfernen
        </Button>
      </TavernPage>
    );
  if (!view)
    return (
      <TavernPage title="Verein oder Schule" back={paths.orgs}>
        <p className="text-muted">Lädt …</p>
      </TavernPage>
    );

  const me = view.me;
  const staff = me?.roles.includes('operator') || me?.roles.includes('lead');
  const isOperator = me?.roles.includes('operator') === true;
  const grantable = roleOptions(view);
  const link = (invitation: string) => `${window.location.origin}${window.location.pathname}${paths.org(code)}?einladung=${invitation}`;
  const toggle = (roles: OrgRole[], role: OrgRole): OrgRole[] => (roles.includes(role) ? roles.filter((r) => r !== role) : [...roles, role]);

  return (
    <TavernPage title={view.name} subtitle={KIND_LABEL[view.kind]} back={paths.orgs}>
      {view.status !== 'active' && (
        <p role="status" className="rounded-xl bg-danger/10 p-3 text-danger">
          {view.status === 'blocked' ? 'Diese Gruppe ist gesperrt. Rollen und Einladungen gelten gerade nicht.' : 'Diese Gruppe ist noch nicht freigegeben.'}
        </p>
      )}

      {!me ? (
        <section className="space-y-2" aria-labelledby="org-redeem">
          <h2 id="org-redeem" className="text-xl">
            Beitreten
          </h2>
          <p className="text-sm text-muted">Gib den Einladungscode ein (acht Zeichen) oder öffne den Einladungslink.</p>
          {!profile ? (
            <button type="button" className="bub-menu-button" onClick={() => navigate(paths.pass)}>
              Zuerst ein Profil anlegen
            </button>
          ) : (
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void act('redeem', { invite: inviteInput });
              }}
            >
              <input className={`${FIELD} uppercase`} aria-label="Einladungscode" maxLength={12} placeholder="ABCD2345" value={inviteInput} onChange={(e) => setInviteInput(e.target.value)} />
              <Button type="submit" variant="primary" disabled={busy || inviteInput.trim().length < 8}>
                Beitreten
              </Button>
            </form>
          )}
        </section>
      ) : (
        <>
          <section className="space-y-2" aria-labelledby="org-me">
            <h2 id="org-me" className="text-xl">
              Meine Rollen
            </h2>
            <p className="text-sm">{roleList(me.roles)}</p>
            <ul className="space-y-1 text-xs text-muted">
              {me.roles.map((role) => (
                <li key={role}>
                  <strong>{ROLE_LABEL[role]}:</strong> {ROLE_HELP[role]}
                </li>
              ))}
            </ul>
            {(me.roles.includes('operator') || me.roles.includes('lead')) && <p className="text-xs text-muted">Tipp: Sichere deinen Pass mit PIN oder Passkey, denn die Rolle hängt an ihm.</p>}
            {me.offered.length > 0 && (
              <div role="status" className="space-y-2 rounded-xl border border-line bg-surface-2 p-3 text-sm">
                <p>Dir wird angeboten: <strong>{roleList(me.offered)}</strong></p>
                <div className="flex gap-2">
                  <Button variant="primary" disabled={busy} onClick={() => void act('accept')}>
                    Annehmen
                  </Button>
                  <Button variant="ghost" disabled={busy} onClick={() => void act('decline')}>
                    Ablehnen
                  </Button>
                </div>
              </div>
            )}
          </section>

          <section className="space-y-2" aria-labelledby="org-members">
            <h2 id="org-members" className="text-xl">
              Mitglieder ({view.members.length})
            </h2>
            <ul className="space-y-2">
              {view.members.map((member) => {
                const mine = member.id === me.id;
                const canOffer = !mine && grantable.length > 0;
                return (
                  <li key={member.id} className="space-y-2 rounded-xl border border-line bg-surface p-3">
                    <span className="flex items-center gap-2">
                      <span aria-hidden="true">{member.avatar}</span>
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {member.name}
                        {mine ? ' (du)' : ''}
                      </span>
                      <span className="text-xs text-muted">{roleList(member.roles)}</span>
                    </span>
                    {member.offered && member.offered.length > 0 && <span className="block text-xs text-muted">⏳ Angebot offen: {roleList(member.offered)}</span>}
                    {(canOffer || isOperator) && !mine && (
                      <span className="flex flex-wrap gap-2">
                        {canOffer && (
                          <Button variant="ghost" onClick={() => setOfferFor(offerFor?.id === member.id ? null : { id: member.id, roles: [] })}>
                            Rolle anbieten
                          </Button>
                        )}
                        {member.roles
                          .filter((role) => canGrantRole(me.roles, role, view.leaderMayGrant))
                          .map((role) => (
                            <Button key={role} variant="ghost" disabled={busy} onClick={() => void act('revoke', { id: member.id, roles: [role] })}>
                              {ROLE_LABEL[role]} entziehen
                            </Button>
                          ))}
                        {isOperator && (
                          <Button
                            variant="ghost"
                            disabled={busy}
                            onClick={() => {
                              if (window.confirm(`${member.name} aus der Gruppe entfernen?`)) void act('remove', { id: member.id });
                            }}
                          >
                            Entfernen
                          </Button>
                        )}
                      </span>
                    )}
                    {offerFor?.id === member.id && (
                      <span className="block space-y-2">
                        <span className="flex flex-wrap gap-2">
                          {grantable.map((role) => (
                            <label key={role} className="flex items-center gap-1 text-sm">
                              <input type="checkbox" checked={offerFor.roles.includes(role)} onChange={() => setOfferFor({ id: member.id, roles: toggle(offerFor.roles, role) })} />
                              {ROLE_LABEL[role]}
                            </label>
                          ))}
                        </span>
                        <Button
                          variant="primary"
                          disabled={busy || offerFor.roles.length === 0}
                          onClick={async () => {
                            await act('offer', { id: member.id, roles: offerFor.roles });
                            setOfferFor(null);
                          }}
                        >
                          Anbieten
                        </Button>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          {grantable.length > 0 && (
            <section className="space-y-2" aria-labelledby="org-invite">
              <h2 id="org-invite" className="text-xl">
                Einladen
              </h2>
              <p className="text-sm text-muted">Ein Einladungslink gilt 24 Stunden und nur einmal. Ohne Rolle wird die Person nur Mitglied.</p>
              <div className="flex flex-wrap gap-3">
                {grantable.map((role) => (
                  <label key={role} className="flex items-center gap-1 text-sm">
                    <input type="checkbox" checked={inviteRoles.includes(role)} onChange={() => setInviteRoles(toggle(inviteRoles, role))} />
                    {ROLE_LABEL[role]}
                  </label>
                ))}
              </div>
              <Button
                variant="primary"
                className="w-full"
                disabled={busy}
                onClick={async () => {
                  const reply = await act('invite', { roles: inviteRoles });
                  if (reply.ok && reply.invite) setNewInvite({ code: reply.invite.code, roles: inviteRoles });
                }}
              >
                Einladung erstellen
              </Button>
              {newInvite && (
                <div role="status" className="space-y-2 rounded-xl border border-line bg-surface-2 p-3 text-sm">
                  <p>
                    Für <strong>{roleList(newInvite.roles)}</strong>. Zeig den Code nur der eingeladenen Person, er wird nicht noch einmal angezeigt.
                  </p>
                  <p className="text-xl font-semibold tracking-widest">{newInvite.code}</p>
                  <div className="mx-auto w-44">
                    <QrCode text={link(newInvite.code)} label="Einladungslink" />
                  </div>
                  <Button className="w-full" onClick={() => navigator.clipboard?.writeText(link(newInvite.code))}>
                    🔗 Link kopieren
                  </Button>
                </div>
              )}
              {staff && view.invites.length > 0 && (
                <ul className="space-y-1 text-sm">
                  {view.invites.map((item) => (
                    <li key={item.id} className="flex items-center gap-2 rounded-xl border border-line bg-surface p-2">
                      <span className="min-w-0 flex-1">
                        {roleList(item.roles)} · gültig bis {whenText(item.expiresAt)}
                      </span>
                      <Button variant="ghost" disabled={busy} onClick={() => void act('revokeInvite', { id: item.id })}>
                        Zurückziehen
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {isOperator && (
            <section className="space-y-2" aria-labelledby="org-settings">
              <h2 id="org-settings" className="text-xl">
                Einstellungen
              </h2>
              <form
                className="flex gap-2"
                onSubmit={async (event) => {
                  event.preventDefault();
                  await act('configure', { name });
                  setName('');
                }}
              >
                <input className={FIELD} aria-label="Neuer Name" placeholder="Name ändern" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
                <Button type="submit" disabled={busy || !name.trim()}>
                  Ändern
                </Button>
              </form>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={view.leaderMayGrant} onChange={(e) => void act('configure', { leaderMayGrant: e.target.checked })} />
                Die Leitung darf Rollen unterhalb der Leitung vergeben
              </label>
            </section>
          )}

          {staff && view.log.length > 0 && (
            <section className="space-y-2" aria-labelledby="org-log">
              <h2 id="org-log" className="text-xl">
                Protokoll
              </h2>
              <ul className="space-y-1 text-xs text-muted">
                {[...view.log].reverse().map((entry, index) => {
                  const who = view.members.find((m) => m.id === entry.by)?.name ?? 'jemand';
                  const target = entry.subject && entry.subject !== entry.by ? ` → ${view.members.find((m) => m.id === entry.subject)?.name ?? 'jemand'}` : '';
                  return (
                    <li key={`${entry.at}-${index}`}>
                      {whenText(entry.at)} · {who}: {LOG_TEXT[entry.action] ?? entry.action}
                      {entry.roles && entry.roles.length > 0 ? ` (${roleList(entry.roles)})` : ''}
                      {target}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <Button
            variant="ghost"
            className="w-full"
            disabled={busy}
            onClick={async () => {
              if (!window.confirm('Die Gruppe verlassen?')) return;
              const reply = await act('leave');
              if (reply.ok) {
                forgetOrg(code);
                navigate(paths.orgs);
              }
            }}
          >
            Gruppe verlassen
          </Button>
        </>
      )}

      {error && (
        <p role="alert" className="rounded-xl bg-danger/10 p-3 text-danger">
          {error}
        </p>
      )}
    </TavernPage>
  );
}
