import { avatarUrl } from '../lib/avatarArt';

/**
 * Avatar als gemaltes Bild (#312) mit dem Emoji dahinter: Nur im Taverne-Aussehen ersetzt das Bild das Emoji
 * (CSS in look.css); „Schlicht“, erhöhter Kontrast und Avatare ohne Bild zeigen das Emoji.
 */
export function Avatar({ value }: { value: string }) {
  const url = avatarUrl(value);
  if (!url) return <>{value}</>;
  return (
    <>
      <img className="bub-av-img" src={url} alt="" draggable={false} loading="lazy" decoding="async" />
      <span className="bub-av-emoji">{value}</span>
    </>
  );
}
