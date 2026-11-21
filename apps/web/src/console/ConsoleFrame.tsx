import { KnsSubTabs, useInputIntent, useInputSource, usePromptItems, type PromptItem } from '@brett-und-blatt/ui';
import { useEffect, useState, type ReactNode } from 'react';
import { Avatar } from '../components/Avatar';
import { t } from '../i18n';
import { navigate, useRoute } from '../lib/router';
import { storage } from '../lib/storage';
import { CONSOLE_TABS, neighborTab, placeForRoute, type ConsoleTab } from './consoleTabs';
import { QuickAccess } from './QuickAccess';
import { useKnsLayout } from './useKnsLayout';
import './console.css';

/** Tastenhinweise, wenn ein Bildschirm keine eigenen meldet. */
export const CONSOLE_PROMPTS: readonly PromptItem[] = [
  { key: 'A', label: t('console.prompt.select') },
  { key: 'B', label: t('console.prompt.back') },
  { key: 'LB/RB', label: t('console.prompt.tabs') },
  { key: '☰', label: t('console.prompt.quick') },
];

type MessageKey = Parameters<typeof t>[0];

function clockText(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

/** Rechte Seite der Kopfleiste: Pass, Controller, Uhrzeit (im Hochformat nur der Pass). */
function ConsoleStatus({ compact }: { compact: boolean }) {
  const { connectedGamepads } = useInputSource();
  const profile = storage.loadProfile();
  const [clock, setClock] = useState(clockText);
  useEffect(() => {
    if (compact) return undefined;
    const id = window.setInterval(() => setClock(clockText()), 30_000);
    return () => window.clearInterval(id);
  }, [compact]);
  return (
    <div className="kns-status">
      {profile && (
        <span className="inline-flex items-center gap-2">
          <span className="kns-status-avatar" aria-hidden="true">
            <Avatar value={profile.avatar} />
          </span>
          {!compact && <span>{profile.name}</span>}
        </span>
      )}
      {!compact && connectedGamepads > 0 && <span aria-label={t('console.gamepads', { count: connectedGamepads })}>🎮 {connectedGamepads}</span>}
      {!compact && <span aria-hidden="true">{clock}</span>}
    </div>
  );
}

/**
 * Rahmen der Konsolen-Oberfläche (#607, K3b): Kopfleiste mit Reitern, rollender Inhalt, Platz für die
 * Tastenleiste unten. LB/RB wechselt den Reiter. Im Hochformat (#637) stehen die Reiter als Leiste am unteren
 * Rand, oben bleibt eine schmale Kopfzeile.
 */
export function ConsoleFrame({ tab, prompts, children }: { tab: ConsoleTab | null; prompts?: readonly PromptItem[]; children: ReactNode }) {
  const layout = useKnsLayout();
  const portrait = layout === 'portrait';
  const route = useRoute();
  const place = placeForRoute(route.name);
  const entry = CONSOLE_TABS.find((candidate) => candidate.id === tab);
  const subTabs = entry?.sub ?? [];
  const sub = place && place.tab === tab ? place.sub : null;
  const [quickOpen, setQuickOpen] = useState(false);
  usePromptItems(prompts ?? CONSOLE_PROMPTS);
  // Start ☰ öffnet und schließt den Schnellzugriff (#638); am Spieltisch gibt es keinen Rahmen, dort gilt das Menü der Partie.
  useInputIntent((intent) => {
    if (intent !== 'menu') return false;
    setQuickOpen((open) => !open);
    return true;
  }, 5);
  useInputIntent((intent) => {
    if (intent !== 'zonePrev' && intent !== 'zoneNext') return false;
    if (quickOpen) return false;
    const next = neighborTab(tab, intent === 'zonePrev' ? -1 : 1);
    if (next !== tab) navigate(CONSOLE_TABS.find((entry) => entry.id === next)!.path);
    return true;
  }, 5);
  const tabs = (
    <nav className={portrait ? 'kns-nav' : 'kns-tabs'} aria-label={t('console.tabs')}>
      {CONSOLE_TABS.map((entry) => (
        <a key={entry.id} href={entry.path} className={portrait ? 'kns-nav-tab' : 'kns-tab'} aria-current={entry.id === tab ? 'page' : undefined}>
          {portrait && (
            <span className="kns-nav-icon" aria-hidden="true">
              {entry.icon}
            </span>
          )}
          <span className={portrait ? 'kns-nav-label' : undefined}>{t(entry.labelKey as MessageKey)}</span>
        </a>
      ))}
    </nav>
  );
  return (
    <div className="kns-frame">
      <header className="kns-bar">
        <span className="kns-brand">Brett &amp; Blatt</span>
        {!portrait && tabs}
        <ConsoleStatus compact={portrait} />
        <button type="button" className="kns-quick-button" aria-label={t('console.quick')} aria-haspopup="dialog" onClick={() => setQuickOpen(true)}>
          ☰
        </button>
      </header>
      {subTabs.length > 0 && (
        <div className="kns-subbar">
          <KnsSubTabs
            label={t('console.subtabs')}
            current={sub}
            tabs={subTabs.map((subTab) => ({ id: subTab.id, label: t(subTab.labelKey as MessageKey), href: subTab.path }))}
          />
        </div>
      )}
      <main className="kns-main" data-scroll-container>
        {children}
      </main>
      {portrait && tabs}
      {quickOpen && <QuickAccess onClose={() => setQuickOpen(false)} />}
    </div>
  );
}
