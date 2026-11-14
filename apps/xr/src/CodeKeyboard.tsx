/**
 * Emoji-Tastatur zum Beitreten (#393): vier Felder für den Code und alle 16 Emoji als große Tasten.
 * Bedienbar mit Maus, Finger und Controller-Strahl; ohne Systemtastatur.
 */
import { ROOM_CODE_LENGTH, ROOM_EMOJIS } from '@brett-und-blatt/online';
import { codeEmojis, pressBackspace, pressEmoji } from './code-keys';

const NAMES: Record<string, string> = {
  '🐶': 'Hund', '🐱': 'Katze', '🦊': 'Fuchs', '🐻': 'Bär', '🐸': 'Frosch', '🐧': 'Pinguin', '🦄': 'Einhorn', '🐢': 'Schildkröte',
  '🍎': 'Apfel', '🍌': 'Banane', '🍓': 'Erdbeere', '🍕': 'Pizza', '🌈': 'Regenbogen', '⭐': 'Stern', '🚀': 'Rakete', '🎈': 'Ballon',
};

export function CodeKeyboard({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const chosen = codeEmojis(value);
  const full = chosen.length >= ROOM_CODE_LENGTH;
  return (
    <div className="xr-codekeys" role="group" aria-label="Raumcode wählen">
      <div className="xr-codeslots" aria-live="polite">
        {Array.from({ length: ROOM_CODE_LENGTH }, (_, i) => (
          <span key={i} className="xr-codeslot" aria-label={chosen[i] ? NAMES[chosen[i]!] : 'leer'}>
            {chosen[i] ?? '·'}
          </span>
        ))}
        <button type="button" className="xr-codeback" aria-label="Letztes Emoji löschen" disabled={chosen.length === 0} onClick={() => onChange(pressBackspace(value))}>
          ⌫
        </button>
      </div>
      <div className="xr-codegrid">
        {ROOM_EMOJIS.map((emoji) => (
          <button key={emoji} type="button" aria-label={NAMES[emoji] ?? emoji} disabled={full} onClick={() => onChange(pressEmoji(value, emoji))}>
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
