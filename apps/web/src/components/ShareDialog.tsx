import { useState } from 'react';
import { SHARE_LABEL, SHARE_SECTIONS, buildSnapshot, currentShareLink, publishShare, stopShare, type ShareSection } from '../lib/passShare';
import { findGame } from '../lib/registry';
import { Button } from './controls';

/** PNG der Passkarte: Name, Bild und Zahlen, gezeichnet auf einem Canvas (nichts geht an einen Server). */
function cardPng(sections: readonly ShareSection[]): Promise<Blob | null> {
  const snapshot = buildSnapshot(sections);
  if (!snapshot) return Promise.resolve(null);
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 480;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.resolve(null);
  ctx.fillStyle = '#2a1d10';
  ctx.fillRect(0, 0, 800, 480);
  ctx.strokeStyle = '#8a6a3a';
  ctx.lineWidth = 8;
  ctx.strokeRect(14, 14, 772, 452);
  ctx.fillStyle = '#f2d27a';
  ctx.font = '40px Almendra, Georgia, serif';
  ctx.fillText('Brett & Blatt · Spielerpass', 48, 80);
  ctx.font = '110px sans-serif';
  ctx.fillText(snapshot.avatar, 48, 220);
  ctx.fillStyle = '#f6e7c1';
  ctx.font = '56px Almendra, Georgia, serif';
  ctx.fillText(snapshot.name, 200, 200);
  ctx.font = '28px system-ui, sans-serif';
  const lines: string[] = [];
  if (snapshot.stamps) lines.push(`Stempel: ${snapshot.stamps.reduce((n, s) => n + s.kinds.length, 0)} in ${snapshot.stamps.length} Spielen`);
  if (snapshot.trophies) lines.push(`Pokale: ${snapshot.trophies.length}`);
  if (snapshot.favorites?.length) lines.push(`Lieblingsspiele: ${snapshot.favorites.map((id) => findGame(id)?.name ?? id).slice(0, 4).join(', ')}`);
  lines.forEach((line, i) => ctx.fillText(line, 48, 290 + i * 44));
  ctx.fillStyle = '#bba77a';
  ctx.font = '22px system-ui, sans-serif';
  ctx.fillText('spiele.lipponer.de', 48, 440);
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/png'));
}

/** Pass teilen (#149): Teile wählen, dann als Link (verschlüsselt auf dem Server) oder als Bild. */
export function ShareDialog({ online }: { online: boolean }) {
  const [open, setOpen] = useState(false);
  const [sections, setSections] = useState<ShareSection[]>(['crest', 'stamps', 'trophies']);
  const [link, setLink] = useState<string | null>(() => currentShareLink());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const toggle = (section: ShareSection) => setSections((list) => (list.includes(section) ? list.filter((s) => s !== section) : [...list, section]));
  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    setMessage(null);
    try {
      await task();
    } catch {
      setMessage('Das hat nicht geklappt. Bitte später noch einmal versuchen.');
    } finally {
      setBusy(false);
    }
  };

  const shareImage = () =>
    run(async () => {
      const blob = await cardPng(sections);
      if (!blob) throw new Error('png');
      const file = new File([blob], 'spielerpass.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: 'Mein Spielerpass' });
      else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'spielerpass.png';
        a.click();
        URL.revokeObjectURL(a.href);
      }
    });

  if (!open) {
    return (
      <Button className="w-full" onClick={() => setOpen(true)}>
        🔗 Pass teilen
      </Button>
    );
  }
  return (
    <section className="space-y-3 rounded-2xl border border-line bg-surface p-4" aria-labelledby="share-title">
      <h2 id="share-title" className="text-xl font-bold">
        Pass teilen
      </h2>
      <p className="text-sm text-muted">Das ist ein Schnappschuss von heute. Gezeigt werden Name und Bild und nur, was du hier ankreuzt – nie dein Code.</p>
      <fieldset className="grid grid-cols-2 gap-2">
        <legend className="sr-only">Was soll sichtbar sein?</legend>
        {SHARE_SECTIONS.map((section) => (
          <label key={section} className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-accent" checked={sections.includes(section)} onChange={() => toggle(section)} />
            {SHARE_LABEL[section]}
          </label>
        ))}
      </fieldset>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button disabled={busy} onClick={shareImage}>
          🖼️ Als Bild
        </Button>
        {online && (
          <Button variant="primary" disabled={busy} onClick={() => run(async () => setLink(await publishShare(sections)))}>
            🔗 {link ? 'Link aktualisieren' : 'Link erstellen'}
          </Button>
        )}
      </div>
      {link && (
        <div className="space-y-2">
          <input readOnly className="min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-xs" value={link} aria-label="Link zum Pass" onFocus={(e) => e.currentTarget.select()} />
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              onClick={() => {
                void navigator.clipboard?.writeText(link).then(() => setMessage('Link kopiert.'));
              }}
            >
              Kopieren
            </Button>
            <Button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await stopShare();
                  setLink(null);
                  setMessage('Geteilt wird nicht mehr; der Link zeigt nichts mehr.');
                })
              }
            >
              Teilen beenden
            </Button>
          </div>
          <p className="text-xs text-muted">Wer den Link hat, kann den Schnappschuss ansehen. Nach einem Jahr ohne Abruf wird er gelöscht.</p>
        </div>
      )}
      {message && <p role="status" className="text-sm">{message}</p>}
      <Button variant="ghost" onClick={() => setOpen(false)}>
        Schließen
      </Button>
    </section>
  );
}
