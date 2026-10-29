/*
 * Avatare für Online-Partien. Jeder Avatar ist ein Tier aus dem Großen Preis und
 * hat einen Klang: erst der Tierlaut (`<slug>-laut.mp3`), dann die gesprochene
 * Ansage (`<slug>-stimme.mp3`). Beide Dateien liegen im privaten Klang-Repo unter
 * `avatare/` und werden erst beim Beitritt geladen.
 *
 * Die Liste ist absichtlich auf Tiere mit Ton begrenzt: Wer hier steht, hat
 * garantiert eine Datei. Kein Avatar ohne Klang. Die Auswahl ist flach – ohne
 * Kategorien.
 */

export const AVATARS = [
  // 76 Tiere mit Ton (Säugetiere, Vögel, Meerestiere, Insekten, Fantasie)
  '🦊', '🐶', '🐱', '🐭', '🐹', '🐰', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐵', '🐆', '🦓', '🐘', '🦛', '🦏', '🐪',
  '🦒', '🦘', '🐑', '🦙', '🐐', '🦌', '🦨', '🦡', '🦦', '🦥', '🐿️', '🐅', '🦍', '🦧', '🐫', '🐃', '🐂', '🐄', '🐎', '🐖',
  '🐏', '🐕', '🐩', '🦮', '🐕‍🦺', '🐈', '🐈‍⬛', '🐇', '🦝', '🐁', '🐀',
  '🦆', '🐓', '🦃', '🦚', '🦜', '🦢', '🦩', '🕊️',
  '🐸', '🐢', '🐙', '🦑', '🦐', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🦈', '🐊',
  '🐝', '🐛', '🦋',
  '🦄',
] as const;

export type Avatar = (typeof AVATARS)[number];

export interface AvatarSound {
  /** Dateiname ohne Endung. Die MP3s heißen `<slug>-laut.mp3` und `<slug>-stimme.mp3`. */
  slug: string;
  /** Anzeigename für Titel und Vorlesehilfen. */
  label: string;
  /** Ob es eine gesprochene Ansage gibt. Fehlt nur bei der Ente. */
  voice?: boolean;
}

/**
 * Zuordnung Avatar → Klang. `Record<Avatar, …>` sorgt dafür, dass ein neuer Avatar
 * ohne Klang sofort die Typprüfung bricht.
 */
