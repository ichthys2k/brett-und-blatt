# Platz am Bildschirm (Vorhaben #482)

Grundsatz (Cornelius, 16.11.2026): Jeder Spieler wird durch genau ein Bild dargestellt – sein Porträt im Wappenschild; Menschen und Computergegner gleich. Das Platzzeichen des Spiels bleibt als kleine Plakette am Schild. Die Schritte stehen als Unter-Issues von #482.

## D1 – Spielerschild (#491, umgesetzt 16.11.2026)

- `PlayerCrest` (`packages/ui/src/crest/PlayerCrest.tsx`): optional `portrait`, `portraitEmoji`, `ring`. Medaillon-Maße je Schildform in `PORTRAIT_MEDALLION` (klassisch/rund/rolle Mitte y 80, Radius 34; spitz y 70, Radius 30 – gerechnet gegen die Schildkontur).
- `PlayerShield` (`packages/ui/src/PlayerShield.tsx`): Avatar + Wappenbeschreibung + Uhr + Platzzeichen; Medaillon nie über 192 px (`shieldWidth`).
- `PlayerChip size="card"` mit `crest` und `shieldSize` (Vorgabe 72); kompakt unverändert.
- Gemalte Bilder nur im Aussehen „Taverne“; „Schlicht“ und erhöhter Kontrast zeigen das Emoji (Entscheidung 4 in #482).
- Einsatz folgt in D3 (Leiste links), D4 (Sitzring) und D5 (Lobby).

## D2 – Porträt und Wappenschild für jeden Platz (#492, umgesetzt 16.11.2026)

- `seatIdentity` (`apps/web/src/lib/seatIdentity.ts`): liefert für jeden Platz `avatar` und `crest`.
- Bots bekommen das gemalte Porträt ihres Spiels (`botAvatar`) und ein Standardschild (`defaultCrest(index)`).
- Menschen ohne gewählten Avatar bekommen ein festes gemaltes Bild je Platz (`defaultAvatar(index)`) aus 42 unterscheidbaren Tier-Avataren.
- Menschen ohne Wappen oder mit „im Raum verbergen“ bekommen ein Standardschild (`defaultCrest(index)` mit 8 kontrastreichen Farbkombinationen aus `crest-colors.ts`).
- Lokal gilt das eigene Profil nur bei genau einem menschlichen Spieler am Gerät; bei mehreren Plätzen greifen die Standardwerte je Platz.
- `OnlineTableProps` transportiert `crests` (`Display.tsx`, `Room.tsx` über Hilfsfunktion `seatMember`), `seatChip` und Siegerehrung (`Ceremony`) nutzen `seatIdentity`.

