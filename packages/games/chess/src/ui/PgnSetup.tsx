import { useState } from 'react';
import { loadFromPgn, turnSeat } from '../rules';

/**
 * Einrichtung: eine PGN-Partie einfügen oder als Datei laden und von dort weiterspielen.
 * Schreibt die geprüfte Partie in die verborgene Option `pgn` (nur am eigenen Gerät wirksam).
 */
export function PgnSetup({ options, setOption }: { options: Record<string, string>; seats: number; setOption: (id: string, value: string) => void }) {
  const [text, setText] = useState(options.pgn ?? '');
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const check = (value: string) => {
    setText(value);
    setInfo(null);
    setError(null);
    setOption('pgn', '');
    if (!value.trim()) return;
    try {
      const state = loadFromPgn(value.trim());
      setOption('pgn', value.trim());
      const moves = Math.ceil(state.history.length / 2);
      setInfo(state.end ? `${moves} Züge – die Partie ist schon zu Ende.` : `${moves} Züge geladen, ${turnSeat(state.fen) === 0 ? 'Weiß' : 'Schwarz'} ist am Zug.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ungültige PGN-Partie.');
    }
  };

  return (
    <details className="rounded-2xl border border-line bg-surface p-4 shadow-sm" open={text.length > 0}>
      <summary className="cursor-pointer font-medium text-fg">📥 PGN-Partie fortsetzen</summary>
      <div className="mt-3 space-y-2">
        <p className="text-sm text-muted">
          Füge eine Partie im PGN-Format ein (aus einem anderen Schachprogramm oder über „PGN kopieren“ in der Chronik) – gespielt wird ab dem letzten Zug. Gilt nur
          für Partien an diesem Gerät.
        </p>
        <textarea
          className="h-28 w-full rounded-xl border border-line bg-bg p-2 font-mono text-sm"
          value={text}
          onChange={(e) => check(e.target.value)}
          placeholder={'1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 …'}
          aria-label="PGN-Partie"
          spellCheck={false}
        />
        <input
          type="file"
          accept=".pgn,text/plain"
          className="w-full text-sm text-muted file:mr-3 file:rounded-xl file:border-0 file:bg-bg file:px-4 file:py-2 file:font-medium file:text-fg hover:file:bg-line cursor-pointer"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void file.text().then(check);
          }}
          aria-label="PGN-Datei laden"
        />
        {info && <p className="text-sm text-fg">✅ {info}</p>}
        {error && (
          <p className="text-sm text-danger" role="alert">
            ⚠️ {error}
          </p>
        )}
      </div>
    </details>
  );
}
