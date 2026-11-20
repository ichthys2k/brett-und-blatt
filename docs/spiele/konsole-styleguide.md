# Styleguide der Konsolen-Oberfläche (Vorhaben #607)

Verbindliche Maße, Farben, Tasten und Verhaltensregeln für alles unter `apps/web/src/console/`. Plan und Schritte: [`konsole.md`](konsole.md). Für die gemalten Bilder gilt weiter die [Stilbibel](../grafik/STILBIBEL.md); dieser Styleguide regelt nur die Oberfläche.

## 1. Grundsätze

1. **Aus zwei Metern lesbar.** Maßstab ist das Steam Deck (1280 × 800, 7 Zoll, Armlänge) und der Fernseher (1920 × 1080, Sofa). Lieber weniger auf einmal zeigen als kleiner.
2. **Der Fokus ist die Hauptsache.** Es gibt immer genau ein fokussiertes Element, es ist immer sichtbar, und es ist immer klar, was A jetzt tut.
3. **Eine Achse je Liste.** Regale laufen waagrecht, Regale untereinander senkrecht, Aktionslisten senkrecht. Keine verschachtelten Raster in Rastern.
4. **Feste Tasten.** Dieselbe Taste tut überall dasselbe (Abschnitt 5). Die Tastenleiste unten zeigt, was auf dem Bildschirm gilt.
5. **Maus und Finger gleichwertig.** Alles ist auch antippbar; nichts ist nur per Controller erreichbar.
6. **Eigene Gestaltung.** Die Taverne liefert Farben, Schrift und Bilder. Keine Nachbildung von Aussehen, Symbolen, Schriften oder Klängen eines Herstellers.

## 2. Maße

Alle Größen sind Vielfache der Einheit `--kns-u`. Sie wächst mit der Fensterbreite, damit dieselbe Aufteilung auf Handheld und Fernseher passt:

```css
--kns-u: clamp(6px, 0.625vw, 12px);
```

| Fensterbreite | `--kns-u` | Beispiel |
|---|---|---|
| 844 px (Handy quer) | 6 px | kleinste zulässige Größe |
| 1280 px (Steam Deck) | 8 px | Maßstab aller Angaben unten |
| 1920 px (Fernseher) | 12 px | |
| darüber | 12 px | wächst nicht weiter; mehr Kacheln je Zeile |

| Variable | Wert | bei 1280 px | Zweck |
|---|---|---|---|
| `--kns-gutter` | 5 u | 40 px | Seitenrand des Bildschirms |
| `--kns-gap` | 2 u | 16 px | Abstand zwischen Kacheln und Knöpfen |
| `--kns-bar` | 7 u | 56 px | Höhe der Kopfleiste |
| `--kns-legend` | 6 u | 48 px | frei gehaltener Platz für die Tastenleiste unten |
| `--kns-text-s` | 2,25 u | 18 px | Nebentext (Spielerzahl, Hinweise); kleiner wird Text nie |
| `--kns-text` | 2,5 u | 20 px | Fließtext, Kachelname, Knöpfe |
| `--kns-text-l` | 3 u | 24 px | Regalüberschrift, Reiter |
| `--kns-title` | 4 u | 32 px | Seitentitel, Name auf der Spielseite |
| `--kns-hero` | 6 u | 48 px | Emoji als Bildersatz |
| `--kns-tile-w` × `--kns-tile-h` | 28 u × 19 u | 224 × 152 px | Spielkachel; fünf passen bei 1280 px nebeneinander |
| `--kns-radius` | 2 u | 16 px | Eckenrundung von Kacheln und Feldern |
| `--kns-target` | 6 u | 48 px | kleinste Höhe und Breite jedes Bedienelements |

Zeilenhöhe 1,3 für Überschriften, 1,45 für Fließtext. Namen auf Kacheln stehen in einer Zeile und werden mit „…“ gekürzt; Beschreibungen stehen nur auf der Spielseite.

## 3. Farben und Schrift

