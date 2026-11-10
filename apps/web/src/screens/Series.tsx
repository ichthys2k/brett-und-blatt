import { seriesCsv, type PointScheme, type SeriesView } from '@brett-und-blatt/online';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Section } from '../components/controls';
import { TavernPage } from '../components/TavernPage';
import { t } from '../i18n';
import { navigate, paths } from '../lib/router';
import { deleteSeries, fetchSeries, issueSeriesTransfer, manageSeries, rememberSeries, takeSeriesLeadership, type SeriesAction } from '../lib/seriesServer';
import { QrCode } from '../components/OnlineParts';

const FIELD = 'min-h-11 w-full rounded-xl border border-line bg-surface px-3';
/** Die Rangliste aktualisiert sich von selbst, solange die Seite offen ist. */
const REFRESH_MS = 30_000;

/**
 * Serienseite (#205): gemeinsame Rangliste über mehrere Turniere, live aus dem Server. Mit `embed` die schlichte Ansicht zum
 * Einbetten; die Leitung (das anlegende Gerät) sieht zusätzlich Zuordnungscode und Verwaltung.
 */
export function SeriesScreen({ code, embed = false, leader }: { code: string; embed?: boolean; leader?: string }) {
  const [view, setView] = useState<SeriesView | null | 'failed' | undefined>(undefined);
  const [takeError, setTakeError] = useState<string | null>(null);
  const load = useCallback(async () => {
    const result = await fetchSeries(code);
    setView((old) => (result === 'failed' && old && old !== 'failed' ? old : result));
    if (result && result !== 'failed') rememberSeries({ code, name: result.name });
  }, [code]);
  // Übergabelink der bisherigen Leitung (#203 für Serien): einmal einlösen und aus der Adresszeile nehmen.
  const took = useRef(false);
  useEffect(() => {
    if (!leader || took.current) return;
    took.current = true;
    window.history.replaceState(null, '', paths.series(code));
    void takeSeriesLeadership(code, leader).then(async (error) => {
      setTakeError(error);
      await load();
    });
  }, [leader, code, load]);
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), REFRESH_MS);
    const onVisible = () => document.visibilityState === 'visible' && void load();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  const body =
    view === undefined ? (
      <p className="text-sm text-muted">{t('online.connecting')}</p>
    ) : view === null ? (
      <p className="text-sm text-muted">{t('series.notFound')}</p>
    ) : view === 'failed' ? (
      <p role="alert" className="text-sm text-danger">{t('online.serverError')}</p>
    ) : embed ? (
      <Standings view={view} />
    ) : (
      <>
        {takeError && <p role="alert" className="text-sm text-danger">{takeError}</p>}
        <Standings view={view} />
        <Tournaments view={view} />
        <Share code={code} />
        {view.isLeader && <Manage view={view} onChanged={load} onDeleted={() => navigate(paths.tournaments)} />}
        <p className="text-xs text-muted">{t('series.keep', { date: new Date(view.expiresAt).toLocaleDateString('de-DE') })}</p>
      </>
    );

  if (embed)
    return (
      <div className="mx-auto max-w-3xl space-y-3 p-3">
        {typeof view === 'object' && view && <h1 className="truncate text-xl font-bold">📈 {view.name}</h1>}
        {body}
        <p className="text-center text-xs text-muted">
          <a className="underline" href={`${window.location.origin}${window.location.pathname}${paths.series(code)}`} target="_blank" rel="noopener">
            {t('tournament.embedMore')}
          </a>
        </p>
      </div>
    );
  return (
    <TavernPage title={typeof view === 'object' && view ? view.name : t('series.title')} subtitle={t('series.subtitle')} back={paths.tournaments}>
      {body}
    </TavernPage>
  );
}

