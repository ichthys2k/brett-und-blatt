import { TavernPage } from '../components/TavernPage';
import { TournamentsPanel } from '../components/TournamentsPanel';
import { navigate, paths } from '../lib/router';
import { GAME_SERVER } from '../lib/online';
import { storage } from '../lib/storage';
import { t } from '../i18n';

/** Turniere (#184): die eigenen Turniere und das Anlegen; ein Assistent in drei Schritten folgt. */
export function Tournaments() {
  const profile = storage.loadProfile();
  return (
    <TavernPage title="Turniere" subtitle="Finden, anlegen und verfolgen.">
      {!GAME_SERVER ? (
        <p className="text-muted">{t('online.unavailable')}</p>
      ) : !profile ? (
        <>
          <p className="text-muted">Für Turniere brauchst du einen Namen.</p>
          <button type="button" className="bub-menu-button" onClick={() => navigate(paths.pass)}>
            Profil anlegen
          </button>
        </>
      ) : (
        <TournamentsPanel profile={profile} />
      )}
    </TavernPage>
  );
}
