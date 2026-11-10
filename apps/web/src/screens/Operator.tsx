import { parseClassCode, parseOrgCode, type OpenRoomListing, type OrgRequestListing } from '@brett-und-blatt/online';
import { useState } from 'react';
import { Button } from '../components/controls';
import { TavernPage } from '../components/TavernPage';
import { GAME_SERVER } from '../lib/server';
import { paths } from '../lib/router';

const FIELD = 'min-h-11 w-full rounded-xl border border-line bg-surface px-3';

/**
 * Betreiber-Seite (`#/betreiber`, nirgends verlinkt): Mit dem Betreiber-Schlüssel (`OPERATOR_KEY`) offene Turniere ansehen und löschen,
 * Turniere und Klassen auch per Code. Der Schlüssel bleibt nur im Speicher dieser Seite; ohne ihn zeigt der Server nichts.
 */
export function Operator() {
  const [key, setKey] = useState('');
  const [list, setList] = useState<OpenRoomListing[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [kind, setKind] = useState<'turnier' | 'klasse' | 'serie' | 'org'>('turnier');
  const [requests, setRequests] = useState<OrgRequestListing[] | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  async function call(method: 'GET' | 'DELETE' | 'POST', path: string, payload?: Record<string, unknown>): Promise<{ status: number; body: Record<string, unknown> }> {
    const response = await fetch(`${GAME_SERVER}/betreiber/${path}`, { method, headers: { Authorization: `Bearer ${key.trim()}`, ...(payload ? { 'Content-Type': 'application/json' } : {}) }, ...(payload ? { body: JSON.stringify(payload) } : {}) });
    return { status: response.status, body: (await response.json().catch(() => ({}))) as Record<string, unknown> };
  }
  const explain = (status: number, body: Record<string, unknown>): string =>
    status === 401 ? 'Der Schlüssel ist falsch.' : status === 429 ? 'Zu viele Versuche. Bitte später noch einmal.' : body.error === 'aus' ? 'Die Betreiber-Funktion ist auf dem Server nicht eingerichtet (Secret OPERATOR_KEY fehlt).' : `Fehler ${status}.`;

  const load = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const { status, body } = await call('GET', 'liste');
      if (status === 200) {
        setList((body.turniere as OpenRoomListing[]) ?? []);
        const desk = await call('GET', 'antraege');
        setRequests(desk.status === 200 ? ((desk.body.antraege as OrgRequestListing[]) ?? []) : null);
      } else {
        setList(null);
        setMessage(explain(status, body));
      }
    } catch {
      setMessage('Keine Verbindung zum Spieleserver.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (what: 'turnier' | 'klasse' | 'serie' | 'org', target: string, label: string) => {
    if (!window.confirm(`${what === 'turnier' ? 'Das Turnier' : what === 'serie' ? 'Die Serie' : what === 'org' ? 'Die Organisation' : 'Die Klasse'} „${label}“ endgültig löschen? Das lässt sich nicht rückgängig machen.`)) return;
    setBusy(true);
    setMessage(null);
    try {
      const { status, body } = await call('DELETE', `${what}/${encodeURIComponent(target)}`);
      setMessage(status === 200 ? `„${label}“ ist gelöscht.` : status === 404 && body.error !== 'aus' ? 'Das gibt es nicht (mehr).' : explain(status, body));
      if (status === 200 && list) await load();
    } catch {
      setMessage('Keine Verbindung zum Spieleserver.');
    } finally {
      setBusy(false);
    }
  };

  const decide = async (request: OrgRequestListing, approve: boolean) => {
    const note = approve ? '' : (window.prompt('Anmerkung für den Antragsteller (leer lassen ist erlaubt):') ?? null);
    if (note === null) return;
    setBusy(true);
    setMessage(null);
    try {
      const { status, body } = await call('POST', `antrag/${request.id}`, { approve, note });
      setMessage(status === 200 ? (approve ? `„${request.orgName}“ ist freigegeben${typeof body.code === 'string' ? ` (Code ${body.code})` : ''}.` : `Antrag „${request.orgName}“ ist abgelehnt.`) : explain(status, body));
      if (status === 200) await load();
    } catch {
      setMessage('Keine Verbindung zum Spieleserver.');
    } finally {
      setBusy(false);
    }
  };

  const block = async (blocked: boolean) => {
    const target = parseOrgCode(code);
    if (!target) return setMessage('Das ist kein gültiger Organisations-Code (sechs Bilder).');
    setBusy(true);
    setMessage(null);
    try {
      const { status, body } = await call('POST', `org-sperre/${encodeURIComponent(target)}`, { blocked });
      setMessage(status === 200 ? (blocked ? 'Die Organisation ist gesperrt.' : 'Die Organisation ist wieder frei.') : status === 404 && body.error !== 'aus' ? 'Das gibt es nicht (mehr).' : explain(status, body));
    } catch {
      setMessage('Keine Verbindung zum Spieleserver.');
    } finally {
      setBusy(false);
    }
  };

  if (!GAME_SERVER) return <TavernPage title="Betreiber" back={paths.menu}><p className="text-muted">Es gibt gerade keinen Spieleserver.</p></TavernPage>;

  return (
    <TavernPage title="Betreiber" subtitle="Turniere, Klassen und Organisationen verwalten." back={paths.menu}>
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          void load();
        }}
      >
        <label className="block space-y-1 text-sm">
          <span>Betreiber-Schlüssel</span>
          <input className={FIELD} type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} />
        </label>
        <Button type="submit" variant="primary" className="w-full" disabled={busy || key.trim().length < 16}>
          Anmelden und Turniere laden
        </Button>
        <p className="text-xs text-muted">Der Schlüssel bleibt nur auf dieser Seite im Speicher und wird nirgends gesichert.</p>
      </form>

      {list && (
        <section className="space-y-2" aria-labelledby="op-list">
          <h2 id="op-list" className="text-xl">
            Offene Turniere ({list.length})
          </h2>
          {list.length === 0 ? (
            <p className="text-sm text-muted">Gerade steht kein Turnier in der Liste. Nicht öffentliche Turniere erscheinen hier nicht; sie löschst du unten mit ihrem Code.</p>
          ) : (
            <ul className="space-y-2">
              {list.map((room) => (
                <li key={room.code} className="flex items-center gap-2 rounded-xl border border-line bg-surface p-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{room.gameName}</span>
                    <span className="block truncate text-xs text-muted">
                      {room.hostAvatar} {room.hostName} · {room.filledSeats} angemeldet · Code {room.code}
                    </span>
                  </span>
                  <Button variant="ghost" disabled={busy} onClick={() => void remove('turnier', room.code, room.gameName)}>
                    🗑️ Löschen
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {requests && (
        <section className="space-y-2" aria-labelledby="op-requests">
          <h2 id="op-requests" className="text-xl">
            Anträge auf Organisationen ({requests.length})
          </h2>
          {requests.length === 0 ? (
            <p className="text-sm text-muted">Gerade ist kein Antrag offen.</p>
          ) : (
            <ul className="space-y-2">
              {requests.map((request) => (
                <li key={request.id} className="space-y-2 rounded-xl border border-line bg-surface p-3">
                  <span className="block font-medium">
                    {request.orgName} <span className="text-xs font-normal text-muted">({request.kind === 'verein' ? 'Verein' : request.kind === 'schule' ? 'Schule' : 'Klasse'})</span>
                  </span>
                  <span className="block text-xs text-muted">
                    {request.avatar} {request.name} · {new Date(request.at).toLocaleDateString('de-DE')}
                  </span>
                  <span className="block text-sm">{request.purpose}</span>
                  <span className="flex gap-2">
                    <Button variant="primary" disabled={busy} onClick={() => void decide(request, true)}>
                      ✅ Freigeben
                    </Button>
                    <Button variant="ghost" disabled={busy} onClick={() => void decide(request, false)}>
                      ❌ Ablehnen
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="space-y-2" aria-labelledby="op-code">
        <h2 id="op-code" className="text-xl">
          Per Code löschen
        </h2>
        <select className={FIELD} aria-label="Was löschen?" value={kind} onChange={(e) => setKind(e.target.value as 'turnier' | 'klasse' | 'serie' | 'org')}>
          <option value="turnier">Turnier (Code aus der Adresse)</option>
          <option value="klasse">Klasse (sechs Bilder)</option>
          <option value="serie">Serie</option>
          <option value="org">Organisation (sechs Bilder)</option>
        </select>
        <input className={FIELD} aria-label="Code" placeholder={kind === 'turnier' || kind === 'serie' ? 'K7M2QX4P' : '🐶🐱🦊🐻🐸🐧'} value={code} onChange={(e) => setCode(e.target.value)} />
        <Button
          disabled={busy || key.trim().length < 16 || !code.trim()}
          onClick={() => {
            const target = kind === 'klasse' ? parseClassCode(code) : kind === 'org' ? parseOrgCode(code) : code.trim().toUpperCase();
            if (!target) return setMessage('Das ist kein gültiger Code.');
            void remove(kind, target, code.trim());
          }}
        >
          🗑️ Löschen
        </Button>
        {kind === 'org' && (
          <span className="flex gap-2">
            <Button variant="ghost" disabled={busy || key.trim().length < 16 || !code.trim()} onClick={() => void block(true)}>
              🔒 Sperren
            </Button>
            <Button variant="ghost" disabled={busy || key.trim().length < 16 || !code.trim()} onClick={() => void block(false)}>
              🔓 Entsperren
            </Button>
          </span>
        )}
      </section>

      {message && (
        <p role="status" className="rounded-xl bg-surface-2 p-3 text-sm">
          {message}
        </p>
      )}
    </TavernPage>
  );
}
