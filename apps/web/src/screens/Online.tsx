import { parseRoomCode } from '@brett-und-blatt/online';
import { useState } from 'react';
import { Button } from '../components/controls';
import { EmojiKeypad, ProfileForm } from '../components/OnlineParts';
import { OpenRooms } from '../components/OpenRooms';
import { TavernPage } from '../components/TavernPage';
import { t } from '../i18n';
import { GAME_SERVER, createRoom, roomExists, useOpenRooms } from '../lib/online';
import { saveOwnProfile } from '../lib/playerPass';
import { navigate, paths } from '../lib/router';
import { storage, type Profile } from '../lib/storage';

type Panel = null | 'new' | 'code';

/** Online Spiel (#184): offene Spiele live, „Neues Spiel“ (offen oder nur mit Code) und „Mit Code beitreten“. Turniere stehen nur unter „Turniere“. */
export function Online() {
  const [profile, setProfile] = useState<Profile | null>(() => storage.loadProfile());
  const [panel, setPanel] = useState<Panel>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pasted, setPasted] = useState('');
  const openRooms = useOpenRooms();

  const create = async (isPublic: boolean) => {
    setBusy(true);
    setError(null);
    try {
      navigate(paths.room(await createRoom({ isPublic })));
    } catch {
      setError(t('online.serverError'));
    } finally {
      setBusy(false);
    }
  };

  const join = async (input: string) => {
    // Auch ein ganzer Einladungslink geht: Der Code steht hinter „#/raum/“.
    const fromLink = /#\/raum\/([^/?#\s]+)/.exec(input)?.[1];
    const code = parseRoomCode(fromLink ? decodeURIComponent(fromLink) : input);
    if (!code) return setError(t('online.notFound'));
    setError(null);
    try {
      if (await roomExists(code)) navigate(paths.room(code));
      else setError(t('online.notFound'));
    } catch {
      setError(t('online.serverError'));
    }
  };

  return (
    <TavernPage title="Online Spiel" subtitle="Mit anderen im Netz, ohne Konto.">
      {!GAME_SERVER ? (
        <p className="text-muted">{t('online.unavailable')}</p>
      ) : !profile ? (
        <section className="space-y-3">
          <h2 className="text-2xl">Wer bist du?</h2>
          <p className="text-sm text-muted">Nur beim ersten Mal. Ein Name und ein Tier genügen, ein Konto brauchst du nicht.</p>
          <ProfileForm
            initial={null}
            submitLabel="Los geht’s"
            onSave={(next) => {
              saveOwnProfile(next);
              setProfile(next);
            }}
          />
        </section>
      ) : (
        <>
          <button type="button" className="bub-menu-plaque bub-menu-plaque-link" onClick={() => navigate(paths.pass)} aria-label="Profil öffnen">
            <span className="bub-menu-shield" aria-hidden="true">
              {profile.avatar}
            </span>
            <span className="bub-menu-name">{profile.name}</span>
            <span className="bub-menu-switch">Profil</span>
          </button>

          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" className="bub-menu-button" aria-pressed={panel === 'new'} onClick={() => setPanel(panel === 'new' ? null : 'new')}>
              Neues Spiel
            </button>
            <button type="button" className="bub-menu-button" aria-pressed={panel === 'code'} onClick={() => setPanel(panel === 'code' ? null : 'code')}>
              Mit Code beitreten
            </button>
          </div>

          {panel === 'new' && (
            <section className="space-y-3 rounded-xl border border-line bg-surface p-4">
              <p className="text-sm text-muted">Wer darf mitspielen? Das Spiel wählst du gleich in der Lobby.</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button variant="primary" disabled={busy} onClick={() => create(true)}>
                  Offen für alle
                </Button>
                <Button disabled={busy} onClick={() => create(false)}>
                  Nur mit Code
                </Button>
              </div>
            </section>
          )}

          {panel === 'code' && (
            <section className="space-y-3 rounded-xl border border-line bg-surface p-4">
              <p className="text-sm text-muted">{t('online.codeHint')}</p>
              <EmojiKeypad onComplete={join} />
              <form
                className="flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  join(pasted);
                }}
              >
                <input
                  className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3"
                  aria-label={t('online.join')}
                  placeholder="🦊🍎🚀🎈"
                  value={pasted}
                  onChange={(event) => setPasted(event.target.value)}
                />
                <Button type="submit">{t('online.enter')}</Button>
              </form>
            </section>
          )}

          <OpenRooms rooms={openRooms?.filter((room) => !room.tournament) ?? null} showEmpty />
        </>
      )}

      {error && (
        <p role="alert" className="rounded-xl bg-danger/10 p-3 text-danger">
          {error}
        </p>
      )}
    </TavernPage>
  );
}
