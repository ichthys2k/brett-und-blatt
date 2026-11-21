import { useInputIntent, useInputSource } from '@brett-und-blatt/ui';
import { useEffect, useRef, useState } from 'react';
import { t } from '../i18n';
import { shouldOfferConsole } from '../lib/consoleOffer';
import { useRoute } from '../lib/router';
import { setShell, shellParam, useChosenShell } from '../lib/shell';
import { Button } from './controls';

const ASKED_KEY = 'brett-und-blatt:konsole-gefragt';

function loadAsked(): boolean {
  try {
    return window.localStorage.getItem(ASKED_KEY) === 'ja';
  } catch {
    return false;
  }
}

function saveAsked(): void {
  try {
    window.localStorage.setItem(ASKED_KEY, 'ja');
  } catch {
    // Ohne Speicher kommt der Hinweis beim nächsten Laden wieder.
  }
}

function useWindowSize(): { width: number; height: number } {
  const [size, setSize] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }));
  useEffect(() => {
    const onResize = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return size;
}

/** Einmaliger Hinweis „Controller erkannt“ mit „Einschalten“ und „Nein danke“ (#607, K10). */
export function ConsoleOffer() {
  const { inputSource } = useInputSource();
  const chosen = useChosenShell();
  const route = useRoute();
  const { width, height } = useWindowSize();
  const [asked, setAsked] = useState(loadAsked);
  const previous = useRef<HTMLElement | null>(null);
  const visible = shouldOfferConsole({ chosen, param: shellParam(), alreadyAsked: asked, source: inputSource, width, height, routeName: route.name });

  useEffect(() => {
    if (!visible) return;
    previous.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.querySelector<HTMLElement>('[data-console-offer="yes"]')?.focus();
  }, [visible]);

  const decline = () => {
    saveAsked();
    setAsked(true);
    previous.current?.focus();
  };
  const accept = () => {
    saveAsked();
    setAsked(true);
    setShell('console');
  };

  useInputIntent((intent) => {
    if (!visible || intent !== 'cancel') return false;
    decline();
    return true;
  }, 20);

  if (!visible) return null;
  return (
    <div role="dialog" aria-label={t('consoleOffer.title')} className="fixed inset-x-0 bottom-14 z-[61] mx-auto flex w-[min(40rem,calc(100%-2rem))] flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface p-4 shadow-lg">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-semibold">🎮 {t('consoleOffer.title')}</p>
        <p className="text-sm text-muted">{t('consoleOffer.text')}</p>
      </div>
      <div className="flex gap-2">
        <Button data-console-offer="yes" variant="primary" onClick={accept}>
          {t('consoleOffer.yes')}
        </Button>
        <Button variant="ghost" onClick={decline}>
          {t('consoleOffer.no')}
        </Button>
      </div>
    </div>
  );
}
