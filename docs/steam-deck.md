# Brett & Blatt mit Controller, auf dem Steam Deck und am Fernseher

> **Noch nicht auf einem echten Steam Deck geprüft.** Die Schritte in Abschnitt 3 sind nach der Dokumentation von Valve und der Browser geschrieben. Geprüft ist die Konsolen-Oberfläche bisher nur im Browser mit einem nachgebauten Controller (`scripts/konsole-probe.mjs`). Dieser Kasten kommt weg, sobald Cornelius es am Gerät bestätigt hat (Issue #625).

## 1. Was das ist

Brett & Blatt hat eine zweite Oberfläche für Controller, Handhelds und Fernseher: die **Konsolen-Oberfläche**. Sie zeigt die Spiele als Bibliothek mit großen Kacheln und lässt sich vom Start bis in die Partie mit dem Controller bedienen. Sie läuft im Browser; eine Installation aus dem Steam-Store gibt es nicht.

## 2. Schnell ausprobieren (jeder Rechner mit Controller)

- In Chrome, Chromium oder Edge **https://spiele.lipponer.de/?modus=konsole** öffnen. Der Zusatz `?modus=konsole` gilt nur für diesen Aufruf.
- Dauerhaft: **Optionen → Oberfläche → Konsole**. Zurück geht es an derselben Stelle mit „Klassisch“.
- Wer zum ersten Mal einen Controller benutzt, bekommt die Konsole einmal angeboten.
- Die Konsole erscheint nur im Querformat ab 700 × 360 Pixeln, am Handy hochkant gilt immer die klassische Oberfläche.

## 3. Auf dem Steam Deck einrichten

1. In den **Desktop-Modus** wechseln (Steam-Taste → Ein/Aus → Zum Desktop wechseln).
2. Im App-Laden **Discover** einen Chromium-Browser installieren (z. B. Google Chrome oder Chromium).
3. In Steam (Desktop) **Spiele → Ein Nicht-Steam-Spiel zu meiner Bibliothek hinzufügen** und den Browser auswählen.
4. Den neuen Eintrag mit Rechtsklick → **Eigenschaften** öffnen und hinten an die **Startoptionen** anhängen:
   ```
   --kiosk --start-fullscreen "https://spiele.lipponer.de/?modus=konsole"
   ```
   Bei Browsern aus Flatpak steht dort schon ein `run …`-Befehl; die Zeile nur anhängen.
5. In den Eigenschaften unter **Controller** für diesen Eintrag die Vorlage **„Gamepad“** wählen. Sonst schickt das Deck Maus- und Tastatureingaben statt Controller-Tasten, und die Konsole erkennt keinen Controller.
6. Zurück in den Spielmodus wechseln und den Eintrag starten.

## 4. Tastenbelegung

| Taste | In der Konsole | Im Spiel |
|---|---|---|
| Steuerkreuz / linker Stick | Fokus bewegen | Fokus bewegen |
| **A** | Auswählen, Öffnen | Auswählen, Zug ausführen |
| **B** | Zurück; offenes Feld schließen | Abbrechen, Fenster schließen – verlässt nie die Partie |
| **X** | Bibliothek: Suche | Großansicht der Karte oder Figur |
| **Y** | Lieblingsspiel an/aus | – |
| **LB / RB** | Reiter wechseln | Bereich wechseln (Spielfeld ↔ Menü) |
| **Start ☰** | – | Menü der Partie öffnen und schließen |
| rechter Stick, LT / RT | Seite rollen | Spielfeld rollen |
| L3 / Select | Zeiger ein/aus (Notlösung) | Zeiger ein/aus |

Eine Partie verlässt man über das Menü (Start) und den Knopf „Zum Menü“. In der Bibliothek zeigt ein Abzeichen auf jeder Kachel, wie gut das Spiel mit dem Controller geht: 🎮 direkt, 🎮↔ über die Zugliste (Optionen → Bedienmodus „Erlaubte Züge“), 🖱️ nur mit Zeiger.

## 5. Was noch nicht geht

- **Texteingaben** (Kategorien-Sprint, Schätzmeister, Wort-Spiele, Namen) laufen über die Bildschirmtastatur: A auf dem Feld öffnet sie, ✓ übernimmt, B schließt. Das ist langsamer als mit einer echten Tastatur.
- **Echtzeitspiele** wie Fix gefunden!, Ligretto, Speed und die Enten-Rallye sind mit dem Steuerkreuz im Nachteil.
- Die Messwerte je Spiel stehen in [`spiele/konsole-eignung.md`](spiele/konsole-eignung.md). Wo etwas fehlt, hilft der Zeiger (L3 oder Select).

## 6. Fernseher und andere Handhelds

Der Weg ist derselbe: ein Browser mit Gamepad-Unterstützung (Chrome, Chromium, Edge), die Adresse mit `?modus=konsole`, Vollbild. Die Konsole passt ihre Größen an die Fensterbreite an; am Fernseher (1920 × 1080) wird alles entsprechend größer.
