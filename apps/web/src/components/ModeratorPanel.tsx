import type { Capability, MemberInfo } from '@brett-und-blatt/online';
import { can } from '@brett-und-blatt/online';
import { useEffect, useState } from 'react';
import { t } from '../i18n';
import type { Profile } from '../lib/storage';
import { Button } from './controls';
import { ProfileForm } from './OnlineParts';
import { Avatar } from './Avatar';

/** Ein Mitglied mit dem, was die Moderation über seinen Platz wissen muss. */
export interface ModeratorMember {
  member: MemberInfo;
  isYou: boolean;
  isRoomHost: boolean;
  /** Bezeichnung des Platzes (etwa „Platz 2“), null ohne Platz. */
  seatLabel: string | null;
  /** Der Computer spielt gerade für diesen Platz (Mitglied nicht da). */
  away: boolean;
  /** Platznummer, falls das Mitglied sitzt (für „vom Platz nehmen“). */
  seatIndex: number | null;
}

export interface ModeratorPanelProps {
  capabilities: readonly Capability[];
  members: ModeratorMember[];
  namesLocked: boolean;
  displays: number;
  /** Zuschauer, die anfragen, ob sie ab der nächsten Runde mitspielen dürfen (#299). */
  requests: MemberInfo[];
  acceptRequests: boolean;
  onAnswerJoin(memberId: string, ok: boolean): void;
  onAcceptAllJoins(): void;
  onSetAcceptRequests(allowed: boolean): void;
  onRename(memberId: string, profile: Profile): void;
  onKick(member: MemberInfo): void;
  onUnseat(index: number, member: MemberInfo): void;
  onLockNames(locked: boolean): void;
  onRestart(): void;
  onLobby(): void;
  onClose(): void;
}

/**
 * Spielleiter-Panel (#100): Mitglieder während der Partie verwalten. Es braucht keinen eigenen Platz, die Raumleitung
 * kann also auch vom Tablet am Rand aus moderieren. Gezeigt wird nur, was `capabilities` erlaubt.
 */