function Standings({ view }: { view: SeriesView }) {
  if (view.standings.length === 0) return <p className="text-sm text-muted">{t('series.empty')}</p>;
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted">
              <th className="pr-2">#</th>
              <th>{t('tournament.seriesName')}</th>
              <th className="px-2 text-right">{t('tournament.seriesCount')}</th>
              <th className="px-2 text-right">{t('tournament.seriesPoints')}</th>
              <th className="px-2 text-right">{t('tournament.seriesBest')}</th>
              <th className="pl-2 text-right">Elo</th>
            </tr>
          </thead>
          <tbody>
            {view.standings.map((row, i) => (
              <tr key={`${row.name}-${i}`} className="border-t border-line">
                <td className="py-1 pr-2 tabular-nums">{i + 1}</td>
                <td className="font-medium">{row.name}</td>
                <td className="px-2 text-right tabular-nums">{row.tournaments}</td>
                <td className="px-2 text-right font-semibold tabular-nums">{row.points}</td>
                <td className="px-2 text-right tabular-nums">{row.best || '–'}</td>
                <td className="pl-2 text-right tabular-nums">{row.elo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">{view.scheme === 'f1' ? t('tournament.seriesF1') : t('tournament.seriesLinear')}</p>
      <Button className="w-full" onClick={() => navigator.clipboard?.writeText(seriesCsv(view.standings))}>
        📋 {t('tournament.seriesCopy')}
      </Button>
    </div>
  );
}

function Tournaments({ view }: { view: SeriesView }) {
  if (view.tournaments.length === 0) return null;
  return (
    <Section title={t('series.tournaments')}>
      <ul className="space-y-1 text-sm">
        {view.tournaments.map((entry) => (
          <li key={entry.code} className="flex items-center justify-between gap-2">
            <a className="truncate underline" href={paths.tournament(entry.code)}>
              🏆 {entry.name}
            </a>
            <span className="flex-none text-muted">
              {t('series.players', { n: entry.players })} · {new Date(entry.at).toLocaleDateString('de-DE')}
            </span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/** Zuschaulink und Einbettung. */
function Share({ code }: { code: string }) {
  const base = `${window.location.origin}${window.location.pathname}`;
  const link = `${base}${paths.series(code)}`;
  const iframe = `<iframe src="${base}${paths.seriesEmbed(code)}" title="Serie" width="100%" height="500" style="border:0" loading="lazy"></iframe>`;
  return (
    <details className="rounded-xl border border-line p-2">
      <summary className="cursor-pointer text-sm">🔗 {t('series.share')}</summary>
      <div className="mt-2 space-y-2">
        <Button className="w-full" onClick={() => navigator.clipboard?.writeText(link)}>
          🔗 {t('tournament.copy')}
        </Button>
        <p className="text-xs text-muted">{t('tournament.embedHint')}</p>
        <Button className="w-full" onClick={() => navigator.clipboard?.writeText(iframe)}>
          &lt;/&gt; {t('tournament.embedCopy')}
        </Button>
      </div>
    </details>
  );
}

/** Verwaltung nur für die Leitung der Serie. */
function Manage({ view, onChanged, onDeleted }: { view: SeriesView; onChanged: () => Promise<void>; onDeleted: () => void }) {
  const [name, setName] = useState(view.name);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (action: SeriesAction) => {
    setBusy(true);
    setError(await manageSeries(view.code, action));
    await onChanged();
    setBusy(false);
  };
  return (
    <Section title={`🛠️ ${t('series.manage')}`}>
      <div className="space-y-2 rounded-xl border border-line p-3">
        <p className="text-sm font-semibold">🔑 {t('series.linkTitle')}</p>
        <p className="text-xs text-muted">{t('series.linkHint')}</p>
        <p className="text-center text-xl font-bold tracking-widest">{view.link}</p>
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => navigator.clipboard?.writeText(view.link ?? '')}>
            📋 {t('tournament.copy')}
          </Button>
          <Button className="flex-1" disabled={busy} onClick={() => void run({ action: 'newKey' })}>
            ♻️ {t('series.newKey')}
          </Button>
        </div>
      </div>
      {view.org ? <p className="text-xs text-muted">🏛️ Diese Serie gehört einer Gruppe: Leitung und Betreiber der Gruppe verwalten sie mit. Rollen vergibt der Betreiber der Gruppe.</p> : <Transfer code={view.code} />}
      <label className="block space-y-1 text-sm">
        <span>{t('series.name')}</span>
        <div className="flex gap-2">
          <input className={FIELD} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
          <Button disabled={busy || !name.trim() || name.trim() === view.name} onClick={() => void run({ action: 'rename', name })}>
            {t('series.save')}
          </Button>
        </div>
      </label>
      <label className="block space-y-1 text-sm">
        <span>{t('tournament.seriesScheme')}</span>
        <select className={FIELD} value={view.scheme} disabled={busy} onChange={(e) => void run({ action: 'scheme', scheme: e.target.value as PointScheme })}>
          <option value="linear">{t('tournament.seriesLinear')}</option>
          <option value="f1">{t('tournament.seriesF1')}</option>
        </select>
      </label>
      {view.tournaments.length > 0 && (
        <ul className="space-y-1 text-sm">
          {view.tournaments.map((entry) => (
            <li key={entry.code} className="flex items-center justify-between gap-2">
              <span className="truncate">{entry.name}</span>
              <Button variant="ghost" className="px-3" disabled={busy} aria-label={`${t('series.remove')}: ${entry.name}`} title={t('series.remove')} onClick={() => void run({ action: 'remove', tournament: entry.code })}>
                ✕
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Button className="w-full" disabled={busy} onClick={() => void run({ action: 'extend' })}>
        ⏳ {t('series.extend')}
      </Button>
      <Button
        className="w-full"
        disabled={busy}
        onClick={async () => {
          if (!window.confirm(t('series.deleteConfirm', { name: view.name }))) return;
          const failure = await deleteSeries(view.code);
          if (failure) setError(failure);
          else onDeleted();
        }}
      >
        🗑️ {t('series.delete')}
      </Button>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </Section>
  );
}

/** Leitung auf ein anderes Gerät übergeben: Einmalcode, Link und QR-Code, einen Tag gültig. */
function Transfer({ code }: { code: string }) {
  const [issued, setIssued] = useState<{ code: string; expiresAt: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const link = issued ? `${window.location.origin}${window.location.pathname}${paths.series(code)}?leitung=${issued.code}` : '';
  return (
    <div className="space-y-2 rounded-xl border border-line p-3">
      <p className="text-sm font-semibold">🔑 {t('series.transferTitle')}</p>
      <p className="text-xs text-muted">{t('series.transferHint')}</p>
      <Button
        className="w-full"
        onClick={async () => {
          const result = await issueSeriesTransfer(code);
          if ('error' in result) setError(result.error);
          else {
            setError(null);
            setIssued(result);
          }
        }}
      >
        {issued ? t('tournament.transferNew') : t('tournament.transferStart')}
      </Button>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {issued && (
        <div className="space-y-2 text-center">
          <p className="text-2xl font-bold tracking-widest">{issued.code}</p>
          <p className="text-xs text-muted">{t('tournament.transferUntil', { time: new Date(issued.expiresAt).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) })}</p>
          <div className="mx-auto w-44">
            <QrCode text={link} label={t('series.transferTitle')} />
          </div>
          <Button className="w-full" onClick={() => navigator.clipboard?.writeText(link)}>
            🔗 {t('tournament.copy')}
          </Button>
        </div>
      )}
    </div>
  );
}