- **Nur die vorhandenen Variablen:** `--color-bg` (Grund), `--color-surface` (Kacheln, Felder), `--color-ink` (Text), `--color-muted` (Nebentext), `--color-line` (Ränder), `--color-accent` und `--color-accent-ink` (Fokus, Hauptaktion), `--color-warning` (Stern), `--color-danger` (Verwerfen). Keine neuen Farbwerte in `console.css`. Damit folgen hell, dunkel, „Schlicht“, „Taverne“ und erhöhter Kontrast von selbst.
- **Schrift:** die der App (`--font-sans`). Nur der Schriftzug „Brett & Blatt“ in der Kopfleiste trägt in „Taverne“ die Zierschrift der Startseite.
- **Kontrast:** Text auf Bildern steht immer auf einem dunklen Verlauf (unten mindestens 60 % Schwarz), nie direkt auf der Kulisse.
- **Gemalte Bilder** nur im Aussehen „Taverne“: Kulisse als Kachelhintergrund (zusätzlich nur, wenn „Kulissen der Spiele“ eingeschaltet ist), Wappen als Kachelmitte. In „Schlicht“ und bei erhöhtem Kontrast: Fläche in `--color-surface`, Emoji statt Wappen.
- **Bilder nie größer als ihre Datei:** Wappen höchstens 160 × 184 px, Kulissen höchstens 1280 × 720 px (die `@2x`-Fassung nur für Flächen über 1280 px Breite).

## 4. Fokus und Bewegung

- **Fokus-Rahmen:** `outline: 0.5u solid var(--color-accent)` mit `outline-offset: 0.5u`. Kacheln wachsen zusätzlich auf 105 % (`transform: scale(1.05)`, 120 ms). Der Rahmen darf nie abgeschnitten sein: Regale und Raster halten dafür rundum 1,5 u Innenabstand.
- **Sichtbar** bei `:focus-visible` und, sobald ein Controller benutzt wird, bei jedem `:focus` (`:root[data-input-mode='gamepad']`).
- **Anfangsfokus:** Jeder Bildschirm setzt beim Öffnen den Fokus – auf das zuletzt benutzte Element dieses Bildschirms, sonst auf die Hauptaktion (`data-kns-autofocus`), sonst auf das erste Element (`useInitialFocus`).
- **Rückkehr:** Nach B liegt der Fokus wieder dort, von wo man kam. Nach dem Schließen eines Felds oder Fensters liegt er auf dem Auslöser.
- **Rollen:** Der fokussierte Gegenstand rollt ins Bild (`scrollIntoView` mit `nearest`); der rechte Stick rollt die Seite frei.
- **Bewegung sparsam:** nur das Wachsen der fokussierten Kachel und weiches Rollen. Unter `prefers-reduced-motion: reduce` entfällt beides.
- **Kein Hover-Zwang:** Was beim Überfahren erscheint, erscheint auch beim Fokus.

## 5. Tastenbelegung

Namen nach dem Xbox-Schema („Standard-Gamepad“); auf dem Steam Deck sind die Tasten gleich beschriftet. Tastatur in Klammern.

| Taste | In der Konsole | Im Spiel |
|---|---|---|
| Steuerkreuz / linker Stick (Pfeiltasten) | Fokus bewegen | Fokus bewegen |
| **A** (Enter) | Auswählen, Öffnen | Auswählen, Zug ausführen |
| **B** (Esc) | Zurück; offenes Feld schließen | Abbrechen, Fenster schließen – **verlässt nie die Partie** |
| **X** (`i`) | Bibliothek: Suche | Großansicht der Karte oder Figur |
| **Y** | Lieblingsspiel an/aus | – |
| **LB / RB** (`[` `]`, Bild↑ Bild↓) | Reiter wechseln | Bereich wechseln (Spielfeld ↔ Menü) |
| **Start ☰** | – | Menü der Partie öffnen und schließen |
| rechter Stick, LT / RT | Seite rollen | Spielfeld rollen |
| L3 / Select | Zeiger ein/aus (Notlösung) | Zeiger ein/aus |

