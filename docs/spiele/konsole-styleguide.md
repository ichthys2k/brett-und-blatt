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
- Prüfgrößen: 390 × 844, 360 × 640, 768 × 1024 (Hochformat, Abschnitt 9), 844 × 390, 1280 × 800, 1920 × 1080. Jeweils „Taverne“ und „Schlicht“, hell und dunkel.

---

Die Abschnitte 9–13 gehören zum Vorhaben „Konsole überall“ (#635, Plan in [`konsole-ueberall.md`](konsole-ueberall.md)). Sie beschreiben den **Soll-Stand**; wer einen Schritt umsetzt und abweichen muss, trägt die Abweichung hier nach.

## 9. Hochformat (U2)

- Hochformat gilt, wenn das Fenster höher als breit oder schmaler als 700 px ist (`knsLayout` in `packages/ui/src/konsole/layout.ts`); `useKnsLayout()` (`apps/web/src/console/`) setzt `data-kns-layout="portrait|landscape"` an `<html>`.
- Maße im Hochformat: `--kns-u: clamp(7px, 2.05vw, 10px)` (8 px bei 390 px Breite), `--kns-gutter` 2 u, `--kns-gap` 1,5 u. Schriftstufen kleiner als im Querformat: Text 2 u (16 px), klein 1,75 u, groß 2,25 u, Titel 3 u; `--kns-target` mindestens 44 px.
- Raster zweispaltig (ab 600 px Breite dreispaltig), die Kachel füllt ihre Spalte im Verhältnis 1 : 0,72. Im Regal sind zwei Kacheln ganz und die dritte angeschnitten zu sehen (`--kns-tile-w` = verfügbare Breite / 2,3).
- Bibliothek: Suche in voller Breite, Rubriken als rollende Chip-Zeile, am Ende ein Chip „Spielerzahl“, der ein Fenster mit den Spielerzahlen öffnet.
- Spielseite einspaltig in der Reihenfolge Wappen, Name, Spielerzahl, Aktionen, Beschreibung.
- **Leiste unten** statt Reitern oben: Höhe 8 u plus `env(safe-area-inset-bottom)`, je Reiter Symbol über Name, aktiver Reiter in `--color-accent`. Oben eine schmale Kopfzeile (6 u) mit Schriftzug, „☰“ und Pass-Avatar.
- Unterreiter und Kategorien werden zu einer waagrecht rollenden Zeile unter der Kopfzeile.
- Zweispaltige Seiten (Detail, Einstellungen) werden einspaltig; die Hauptaktion steht ohne Rollen im sichtbaren Bereich.
- Fenster kommen von unten über die volle Breite, höchstens 90 % der Höhe; Aktionen unten nebeneinander, bei mehr als zwei untereinander.
- Tippziele mindestens 44 × 44 px (`--kns-target`), Abstand zwischen Zielen mindestens 1 u.
- Die Tastenleiste erscheint nur bei Controller-Nutzung und sitzt dann über der Leiste.

## 10. Seitenmuster

Jede Menüseite ist eines dieser sieben Muster. Der Name steht im Issue des Schritts.

| Nr. | Muster | Aufbau | Bausteine | Beispiele |
|---|---|---|---|---|
| 1 | **Regal** | Überschriften mit waagrecht rollenden Kachelzeilen | `KnsShelf`, `KnsTile` | Start |
| 2 | **Raster** | Filterzeile, darunter Kachelraster | `KnsGrid`, `KnsTile` | Bibliothek, Lernpakete, Helfer-Übersicht, Stempel |
| 3 | **Einstellungen** | Kategorien links (Hochformat: Chips oben), rechts Abschnitte mit Zeilen: Beschriftung links, Bedienelement rechts; wirkt sofort, kein „Speichern“ | `KnsSplit`, `KnsSection`, Zeilen | Optionen, Konto |
| 4 | **Detail** | Links Bild, Name, Kerndaten; rechts oben **eine** Hauptaktion, darunter Zeilen und Listen | `KnsPage`, `KnsButton`, Zeilen, `KnsList` | Spielseite, Lobby, Lernpaket |
| 5 | **Liste mit Aktion** | Kopf mit ein bis zwei Aktionen, Chip-Filter, Liste; je Zeile eine Hauptaktion (A) und höchstens zwei Nebenaktionen | `KnsPage`, `KnsList`, `KnsEmpty` | Offene Runden, Schwarzes Brett, Turniere, Klassen, Sammlung |
| 6 | **Formular** | Felder untereinander, Aktionen unten („Abbrechen“ links, Hauptaktion rechts); als Fenster (`KnsDialog`), als Seite mit fester Fußzeile oder geführt in Schritten | `KnsDialog`, `KnsField`, Zeilen | Raum eröffnen, Turnier anlegen, Karten-Editor |
| 7 | **Text** | Abschnitte als Kategorien, Lesetext mit höchstens 70 Zeichen je Zeile | `KnsSplit` | Impressum, Datenschutz, Anleitung |

Benannte Spielarten, die die Issues verwenden:
- **„Bibliothek“** = Regal und Raster zusammen (Rubriken als Regale, „Alle“ als Raster).
- **„Profil“** = Detail mit Kopf (Wappen, Name, Stand) und `KnsSubTabs` darunter (Pass, Turnierseite, Klasse, Verein, Serie).
- **„Werkzeug“** = Detail mit großer Anzeige in der Mitte und der Hauptaktion darunter (Spielhelfer).
- **„Schritte“** = Formular, geführt: ein Schritt je Ansicht, „Zurück“/„Weiter“, LB/RB wechselt den Schritt.

Regeln für alle Muster:
- Genau **eine** Hauptaktion je Ansicht (`variant="primary"`); sie ist das erste Fokusziel, außer es gibt eine Liste, in der man weitermacht.
- Gefährliches (`variant="danger"`) steht unten und fragt immer nach.
- Leere Listen zeigen `KnsEmpty` mit der nächstliegenden Aktion, nie eine leere Fläche.
- Unterreiter und Kategorie stehen in der Adresse (Abfrage `?reiter=…` bzw. `?bereich=…`), damit B und Neuladen stimmen.

## 11. Bausteine `Kns…` (U1)

Ort: `packages/ui/src/konsole/`, CSS in `konsole.css` (Präfix `kns-`, nur unter `:root[data-shell='console']`). Schauseite: `/?modus=konsole#/bausteine`. Die Eigenschaften je Baustein stehen in #636.

| Gruppe | Bausteine | Maße und Aussehen |
|---|---|---|
| Knopf | `KnsButton` (`primary`, `secondary`, `danger`, `quiet`; Größe `m`, `l`) | Höhe `m` = `--kns-target`, `l` = 8 u; Ecken 1 u; `primary` in `--color-accent`, `danger` in der Warnfarbe, `quiet` ohne Fläche |
| Seite | `KnsPage`, `KnsSection` | Titel `--kns-title`, größte Inhaltsbreite 120 u; ein Abschnitt ist eine Fläche in `--color-panel` mit Ecken 1,5 u, Zeilen durch feine Linien getrennt |
| Zeilen | `KnsToggleRow`, `KnsSliderRow`, `KnsChoiceRow`, `KnsActionRow`, `KnsLinkRow`, `KnsInfoRow`, `KnsTextRow`, `KnsStepperRow` | Höhe mindestens 7 u, Innenabstand 2 u; Beschriftung links in `--kns-text`, Hinweis darunter in `--kns-text-s` und gedämpft; Bedienelement rechtsbündig. Die **ganze Zeile** trägt den Fokus-Rahmen. Im Hochformat rutscht ein breites Bedienelement (Regler, Knopfleiste) unter die Beschriftung |
| Auswahl | `KnsChoiceRow` | bis 4 Möglichkeiten als Knopfleiste in der Zeile, sonst Wert + „›“ und Liste im Fenster (`role="radio"`) |
| Liste | `KnsList`, `KnsListItem` | Zeile mindestens 8 u; links Bild 6 u, Titel und Meta-Zeile, rechts Zustand und Nebenknöpfe; ganze Zeile = Hauptaktion |
| Navigation | `KnsSubTabs`, `KnsSplit` | Unterreiter 6 u hoch, aktiver mit Unterstrich in `--color-accent`; Kategorien links 30 u breit |
| Fenster | `KnsDialog` (`s` 50 u, `m` 80 u, `l` 110 u breit) | abgedunkelter Hintergrund, Titel oben, Schließen-Knopf, Aktionen unten; `aria-modal`, B schließt, Fokus kehrt zurück |
| Meldung | `KnsBanner` (`info`, `success`, `warning`, `danger`), `KnsEmpty` | Banner mit farbiger Kante links, höchstens eine Aktion; `KnsEmpty` mittig mit großem Symbol |
| Formular | `KnsField` | Beschriftung über dem Feld, Fehler darunter in der Warnfarbe und mit `aria-describedby` |
| Kacheln | `KnsTile`, `KnsShelf`, `KnsGrid` | wie Abschnitt 6 (Kachel, Regal); `GameTile` baut auf `KnsTile` auf |
| Anzeige | `KnsCode` | große Zeichen mit Abstand, für Raumcodes; daneben „Kopieren“ |

Fehlt ein Baustein, wird er dort ergänzt und auf der Schauseite gezeigt – nicht auf der Seite nachgebaut.

**Stand nach U1 (#636), Abweichungen vom Plan:**
- `KnsTile` hat statt `badges` zwei Plätze: `badge` (oben links, z. B. Controller-Eignung) und `mark` (oben rechts, z. B. Stern), dazu `variant: 'game' | 'link'` für Verweis-Kacheln.
- `KnsListItem` kennt zusätzlich `label` (Vorleser-Text der Hauptaktion), `disabled` und `focusId` (`data-kns-id` für die Fokus-Wiederherstellung).
- `KnsCode` hat `label` (Vorleser-Text) und `copy` (Knopf „Kopieren“, Standard an); `KnsSubTabs` und `KnsSplit` haben `label` für den Vorleser.
- `KnsChoiceRow` nimmt optional `mode`, um Knopfleiste oder Fenster zu erzwingen.
- Text auf `danger`-Knöpfen in `--color-bg` (in beiden Helligkeiten lesbar), nicht in Weiß.
- Fenster liegen als `position: fixed` im Seitenbaum (kein Portal), damit der Fokus-Rahmen der Konsole greift; Hochformat (`orientation: portrait` oder unter 700 px Breite) zeigt sie von unten über die volle Breite.
- `useViewportSize()` liefert die Fenstergröße für `KnsSplit` und spätere Layout-Entscheidungen.

## 12. Navigation (U3)

- **Zwei Ebenen:** fünf Hauptreiter (Start · Bibliothek · Online · Pass · Optionen), darunter Unterreiter (Tabelle in [`konsole-ueberall.md`](konsole-ueberall.md), Abschnitt 3). Eine dritte Ebene gibt es nur innerhalb einer Seite (Unterreiter eines Profils, Kategorien der Einstellungen).
- **LB/RB** wechselt immer die Hauptreiter – außer in einem Fenster mit Schritten. Unterreiter und Kategorien erreicht das Steuerkreuz.
- **B** geht eine Ebene zurück: Fenster zu → vorige Seite → Start. B verlässt nie die App und nie eine Partie.
- **Start ☰** öffnet in den Menüs den Schnellzugriff (Lautstärke, Musik, Pass, Weiterspielen, „Alle Optionen“); am Spieltisch das Menü der Partie. In der Kopfleiste gibt es denselben Knopf für Finger und Maus.
- **X** ist die Nebenaktion der fokussierten Zeile (z. B. Ausblenden, Ergebnis eintragen), **Y** das Anheften (Lieblingsspiel). Beides steht in der Tastenleiste und ist immer auch als sichtbarer Knopf vorhanden.
- Jede Route gehört zu genau einem Platz (`placeForRoute`); ein Test verhindert vergessene Routen.

## 13. Meldungen, Zustände und Texte der Menüs (U15)

- **Meldungen** erscheinen als `KnsBanner` in einem gemeinsamen Stapel (Querformat oben rechts, Hochformat oben über die Breite), höchstens drei gleichzeitig. Ohne Aktion verschwinden sie von selbst und nehmen nie den Fokus; mit Aktion bleiben sie, bis man sie bedient oder schließt.
- **Rückfragen** immer über `KnsDialog`, nie über Fenster des Browsers. Titel ist die Frage („Klasse auflösen?“), die Knöpfe nennen die Handlung („Auflösen“, „Abbrechen“), nicht „Ja/Nein“. Fokus steht auf der ungefährlichen Antwort.
- **Laden:** `KnsEmpty` mit ruhiger Bewegung (ohne bei `prefers-reduced-motion`); erst nach 300 ms zeigen, damit nichts flackert.
- **Fehler:** sagen, was nicht ging und was man tun kann („Das hat nicht geklappt. Prüfe die Verbindung.“ + „Nochmal“). Keine Fehlercodes im Text.
- **Texte:** Regeln aus Abschnitt 7; Zeilen-Beschriftungen sind Dingwörter („Lautstärke Musik“), Hinweise ganze kurze Sätze. Schlüssel unter `console.*` in `apps/web/src/i18n.ts`, vorhandene Texte der klassischen Seiten wiederverwenden.
