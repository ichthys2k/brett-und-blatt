/**
 * Raumcodes aus Emojis: vier aus 64 ergeben gut 16,7 Millionen Möglichkeiten.
 * Kinder können sie vorlesen („Fuchs, Apfel, Rakete, Ballon“) und ohne Tastatur
 * eintippen, weil die Oberfläche alle 64 zur Auswahl zeigt.
 *
 * Nur Emojis aus einem einzigen Zeichen, damit es auf allen Geräten gleich aussieht
 * und sich zuverlässig zerlegen lässt.
 */
export const ROOM_EMOJIS = [
  '🐶', '🐱', '🐭', '🐰', '🦊', '🐻', '🐼', '🐨',
  '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧',
  '🦆', '🦉', '🐴', '🦄', '🐝', '🦋', '🐌', '🐞',
  '🐢', '🐍', '🦖', '🐙', '🦀', '🐠', '🐬', '🐳',
  '🦒', '🐘', '🦔', '🍎', '🍌', '🍇', '🍓', '🍒',
  '🍋', '🍉', '🍍', '🥕', '🌽', '🍄', '🍕', '🍪',
  '🧀', '🌵', '🌻', '🌈', '🔥', '💧', '⭐', '🌙',
  '⚽', '🎈', '🎁', '🚀', '🚲', '⛵', '🔑', '🎸',
] as const;

export const ROOM_CODE_LENGTH = 4;

/** Ein neuer Raumcode. `randomInt(n)` liefert eine Zufallszahl von 0 bis n − 1. */
export function randomRoomCode(randomInt: (n: number) => number): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) code += ROOM_EMOJIS[randomInt(ROOM_EMOJIS.length)];
  return code;
}

/**
 * Liest einen Raumcode aus einer Eingabe, z. B. aus einem Link oder einer kopierten
 * Nachricht. Leerzeichen und unsichtbare Varianten-Zeichen werden ignoriert.
 * Gibt den Code in fester Schreibweise zurück oder null.
 */
export function parseRoomCode(input: string): string | null {
  const known = new Set<string>(ROOM_EMOJIS);
  const parts = Array.from(input.normalize('NFC').replace(/[\s︎️‍]/g, ''));
  if (parts.length !== ROOM_CODE_LENGTH || !parts.every((p) => known.has(p))) return null;
  return parts.join('');
}
