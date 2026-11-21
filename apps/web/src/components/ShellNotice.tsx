import { KnsBanner, KnsButton } from '@brett-und-blatt/ui';
import { useState } from 'react';
import { t } from '../i18n';
import { navigate, paths, useRoute } from '../lib/router';
import { useActiveShell } from '../lib/shell';
import { shouldShowShellNotice } from '../lib/shellNotice';

const SEEN_KEY = 'brett-und-blatt:oberflaeche-hinweis';

function loadSeen(): boolean {
  try {
    return window.localStorage.getItem(SEEN_KEY) === 'gesehen';
  } catch {
    return false;
  }
}

function saveSeen(): void {
  try {
    window.localStorage.setItem(SEEN_KEY, 'gesehen');
  } catch {
    // Ohne Speicher kommt der Hinweis beim nächsten Laden wieder.
  }
}

/**
 * Einmaliger Hinweis, dass die Konsole jetzt Standard ist und wo man zurückschaltet (#639). Er nimmt nie den
 * Fokus; mit dem Steuerkreuz erreicht man seine Knöpfe wie jedes andere Ziel.
 */
export function ShellNotice() {
  const route = useRoute();
  const shell = useActiveShell();
  const [seen, setSeen] = useState(loadSeen);
  if (!shouldShowShellNotice({ alreadySeen: seen, shell, routeName: route.name })) return null;
  const close = () => {
    saveSeen();
    setSeen(true);
  };
  return (
    <KnsBanner
      floating
      className="kns-shell-notice"
      title={t('shellNotice.title')}
      onClose={close}
      action={
        <>
          {route.name !== 'sound' && (
            <KnsButton
              onClick={() => {
                close();
                navigate(paths.sound);
              }}
            >
              {t('shellNotice.options')}
            </KnsButton>
          )}
          <KnsButton variant="primary" onClick={close}>
            {t('shellNotice.ok')}
          </KnsButton>
        </>
      }
    >
      <p>{t('shellNotice.text')}</p>
    </KnsBanner>
  );
}
