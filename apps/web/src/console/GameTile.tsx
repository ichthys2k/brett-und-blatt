import type { GameInfo } from '@brett-und-blatt/engine';
import { t } from '../i18n';
import type { ControllerGrade } from '../lib/controllerGrade';
import { crestUrl } from '../lib/crest';
import { sceneFor, sceneUrl } from '../lib/gameScene';
import { useActiveLook, useScenesOn } from '../lib/look';

export const GRADE_BADGE: Record<ControllerGrade, string> = { direct: '🎮', carousel: '🎮↔', cursor: '🖱️' };

export function playerCountText(info: GameInfo): string {
  const { min, max } = info.players;
  return min === max ? t('home.playersFixed', { count: min }) : t('home.players', { min, max });
}

/** Kulisse als Kachelhintergrund – nur im Aussehen „Taverne“ mit eingeschalteten Kulissen. */
export function useTileScene(gameId: string): string | undefined {
  const tavern = useActiveLook() === 'tavern';
  const scenes = useScenesOn();
  return tavern && scenes ? sceneUrl(sceneFor(gameId)) : undefined;
}

/**
 * Spielkachel der Konsole (#607, K3b): Kulisse, Wappen oder Emoji, Name, Spielerzahl, Stern bei
 * Lieblingsspielen, Abzeichen der Controller-Eignung. Die ganze Kachel ist ein Link.
 */
export function GameTile({ info, href, favorite, grade, restoreId, autoFocus }: { info: GameInfo; href: string; favorite?: boolean; grade?: ControllerGrade; restoreId?: string; autoFocus?: boolean }) {
  const tavern = useActiveLook() === 'tavern';
  const scene = useTileScene(info.id);
  const crest = tavern ? crestUrl(info.id) : undefined;
  const players = playerCountText(info);
  const label = [info.name, players, favorite ? t('console.favorite') : '', grade ? t(`console.grade.${grade}` as Parameters<typeof t>[0]) : '']
    .filter(Boolean)
    .join(', ');
  return (
    <a
      href={href}
      className="kns-tile"
      data-kns-game={info.id}
      data-kns-id={restoreId ?? info.id}
      data-kns-autofocus={autoFocus ? '' : undefined}
      data-image={scene ? '' : undefined}
      style={scene ? { backgroundImage: `url("${scene}")` } : undefined}
      aria-label={label}
    >
      <span className="kns-tile-art" aria-hidden="true">
        {crest ? <img src={crest} alt="" loading="lazy" decoding="async" /> : info.emoji}
      </span>
      {grade && (
        <span className="kns-grade" aria-hidden="true">
          {GRADE_BADGE[grade]}
        </span>
      )}
      {favorite && (
        <span className="kns-tile-star" aria-hidden="true">
          ★
        </span>
      )}
      <span className="kns-tile-text" aria-hidden="true">
        <span className="kns-tile-name">{info.name}</span>
        <span className="kns-tile-meta">{players}</span>
      </span>
    </a>
  );
}