export function ModeratorPanel({ capabilities, members, namesLocked, displays, requests, acceptRequests, onAnswerJoin, onAcceptAllJoins, onSetAcceptRequests, onRename, onKick, onUnseat, onLockNames, onRestart, onLobby, onClose }: ModeratorPanelProps) {
  const [editing, setEditing] = useState<string | null>(null);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center" role="presentation" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={t('mod.title')} className="max-h-[85dvh] w-full max-w-lg space-y-3 overflow-y-auto rounded-t-2xl bg-surface p-4 shadow-xl sm:rounded-2xl" onClick={(event) => event.stopPropagation()}>
        <header className="flex items-center gap-2">
          <h2 className="min-w-0 flex-1 text-lg font-semibold">🛠 {t('mod.title')}</h2>
          <Button variant="ghost" className="px-3" aria-label={t('mod.close')} onClick={onClose}>
            ✕
          </Button>
        </header>

        {displays > 0 && <p className="text-sm text-muted">📺 {t('display.connected', { n: displays })}</p>}

        {can(capabilities, 'joinRequests') && (
          <section className="space-y-2 rounded-xl bg-surface-2 px-3 py-2" aria-label={t('join.requests')}>
            <label className="flex cursor-pointer select-none items-center gap-3">
              <input type="checkbox" checked={acceptRequests} onChange={(event) => onSetAcceptRequests(event.target.checked)} className="h-4 w-4 rounded accent-accent" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{t('join.allow')}</span>
                <span className="block text-xs text-muted">{t('join.allowHint')}</span>
              </span>
            </label>
            {acceptRequests && (
              <>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-medium text-muted">{t('join.requests')}</h3>
                  {requests.length > 1 && (
                    <Button variant="secondary" className="min-h-9 text-sm" onClick={onAcceptAllJoins}>
                      {t('join.acceptAll')}
                    </Button>
                  )}
                </div>
                {requests.length === 0 ? (
                  <p className="text-sm text-muted">{t('join.none')}</p>
                ) : (
                  <ul className="space-y-1">
                    {requests.map((member) => (
                      <li key={member.id} className="flex flex-wrap items-center gap-2">
                        <span className="min-w-0 flex-1 font-medium">
                          <span aria-hidden="true"><Avatar value={member.avatar} /> </span>
                          {member.name}
                        </span>
                        <Button variant="primary" className="min-h-9 text-sm" aria-label={`${t('join.accept')}: ${member.name}`} onClick={() => onAnswerJoin(member.id, true)}>
                          ✅ {t('join.accept')}
                        </Button>
                        <Button variant="ghost" className="min-h-9 text-sm" aria-label={`${t('join.decline')}: ${member.name}`} onClick={() => onAnswerJoin(member.id, false)}>
                          ❌ {t('join.decline')}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </section>
        )}

        {can(capabilities, 'lockNames') && (
          <label className="flex cursor-pointer select-none items-center gap-3 rounded-xl bg-surface-2 px-3 py-2">
            <input type="checkbox" checked={namesLocked} onChange={(event) => onLockNames(event.target.checked)} className="h-4 w-4 rounded accent-accent" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{t('online.namesLocked')}</span>
              <span className="block text-xs text-muted">{t('online.namesLockedHint')}</span>
            </span>
          </label>
        )}

        {can(capabilities, 'restart') && (
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                if (window.confirm(t('play.restartConfirm'))) {
                  onRestart();
                  onClose();
                }
              }}
            >
              {t('play.restart')}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                if (window.confirm(t('online.toLobbyConfirm'))) {
                  onLobby();
                  onClose();
                }
              }}
            >
              {t('online.toLobby')}
            </Button>
          </div>
        )}

        <h3 className="text-sm font-medium text-muted">{t('online.members')}</h3>
        <ul className="space-y-1">
          {members.map(({ member, isYou, isRoomHost, seatLabel, away, seatIndex }) => (
            <li key={member.id} className="space-y-2 rounded-xl bg-surface-2 px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xl" aria-hidden="true">
                  <Avatar value={member.avatar} />
                </span>
                <span className={`min-w-0 flex-1 ${member.connected ? '' : 'text-muted'}`}>
                  <span className="font-medium">
                    {member.name}
                    {isYou && ` (${t('online.you')})`}
                  </span>
                  <span className="ml-2 text-xs text-muted">
                    {isRoomHost && `👑 ${t('online.host')} · `}
                    {seatLabel ?? t('mod.spectator')}
                    {member.join === 'queued' && ` · ${t('join.queuedTag')}`}
                    {member.join === 'asking' && ` · ${t('join.askingTag')}`}
                    {away && ` · 🤖 ${t('mod.botPlays')}`}
                    {!member.connected && ` · ${t('online.offline')}`}
                  </span>
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {can(capabilities, 'rename') && editing !== member.id && (
                  <Button variant="ghost" className="min-h-9 text-sm" aria-label={t('online.editProfileFor', { name: member.name })} onClick={() => setEditing(member.id)}>
                    ✏️ {t('online.editProfile')}
                  </Button>
                )}
                {can(capabilities, 'unseat') && seatIndex !== null && !isYou && (
                  <Button variant="ghost" className="min-h-9 text-sm" onClick={() => window.confirm(t('online.unseatConfirm', { name: member.name })) && onUnseat(seatIndex, member)}>
                    {t('online.unseat')}
                  </Button>
                )}
                {can(capabilities, 'kick') && !isYou && (
                  <Button variant="ghost" className="min-h-9 text-sm" onClick={() => window.confirm(t('online.kickConfirm', { name: member.name })) && onKick(member)}>
                    {t('online.kick')}
                  </Button>
                )}
              </div>
              {editing === member.id && (
                <div className="space-y-2 border-t border-line pt-2">
                  <ProfileForm
                    initial={{ name: member.name, avatar: member.avatar }}
                    submitLabel={t('online.saveProfile')}
                    onSave={(profile) => {
                      onRename(member.id, profile);
                      setEditing(null);
                    }}
                  />
                  <Button variant="ghost" className="w-full" onClick={() => setEditing(null)}>
                    {t('online.cancel')}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
