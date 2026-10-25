import { parseRoomCode } from '@brett-und-blatt/online';
import { useState } from 'react';
import { Button, Section } from '../components/controls';
import { EmojiKeypad, ProfileForm } from '../components/OnlineParts';
import { t } from '../i18n';
import { GAME_SERVER, createRoom, roomExists } from '../lib/online';
import { navigate, paths } from '../lib/router';
import { storage, type Profile } from '../lib/storage';

/** Startseite für Online-Partien: Spitzname, Raum erstellen oder beitreten. */
export function Online() {
  const [profile, setProfile] = useState<Profile | null>(() => storage.loadProfile());
  const [editing, setEditing] = useState(profile === null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pasted, setPasted] = useState('');

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      navigate(paths.room(await createRoom()));
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
    <div className="mx-auto flex min-h-full max-w-xl flex-col gap-6 px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1.5rem)]">
      <header className="flex items-center gap-2">
        <Button variant="ghost" className="px-3" aria-label={t('play.back')} onClick={() => navigate(paths.home)}>
          ←
        </Button>
        <h1 className="text-2xl font-bold">
          <span aria-hidden="true">🌐 </span>
          {t('online.title')}
        </h1>
      </header>

      {!GAME_SERVER ? (
        <p className="text-muted">{t('online.unavailable')}</p>
      ) : editing || !profile ? (
        <Section title={t('online.profile')}>
          <ProfileForm
            initial={profile}
            submitLabel="OK"
            onSave={(next) => {
              storage.saveProfile(next);
              setProfile(next);
              setEditing(false);
            }}
          />
        </Section>
      ) : (
        <>
          <section className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 shadow-sm">
            <span className="text-3xl" aria-hidden="true">
              {profile.avatar}
            </span>
            <span className="flex-1 font-semibold">{profile.name}</span>
            <Button variant="ghost" onClick={() => setEditing(true)}>
              ✏️ {t('online.name')}
            </Button>
          </section>

          <Button variant="primary" className="w-full" disabled={busy} onClick={create}>
            ➕ {t('online.create')}
          </Button>

          <Section title={t('online.join')}>
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
                placeholder="🦊🍎🚀🎈⭐🐶"
                value={pasted}
                onChange={(event) => setPasted(event.target.value)}
              />
              <Button type="submit">{t('online.enter')}</Button>
            </form>
          </Section>
        </>
      )}

      {error && (
        <p role="alert" className="rounded-xl bg-danger/10 p-3 text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
