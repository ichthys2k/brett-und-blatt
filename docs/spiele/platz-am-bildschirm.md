# Platz am Bildschirm (Vorhaben #482)

Grundsatz (Cornelius, 16.11.2026): Jeder Spieler wird durch genau ein Bild dargestellt – sein Porträt im Wappenschild; Menschen und Computergegner gleich. Das Platzzeichen des Spiels bleibt als kleine Plakette am Schild. Die Schritte stehen als Unter-Issues von #482.

## D1 – Spielerschild (#491, umgesetzt 16.11.2026)

- `PlayerCrest` (`packages/ui/src/crest/PlayerCrest.tsx`): optional `portrait`, `portraitEmoji`, `ring`. Medaillon-Maße je Schildform in `PORTRAIT_MEDALLION` (klassisch/rund/rolle Mitte y 80, Radius 34; spitz y 70, Radius 30 – gerechnet gegen die Schildkontur).
- `PlayerShield` (`packages/ui/src/PlayerShield.tsx`): Avatar + Wappenbeschreibung + Uhr + Platzzeichen; Medaillon nie über 192 px (`shieldWidth`).
- `PlayerChip size="card"` mit `crest` und `shieldSize` (Vorgabe 72); kompakt unverändert.
- Gemalte Bilder nur im Aussehen „Taverne“; „Schlicht“ und erhöhter Kontrast zeigen das Emoji (Entscheidung 4 in #482).
- Einsatz folgt in D3 (Leiste links), D4 (Sitzring) und D5 (Lobby).
