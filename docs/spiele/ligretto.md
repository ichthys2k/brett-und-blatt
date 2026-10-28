# Ligretto

*Reaktionsspiel für 2–8 Spieler – gleichzeitig, schnell.*

## Überblick

Ligretto ist ein reines Reaktionsspiel. Jeder Spieler hat seinen eigenen verdeckten Ligretto-Stapel, einen offenen Ablagestapel und eine offene Hand. In der Mitte liegen beliebig viele offene Mittelfeldstapel. Auf jeden Mittelfeldstapel darf nur in aufsteigender Reihenfolge der gleichen Farbe (meist 1→2→3→4→5) gelegt werden. Wer als Erster seinen Ligretto-Stapel komplett abgelegt hat, ruft „Ligretto!“ und die Runde endet.

## Regeln (klassisch)

- **Kartendeck:** Pro Spieler ein separates Ligretto-Deck gleicher Karten (z. B. 40 Karten pro Deck, nummeriert 1–10 in 4 Farben). Für Online/Hot-Seat werden pro Spieler die eigenen Karten gemischt.
- **Auslage je Spieler:** Ligretto-Stapel verdeckt (Ziel, leer machen), Handstapel offen (oberste Karte sichtbar), Hand mit 1–3 offenen Karten zum Sofortlegen.
- **Mittelfeld:** Beliebig viele Stapel. Auf einen leeren Platz kann eine Karte mit der Zahl **1** gelegt werden. Ansonsten nur fortlaufend +1 der gleichen Farbe.
- **Sofortiges Legen:** Jeder darf jederzeit beliebige passende Karten von seiner Hand oder von der Oberseite seines offenen Handstapels auf irgendeinen passenden Mittelfeldstapel legen. Kein fester Zugreigen.
- **Umblättern:** Wenn die Hand leer ist oder nach Wunsch, kann die oberste Karte des verdeckten Ligretto-Stapels auf den offenen Handstapel umgedreht werden (oder automatisch aufgefüllt).
- **Ligretto rufen:** Wenn der eigene Ligretto-Stapel leer ist, darf/ruf „Ligretto!“. Die Runde endet sofort. 
- **Punktewertung (klassisch):** Der Ligretto-Rufer erhält +10 Punkte pro Karte, die sich noch in den Ligretto-Stapeln der anderen Spieler befindet. Für jede eigene Karte, die im Mittelfeld liegt, erhält er -1 Punkt (oder je nach Variante +1 pro abgelegte Karte). Andere Spieler erhalten nur Punkte für Karten, die sie im Mittelfeld abgelegt haben.

## Umsetzung in Brett & Blatt

- **Muster:** Gleichzeitige Züge. Alle aktiven Spieler sind gleichzeitig am Zug (`currentPlayers` liefert alle).
- **Verdeckte Information:** Nur die eigene Hand/Stapel für den Spieler sichtbar. Das Mittelfeld ist für alle offen. `playerView` blendet alles Verdeckte aus.
- **Züge:** `playToCenter` (Karte von eigener Hand oder vom offenen Handstapel auf passenden Mittelfeldstapel), `flip` (umdrehen vom Ligretto-Stapel), `callLigretto` (Runde beenden, wenn Ligretto-Stapel leer).
- **Konfliktauflösung:** Kommen mehrere Züge gleichzeitig an, wendet der Server sie in **Eingangsreihenfolge** an und prüft nach jeder Anwendung erneut die Legalität. Trifft Zug A zuerst auf Stapel X und füllt/legt erfolgreich, kann Zug B für denselben Stapel nicht mehr passen.
- **Determinismus:** Kein `Math.random()` in Regeln; Mischen erfolgt über `Rng` aus dem Seed. Spielstand ist reines JSON.
- **Bots:** Reaktionsbasierter Bot – scannt ständig nach passenden Karten, wählt eine aus und führt sie mit Verzögerung aus (150–600 ms je Schwierigkeitsstufe), um menschlich zu wirken.

## Spielmodul

- **Ordner:** `packages/games/ligretto/`
- **Spieler:** 2–8
- **Modi:** `hotseat`, `online` (Klassen-/Rundenmodus)
- **Regelversion:** 1

## UI-Idee

- **Mittelfeld:** Groß, zentral, Stapel stapeln sich vertikal; Zahl/Farbe gut erkennbar
- **Eigene Zone:** Unten – Ligretto-Stapel (verdeckt), Handstapel (offen), Handkarten in einem Fächer
- **Sofort-Feedback:** Hervorhebung passender Karten, kurze Animation beim Ablegen, „Ligretto!“-Button/-Hinweis
- **Übergabe:** Nicht nötig bei Online, bei Hot-Seat kann Übergabe für verdeckte Infos vermieden werden, da jeder nur seine eigene Zone sieht
- **Mobil:** Optimiert für schnelles Tippen

## Implementierungsplan

1. **Gerüst** – `pnpm neues-spiel ligretto "Ligretto"` erledigt ✓
2. **Meta** – Spieleranzahl 2–8, Modi hotseat/online, Muster simultaneous/open, howToPlay
3. **Regeln** – Typen, Setup, Mischen pro Spieler, legalMoves für simultanes Spiel, applyMove mit Reihenfolgeprüfung, playerView, callLigretto, Rundenende/Punkte
4. **Bots** – Reaktionsbot mit Scan + verzögerte Züge
5. **UI** – Mittelfeld + eigene Zone, schnelle Interaktion
6. **Server** – In games.ts + package.json eingetragen ✓, `pnpm install` erledigt
7. **Tests** – gameContractChecks + Konfliktauflösung, Ligretto-Ruf
8. **Integration** – Sounds, evtl. Playlist „Spielabend“

## Offene Punkte

- **Punktevergabe:** Exakte Variante festlegen (klassisch vs vereinfachte Variante)
- **Handgröße:** 1, 2 oder 3 Karten zum Ablegen
- **Anzahl Decks:** Pro Spieler eigenes Deck oder gemeinsames? Klassisch eigenes Deck
- **Runden/Spielende:** Mehrere Runden bis Zielpunktzahl oder bis X Runden
- **„Speed“-Aspekte:** Server-Taktung für simultane Phase, Animationen für viele gleichzeitige Legungen

## Umsetzungsstand (28.10.2026)

- **Fertig:** Regeln mit gleichzeitigen Zügen (`playFromHand`, `playFromPile`, `flip`, `callLigretto`), Wertung über mehrere Runden, `playerView` blendet fremde Stapel und Hände aus, Reaktions-Bot in drei Stufen, Oberfläche mit `PlayingCard`, Server-Eintrag, Startseite (*Karten- & Stichspiele*).
- **Offen:** Zuschauer erhalten den vollen Stand samt `rng`; Tests nur `gameContractChecks` (Konfliktauflösung und Ligretto-Ruf ungetestet, Schritt 7 im Plan); die offenen Regelpunkte oben sind noch nicht festgehalten; keine Playlist.