Regeln dazu:
- Zu jedem Kurzbefehl (X, Y) gibt es irgendwo einen sichtbaren Knopf mit derselben Wirkung.
- Eine Partie verlässt man nur über das Menü (Start), nie versehentlich.
- Die Tastenleiste nennt höchstens fünf Einträge, die wichtigsten zuerst, mit kurzen Verben („Öffnen“, „Zurück“, „Suche“).

## 6. Bausteine

**Kopfleiste** (`--kns-bar` hoch): links der Schriftzug, daneben die Reiter Start · Bibliothek · Online · Optionen (aktiver Reiter unterstrichen in `--color-accent`), rechts Avatar und Name des Passes, Controller-Zeichen mit Anzahl, Uhrzeit.

**Spielkachel** (`GameTile`, 28 u × 19 u): Hintergrund Kulisse oder Fläche; mittig Wappen (11 u hoch) oder Emoji; unten Name und Spielerzahl; oben rechts ★ bei Lieblingsspielen; oben links das Abzeichen der Controller-Eignung. Die ganze Kachel ist ein Link.

**Abzeichen der Controller-Eignung:**

| Stufe | Zeichen | Vorleser-Text |
|---|---|---|
| `direct` | 🎮 | mit Controller spielbar |
| `carousel` | 🎮↔ | mit Controller über Zugliste spielbar |
| `cursor` | 🖱️ | nur mit Zeiger |

**Verweis-Kachel** (`kns-linktile`): gleiche Größe, großes Emoji, Name, eine Zeile Hinweis; für „Mehr“ und die Mathe-Voreinstellungen.

**Regal** (`Shelf`): Überschrift in `--kns-text-l`, darunter eine waagrechte, rollende Zeile von Kacheln. Leere Regale werden nicht gezeigt.

**Feld „Laufende Partie“:** über die ganze Breite, etwa 22 u hoch, Kulisse des Spiels, Name, Mitspieler, Knöpfe „Weiterspielen“ (Hauptaktion) und „Verwerfen“.

**Aktionsliste** (Spielseite): senkrechte Knöpfe über die Spaltenbreite, je mindestens 8 u hoch. Genau eine Hauptaktion („Spielen“) in `--color-accent`; darunter aufklappbare Felder mit `aria-expanded`.

**Filterzeile** (Bibliothek): Knöpfe mit `aria-pressed`, Suchfeld; bleibt beim Rollen oben stehen.

## 7. Texte

- Deutsch, du-Form, kurz. Knöpfe sind Verben oder Dingwörter ohne Satzzeichen: „Spielen“, „Partie einstellen“, „Anleitung“, „Weiterspielen“.
- Alle Texte in `apps/web/src/i18n.ts` unter `console.*` (Spieltisch: `play.prompt.*`, Schalter: `shell.*`, Hinweis: `consoleOffer.*`).
- Jede Kachel und jeder Knopf hat einen vollständigen Vorleser-Text (`aria-label`), der ohne das Bild verständlich ist. Zustandswechsel (Lieblingsspiel, Trefferzahl) werden angesagt (`announce` bzw. `aria-live="polite"`).

## 8. Technik-Regeln

- CSS-Klassen der Konsole beginnen mit `kns-` und stehen in `apps/web/src/console/console.css`; jede Regel steht unter `:root[data-shell='console']`, damit die klassische Oberfläche unberührt bleibt.
- Bedienelemente sind `<button>` oder `<a href>`; sonst `tabIndex={0}`, `role="button"`, `aria-label` und Enter/Leertaste. Dann findet sie die räumliche Navigation von selbst.
- Keine eigene Pfeiltasten-Logik je Bildschirm. Kurzbefehle über `useInputIntent(handler, 5)`; wer eine Taste verbraucht, gibt `true` zurück.
- Sichere Ränder beachten: `env(safe-area-inset-*)` zusätzlich zu `--kns-gutter`.
- Prüfgrößen: 1280 × 800, 1920 × 1080, 844 × 390; dazu 390 × 844 (muss klassisch bleiben). Jeweils „Taverne“ und „Schlicht“, hell und dunkel.
