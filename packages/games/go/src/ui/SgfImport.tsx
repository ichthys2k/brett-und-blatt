import { useState } from 'react';
import { loadFromSgf, parseSgf, type GoState } from '../rules';

interface SgfImportProps {
  onImport: (state: GoState, sgf: string) => void;
  onClose: () => void;
}

export function SgfImportModal({ onImport, onClose }: SgfImportProps) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ size: number; komi: number; handicap: number; moves: number } | null>(null);

  const checkSgf = (content: string) => {
    setText(content);
    setError(null);
    setPreview(null);
    const trimmed = content.trim();
    if (!trimmed) return;
    try {
      const parsed = parseSgf(trimmed);
      if (![9, 13, 19].includes(parsed.size)) {
        setError(`Nicht unterstützte Brettgröße: ${parsed.size}×${parsed.size} (erlaubt: 9, 13, 19).`);
        return;
      }
      setPreview({
        size: parsed.size,
        komi: parsed.komi,
        handicap: parsed.handicapStones.length,
        moves: parsed.moves.length,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ungültiges SGF-Format.');
    }
  };

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = String(e.target?.result ?? '');
      checkSgf(content);
    };
    reader.readAsText(file);
  };

  const submit = () => {
    try {
      const state = loadFromSgf(text.trim());
      onImport(state, text.trim());
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Laden der Partie.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="sgf-title">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-2xl border border-line bg-surface p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 id="sgf-title" className="text-xl font-bold">
            📥 SGF-Partie importieren
          </h2>
          <button type="button" className="text-xl text-muted hover:text-fg" onClick={onClose} aria-label="Schließen">
            ✕
          </button>
        </div>

        <p className="text-sm text-muted">
          Lade eine Smart Game Format (.sgf)-Datei hoch oder füge den SGF-Code ein, um die Partie ab dem gespeicherten Stand weiterzuspielen.
        </p>

        <div>
          <label className="mb-2 block font-medium text-sm">SGF-Datei auswählen</label>
          <input
            type="file"
            accept=".sgf,text/plain"
            className="w-full text-sm text-muted file:mr-3 file:rounded-xl file:border-0 file:bg-bg file:px-4 file:py-2 file:font-medium file:text-fg hover:file:bg-line cursor-pointer"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file);
            }}
          />
        </div>

        <div>
          <label className="mb-1 block font-medium text-sm">Oder SGF-Code einfügen</label>
          <textarea
            rows={5}
            value={text}
            onChange={(e) => checkSgf(e.target.value)}
            placeholder="(;GM[1]SZ[19]KM[7.5]...)"
            className="w-full rounded-xl border border-line bg-bg p-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-red-400 text-sm" role="alert">
            {error}
          </div>
        )}

        {preview && (
          <div className="rounded-xl border border-line bg-bg p-3 text-sm">
            <p className="font-semibold text-fg">Erkannte Partie:</p>
            <ul className="mt-1 list-inside list-disc text-muted">
              <li>Brettgröße: {preview.size} × {preview.size}</li>
              <li>Komi: {preview.komi} Punkte</li>
              {preview.handicap > 0 && <li>Vorgabesteine: {preview.handicap}</li>}
              <li>Züge: {preview.moves}</li>
            </ul>
          </div>
        )}

        <div className="mt-2 flex justify-end gap-3">
          <button
            type="button"
            className="rounded-xl border border-line px-4 py-2 font-medium hover:bg-line"
            onClick={onClose}
          >
            Abbrechen
          </button>
          <button
            type="button"
            disabled={!preview || error !== null}
            className="rounded-xl bg-accent px-4 py-2 font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={submit}
          >
            Partie laden
          </button>
        </div>
      </div>
    </div>
  );
}
