/** Die Klänge der VR-App (#349) – eine kleine Auswahl aus dem Katalog der Web-App. */
export const XR_SOUND_NAMES = ['stein-setzen', 'stein-ziehen', 'stein-schlagen', 'stein-fallen', 'stein-heraus', 'stein-schiefer', 'steine-wenden', 'muehle', 'go-gefangene', 'schach-rochade', 'schach-umwandlung', 'gomoku-fuenf', 'dein-zug', 'sieg', 'remis-angebot'] as const;
export type XrSoundName = (typeof XR_SOUND_NAMES)[number];
