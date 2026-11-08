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

## Stand der Umsetzung

- **Schritt 1–7 umgesetzt** (8.11.2026, Zweig `ccr-e6a37a08-zveo47`): Hauptmenü `#/` (`screens/Menu.tsx`, `menu.css`), gemeinsame Hülle `components/TavernPage.tsx` mit dunklen Farb-Tokens im Rahmen, Profil (`#/pass`, Sicherheit aufklappbar), Mehrspieler (`#/online`), Turniere (`#/turniere`, Anlegen in drei Schritten), Einzelspieler (`#/einzelspieler`), Optionen (`#/ton`). Szene aus CSS-Schichten mit Parallaxe, flackerndem Licht, Kaminglut und Funken; steht still bei „Bewegung reduzieren“ und auf schmalen Bildschirmen.
- **Offen:** Liste „Offen zum Mitmachen“ für Turniere (braucht ein Verzeichnis auf dem Server); echtes Wappen in der Profil-Plakette; Aussehen „Taverne“ für Spiel- und Lobby-Bildschirme (Play, Room, Setup) noch nicht auf den neuen Rahmen umgestellt; im Browser noch nicht angesehen.
- **Taverne als Bild (#191, 8.11.2026):** Die CSS-Szene ist durch ein gemaltes Bild ersetzt (`components/TavernScene.tsx`, Bilder in `apps/web/src/menu/`, je unter 100 KB als WebP). Zwei Ebenen fürs Querformat: Raum ohne Tisch hinten, der freigestellte Tisch mit Karten und Würfeln vorn; die Parallaxe bewegt sie unterschiedlich weit (`--mx`/`--my`), Laternenschein, Kaminglut und Funken bleiben CSS-Schichten dazwischen. Auf Bildschirmen bis 760 px und bei „Bewegung reduzieren“ zeigt die Szene ein Hochformat-Standbild (`taverne-hoch.webp`) ohne Vordergrund; Unterseiten (`TavernPage`, `calm`) zeigen nur den Raum, abgedunkelt und fest stehend. Rechts ist das Bild bewusst eine ruhige, dunkle Steinwand für den Menürahmen.
  - **Erzeugung:** Modell `gemini-3.1-flash-image` (Gemini-API), 9 Anfragen: 1 Test, 4 Entwürfe (zwei quer, zwei hoch), 2 Ebenen aus dem gewählten Bild per Bildbearbeitung (Raum ohne Tisch; Tisch auf einfarbigem Grün zum Freistellen). Gewählt: Querformat „q2“, Hochformat „h2“. Prompts ohne Markennamen („gemalter Fantasy-Kartenspiel-Stil“, „keine Logos, keine Schrift“); ein Hearthstone-Logo oder -Kartenrücken darf nicht im Bild sein (Cornelius). Rohbilder liegen nicht im Repo.
  - **Offen:** Mittlere Ebene (Kamin) und Tiefenkarte entfielen; zwei Ebenen mit den CSS-Lichtschichten reichen für die Tiefe.
