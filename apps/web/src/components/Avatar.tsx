import { avatarUrl } from '../lib/avatarArt';
import { botPortraitUrl } from '../lib/botPortraits';

/**
 * Avatar als gemaltes Bild (#312) mit dem Emoji dahinter: Nur im Taverne-Aussehen ersetzt das Bild das Emoji
 * (CSS in look.css); „Schlicht“, erhöhter Kontrast und Avatare ohne Bild zeigen das Emoji.
 */
export function Avatar({ value }: { value: string }) {
  // Bot-Sitze tragen `bot:<kennung>` (#311); ohne Bild bleibt das Roboter-Emoji.
  const isBot = value.startsWith('bot:');
  const url = isBot ? botPortraitUrl(value) : avatarUrl(value);
  if (!url) return <>{isBot ? '🤖' : value}</>;
  return (
    <>
      <img className="bub-av-img" src={url} alt="" draggable={false} loading="lazy" decoding="async" />
      <span className="bub-av-emoji">{isBot ? '🤖' : value}</span>
    </>
  );
}
