# Hauptmenü und „Online spielen“ neu geordnet

Stand: 8.11.2026 – Entscheidungen von Cornelius, noch nicht umgesetzt.

## Entscheidungen

1. **Stil:** Menü im Stil von Warcraft III (Szene im Hintergrund, steinerner Rahmen mit wenigen großen Einträgen, Untermenüs im selben Rahmen), dazu optische Einflüsse aus Hearthstone (Holztisch, Karten, warmes Licht, kleine Animationen). Entwürfe A (Taverne) und C (Untermenü Mehrspieler); B (Dinge auf dem Tisch) entfällt.
2. **Das Hauptmenü ersetzt die heutige Startseite.**
3. **Einträge:** Einzelspieler, Mehrspieler, Turniere, **Profil** (nicht „Mein Pass“), Optionen.
4. **„Online spielen“ geht darin auf:** Mehrspieler (Neues Spiel, Mit Code beitreten, Offene Spiele live, Zuletzt gespielt) und Turniere (Meine Turniere, Offen zum Mitmachen, Anlegen in drei Schritten, Mit Code) sind die zwei Eingänge. Name, Wappen, Pass und Sicherheit liegen hinter **Profil**.

Entwürfe: Design-Canvas „Hauptmenü – Entwürfe“ (https://claude.ai/artifact/YUb55i7xP7jjy1znKrwV66) und „Online spielen – neue Struktur“ (https://claude.ai/artifact/N8nVaML63kBXAd7oXjksUb).

## Leitlinien

- **Alles soll stark nach Taverne aussehen** (Cornelius, 8.11.2026): nicht nur das Hauptmenü, sondern alle Bildschirme (Holz, Stein, Pergament, Laternenlicht, Almendra-Schrift); der Look „Taverne“ (`look.css`) wird zum durchgängigen Standard und die Menü-Rahmen werden als wiederverwendbare Bausteine gebaut.

- Die Szene ist reiner Hintergrund (Schichten, leichte Parallaxe auf Mausbewegung). Auf dem Handy, bei „Bewegung reduzieren“ und im Energiesparmodus: Standbild. Das Menü ist normales HTML, per Tastatur bedienbar.
- Der Rahmen bleibt stehen, nur der Inhalt wechselt; „Zurück“ führt eine Ebene hoch.
- Unten immer die Profil-Plakette mit Wappen, Name und „Wechseln“.
- Die heutige Spielübersicht (Rubriken, Filter, Lieblingsspiele, Spielerzahl) wird zu „Einzelspieler“ und zur Spielwahl in „Neues Spiel“.
- Hash-Routen bleiben gültig (`#/online`, `#/turnier/…`, `#/raum/…`, `#/neu/<id>`); alte Links leiten auf die neuen Ebenen um.

## Schritte

1. Rahmen und Szene (Standbild, Parallaxe), Hauptmenü mit fünf Einträgen, Profil-Plakette.
2. Profil: Name, Wappen, Pass, Sicherheit (Inhalte des heutigen `PlayerPassPanel` und `Pass.tsx` umziehen).
3. Mehrspieler: Neues Spiel (zwei Schritte), Mit Code, Offene Spiele.
4. Turniere: Übersicht, Anlegen als Assistent.
5. Einzelspieler: heutige Startseite hinter dem Eintrag.
6. Optionen: Ton, Aussehen, Updates (heute `#/ton`).
7. Szene verfeinern (Schichten, Licht, Hearthstone-Anmutung); echtes 3D nur, wenn es sich lohnt.

## Offen

- Bildmaterial für die Szene (Schichten der Taverne): Illustration oder KI-Bild, Kennzeichnung in `THIRD_PARTY.md`.
- Offene Fragen aus dem Online-Entwurf: Umbenennung PIN → „Geheimzahl“, Passkey → „Fingerabdruck-Schlüssel“; Regel, wer beim Laden eines Passes gewinnt; Voreinstellung „offen für alle“ bei „Neues Spiel“.