export const AVATAR_SOUNDS: Record<Avatar, AvatarSound> = {
  '🦆': { slug: 'ente', label: 'Ente', voice: false },
  '🐶': { slug: 'hund', label: 'Hund' },
  '🐱': { slug: 'katze', label: 'Katze' },
  '🐭': { slug: 'maus', label: 'Maus' },
  '🐹': { slug: 'hamster', label: 'Hamster' },
  '🐰': { slug: 'hase', label: 'Hase' },
  '🦊': { slug: 'fuchs', label: 'Fuchs' },
  '🐻': { slug: 'baer', label: 'Bär' },
  '🐼': { slug: 'panda', label: 'Panda' },
  '🐨': { slug: 'koala', label: 'Koala' },
  '🐯': { slug: 'tiger', label: 'Tiger' },
  '🦁': { slug: 'loewe', label: 'Löwe' },
  '🐮': { slug: 'kuh', label: 'Kuh' },
  '🐷': { slug: 'schwein', label: 'Schwein' },
  '🐸': { slug: 'frosch', label: 'Frosch' },
  '🐵': { slug: 'affe', label: 'Affe' },
  '🦄': { slug: 'einhorn', label: 'Einhorn' },
  '🐝': { slug: 'biene', label: 'Biene' },
  '🐛': { slug: 'raupe', label: 'Raupe' },
  '🦋': { slug: 'schmetterling', label: 'Schmetterling' },
  '🐢': { slug: 'schildkroete', label: 'Schildkröte' },
  '🐙': { slug: 'krake', label: 'Krake' },
  '🦑': { slug: 'tintenfisch', label: 'Tintenfisch' },
  '🦐': { slug: 'garnele', label: 'Garnele' },
  '🦀': { slug: 'krabbe', label: 'Krabbe' },
  '🐡': { slug: 'kugelfisch', label: 'Kugelfisch' },
  '🐠': { slug: 'tropenfisch', label: 'Tropenfisch' },
  '🐟': { slug: 'fisch', label: 'Fisch' },
  '🐬': { slug: 'delphin', label: 'Delphin' },
  '🐳': { slug: 'wal', label: 'Wal' },
  '🦈': { slug: 'hai', label: 'Hai' },
  '🐊': { slug: 'krokodil', label: 'Krokodil' },
  '🐅': { slug: 'tiger-2', label: 'Tiger' },
  '🐆': { slug: 'leopard', label: 'Leopard' },
  '🦓': { slug: 'zebra', label: 'Zebra' },
  '🦍': { slug: 'gorilla', label: 'Gorilla' },
  '🦧': { slug: 'orangutan', label: 'Orang-Utan' },
  '🐘': { slug: 'elefant', label: 'Elefant' },
  '🦛': { slug: 'nilpferd', label: 'Nilpferd' },
  '🦏': { slug: 'nashorn', label: 'Nashorn' },
  '🐪': { slug: 'kamel', label: 'Kamel' },
  '🐫': { slug: 'trampeltier', label: 'Trampeltier' },
  '🦒': { slug: 'giraffe', label: 'Giraffe' },
  '🦘': { slug: 'kaenguru', label: 'Känguru' },
  '🐃': { slug: 'wasserbueffel', label: 'Wasserbüffel' },
  '🐂': { slug: 'ochse', label: 'Ochse' },
  '🐄': { slug: 'kuh-2', label: 'Kuh' },
  '🐎': { slug: 'pferd', label: 'Pferd' },
  '🐖': { slug: 'schwein-2', label: 'Schwein' },
  '🐏': { slug: 'widder', label: 'Widder' },
  '🐑': { slug: 'schaf', label: 'Schaf' },
  '🦙': { slug: 'lama', label: 'Lama' },
  '🐐': { slug: 'ziege', label: 'Ziege' },
  '🦌': { slug: 'hirsch', label: 'Hirsch' },
  '🐕': { slug: 'hund-2', label: 'Hund' },
  '🐩': { slug: 'pudel', label: 'Pudel' },
  '🦮': { slug: 'fuehrhund', label: 'Führhund' },
  '🐕‍🦺': { slug: 'assistenzhund', label: 'Assistenzhund' },
  '🐈': { slug: 'katze-2', label: 'Katze' },
  '🐈‍⬛': { slug: 'katze-3', label: 'Katze' },
  '🐓': { slug: 'hahn', label: 'Hahn' },
  '🦃': { slug: 'truthahn', label: 'Truthahn' },
  '🦚': { slug: 'pfau', label: 'Pfau' },
  '🦜': { slug: 'papagei', label: 'Papagei' },
  '🦢': { slug: 'schwan', label: 'Schwan' },
  '🦩': { slug: 'flamingo', label: 'Flamingo' },
  '🕊️': { slug: 'taube', label: 'Taube' },
  '🐇': { slug: 'hase-2', label: 'Hase' },
  '🦝': { slug: 'waschbaer', label: 'Waschbär' },
  '🦨': { slug: 'stinktier', label: 'Stinktier' },
  '🦡': { slug: 'dachs', label: 'Dachs' },
  '🦦': { slug: 'otter', label: 'Otter' },
  '🦥': { slug: 'faultier', label: 'Faultier' },
  '🐁': { slug: 'maus-2', label: 'Maus' },
  '🐀': { slug: 'ratte', label: 'Ratte' },
  '🐿️': { slug: 'eichhoernchen', label: 'Eichhörnchen' },
};
