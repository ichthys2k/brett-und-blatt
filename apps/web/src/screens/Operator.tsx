import { parseClassCode, type OpenRoomListing } from '@brett-und-blatt/online';
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
  const [kind, setKind] = useState<'turnier' | 'klasse' | 'serie'>('turnier');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  async function call(method: 'GET' | 'DELETE', path: string): Promise<{ status: number; body: Record<string, unknown> }> {
    const response = await fetch(`${GAME_SERVER}/betreiber/${path}`, { method, headers: { Authorization: `Bearer ${key.trim()}` } });
    return { status: response.status, body: (await response.json().catch(() => ({}))) as Record<string, unknown> };
  }
  const explain = (status: number, body: Record<string, unknown>): string =>
    status === 401 ? 'Der Schlüssel ist falsch.' : status === 429 ? 'Zu viele Versuche. Bitte später noch einmal.' : body.error === 'aus' ? 'Die Betreiber-Funktion ist auf dem Server nicht eingerichtet (Secret OPERATOR_KEY fehlt).' : `Fehler ${status}.`;

  const load = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const { status, body } = await call('GET', 'liste');
      if (status === 200) setList((body.turniere as OpenRoomListing[]) ?? []);
      else {
        setList(null);
        setMessage(explain(status, body));
      }
    } catch {
      setMessage('Keine Verbindung zum Spieleserver.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (what: 'turnier' | 'klasse' | 'serie', target: string, label: string) => {
    if (!window.confirm(`${what === 'turnier' ? 'Das Turnier' : what === 'serie' ? 'Die Serie' : 'Die Klasse'} „${label}“ endgültig löschen? Das lässt sich nicht rückgängig machen.`)) return;
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

  if (!GAME_SERVER) return <TavernPage title="Betreiber" back={paths.menu}><p className="text-muted">Es gibt gerade keinen Spieleserver.</p></TavernPage>;

  return (
    <TavernPage title="Betreiber" subtitle="Turniere und Klassen aufräumen." back={paths.menu}>
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

      <section className="space-y-2" aria-labelledby="op-code">
        <h2 id="op-code" className="text-xl">
          Per Code löschen
        </h2>
        <select className={FIELD} aria-label="Was löschen?" value={kind} onChange={(e) => setKind(e.target.value as 'turnier' | 'klasse' | 'serie')}>
          <option value="turnier">Turnier (Code aus der Adresse)</option>
          <option value="klasse">Klasse (sechs Bilder)</option>
          <option value="serie">Serie</option>
        </select>
        <input className={FIELD} aria-label="Code" placeholder={kind === 'turnier' ? 'K7M2QX4P' : '🐶🐱🦊🐻🐸🐧'} value={code} onChange={(e) => setCode(e.target.value)} />
        <Button
          disabled={busy || key.trim().length < 16 || !code.trim()}
          onClick={() => {
            const target = kind === 'klasse' ? parseClassCode(code) : code.trim().toUpperCase();
            if (!target) return setMessage('Das ist kein gültiger Code.');
            void remove(kind, target, code.trim());
          }}
        >
          🗑️ Löschen
        </Button>
      </section>

      {message && (
        <p role="status" className="rounded-xl bg-surface-2 p-3 text-sm">
          {message}
        </p>
      )}
    </TavernPage>
  );
}
