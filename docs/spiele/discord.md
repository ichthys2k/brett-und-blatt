> Übernommen aus dem Claude-Dokument https://claude.ai/artifact/UDk6tpoDRFtBfgjgwAzRuL am 1.11.2026, damit andere Agenten den Plan lesen können. **Diese Datei ist ab jetzt die maßgebliche Fassung.**

# Etappe 7 – Discord-Anbindung: Konzepte im Vergleich (W-024)

Oct 31, 2026 · @Cornelius Lipponer

## Kurzfassung

Ich empfehle, Discord als **freiwillige Ergänzung von außen** anzubinden und Brett & Blatt nie davon abhängig zu machen. Zuerst zwei kleine Schritte: schöne Linkvorschauen für Raumlinks und ein Feld „Sprachkanal“ in der Lobby (zusammen etwa 1 bis 2 Tage). Danach, wenn gewünscht, ein **Discord-Bot** mit dem Befehl `/spielen`, der einen Raum erstellt und den Link postet (etwa 3 bis 4 Tage). Eine **Discord Activity**, also Brett & Blatt direkt im Sprachkanal, ist möglich, aber mit etwa zwei Wochen das größte Vorhaben und nur für ältere Spieler sinnvoll.

Der Grund für diese Reihenfolge ist die Altersgrenze: Discord ist in Deutschland erst ab 16 Jahren erlaubt. Für Schulklassen der Stufe 5 und 6 scheidet Discord damit aus; für Familie, Freunde und Jugendliche ab 16 ist es eine gute Ergänzung.

## Rahmenbedingung: ab 16 Jahren

Discord nennt für Deutschland ein Mindestalter von 16 Jahren, für Österreich 14 ([Discord-Hilfe](https://support.discord.com/hc/en-us/articles/360040724612)). Seit 2026 stellt Discord weltweit auf „jugendgerecht als Standard“ um und plant eine Altersverifikation per Gesichtsschätzung oder Ausweis; der weltweite Start wurde nach Protesten auf die zweite Jahreshälfte 2026 verschoben ([PC Games Hardware](https://www.pcgameshardware.de/Jugendschutz-Thema-24986/News/Discord-greift-beim-Jugendschutz-durch-Ende-des-Wilden-Westens-1497035/), [Deskmodder](https://www.deskmodder.de/blog/2026/02/09/discord-stellt-weltweit-auf-teen-by-default-um/)).

Daraus folgen drei Regeln für jedes Konzept:

- Brett & Blatt bleibt ohne Discord vollständig nutzbar; nichts darf nur über Discord gehen.
- In Schulseiten und Klassenspielen erscheint kein Discord-Hinweis.
- Discord ist ein US-Dienst; jede Anbindung braucht einen Absatz in der Datenschutzerklärung, und Brett & Blatt gibt keine Daten an Discord, außer der Nutzer startet es dort selbst.

## Fünf Konzepte im Vergleich

| Konzept | So sieht es aus | Aufwand | Nutzen | Empfehlung |
| --- | --- | --- | --- | --- |
| A Linkvorschau und Teilen | Raumlink in Discord zeigt eine Karte mit Spiel, Gastgeber, freien Plätzen | 1 Tag | mittel | zuerst |
| B Feld „Sprachkanal“ in der Lobby | Raumleitung hängt einen Discord-, Teams- oder Jitsi-Link an, alle Mitglieder sehen ihn | ½ Tag | mittel | zuerst |
| C Discord-Bot mit `/spielen` | Befehl im Server erstellt einen Raum, postet Link und Knöpfe, zeigt das Ergebnis | 3–4 Tage | hoch für Discord-Gruppen | danach |
| D Discord Activity | Brett & Blatt läuft im Sprachkanal, alle im Kanal sitzen am Tisch | 8–10 Tage | sehr hoch für Discord-Gruppen | später, falls gewünscht |
| E Eigener Sprachchat in der App | Sprechen direkt in Brett & Blatt, ohne Discord | 1–2 Wochen plus Betrieb | hoch | nicht empfohlen |

Das Social SDK von Discord (Sprachchat, Freundeslisten und Einladungen in eigenen Spielen) unterstützt nur C++, Unity und Unreal auf Desktop, Mobil und Konsole, keine Webseiten ([Plattformen](https://docs.discord.com/developers/discord-social-sdk/core-concepts/platform-compatibility)). Für Brett & Blatt als Web-App fällt es deshalb weg.

## Die Konzepte im Einzelnen

### A Linkvorschau und Teilen

Heute zeigt ein Raumlink in Discord, WhatsApp oder Signal nur die allgemeine Startseite. Der Spieleserver kann unter einer eigenen Adresse (etwa `/r/<Raumcode>`) eine kleine Seite mit Open-Graph-Angaben ausliefern („Schafkopf bei Cornelius, 2 Plätze frei“) und gleich zur Web-App weiterleiten. Dazu ein Knopf „Teilen“, der den Text für Discord mit Link und Emoji-Code vorbereitet. Hilft auch außerhalb von Discord und braucht kein Discord-Konto.

### B Feld „Sprachkanal“ in der Lobby

Die Raumleitung fügt einen Link zu einem Sprachkanal ein, der nur den Mitgliedern des Raums angezeigt wird, als Knopf „Zum Sprachkanal“. Erlaubt sind nur Links zu bekannten Diensten (Discord, Teams, Jitsi, Zoom, BigBlueButton), damit niemand fremde Seiten unterschiebt. Lehrkräfte können so auch Teams oder BigBlueButton nutzen.

### C Discord-Bot mit `/spielen`

- **Ablauf:** Im Discord-Server tippt jemand `/spielen schafkopf`. Der Bot erstellt über den Spieleserver einen Raum und postet eine Nachricht mit Spiel, Raumcode, Knopf „Mitspielen“ und Live-Stand der Plätze. Nach der Partie schreibt er das Ergebnis darunter.
- **Technik:** Discord kann Befehle per HTTP an einen Endpunkt schicken; das läuft im vorhandenen Cloudflare-Worker ohne dauerhafte Verbindung. Der Bot-Schlüssel kommt als Wrangler-Secret, nicht ins Repo.
- **Grenzen:** Gespielt wird im Browser, nicht in Discord; Discord-Namen werden nicht übernommen. Jemand muss den Bot in den eigenen Server einladen.

### D Discord Activity

- **Ablauf:** Im Sprachkanal startet jemand „Brett & Blatt“ über das Raketen-Symbol. Alle im Kanal sehen die Lobby und spielen direkt im Discord-Fenster, auf Desktop, im Browser und auf dem Handy ([Anleitung](https://app.cinevva.com/de/guides/publish-game-discord-activities)).
- **Technik:** Dieselbe Web-App mit einem Discord-Modus und dem Embedded App SDK. Anmeldung über Discord-OAuth (der Worker tauscht den Code gegen ein Token), Name und Bild kommen aus Discord. Alle Anfragen laufen über Discords Proxy (`<App-ID>.discordsays.com`) mit strenger Inhaltsrichtlinie; Spieleserver, Klänge und Musik müssen dort eingetragen werden. Der Sprachkanal wird auf einen Raum abgebildet (eine Activity-Instanz = ein Raum).
- **Veröffentlichen:** Damit fremde Server die Activity finden, muss die App bei Discord verifiziert werden; vorher funktioniert sie nur für eingetragene Tester. Den genauen Ablauf prüfe ich vor einer Umsetzung im Developer Portal.
- **Grenzen:** Hot-Seat und geteilter Bildschirm sind dort sinnlos, Klassenmodus auch. Jede Änderung an Adressen muss auch im Developer Portal nachgezogen werden.

### E Eigener Sprachchat

Technisch machbar über WebRTC mit einem Vermittlungsdienst, aber mit Kosten, Betriebsaufwand und vor allem Jugendschutzpflichten: Sprechen mit Fremden in offenen Runden müsste gemeldet, gesperrt und moderiert werden können. Das passt nicht zu einem Ein-Personen-Projekt mit Schulkindern als Zielgruppe.

## Vorgeschlagene Reihenfolge

1. **A und B** zusammen in einem Zweig, etwa 1 bis 2 Tage. Bringt allen etwas, auch ohne Discord.
2. **C Bot**, wenn du ihn in einem eigenen Discord-Server ausprobieren willst. Du legst dafür die App im Discord Developer Portal an und hinterlegst den Schlüssel selbst.
3. **D Activity** erst nach einem Probelauf mit C, wenn sich zeigt, dass Discord-Runden häufig sind. C und D teilen sich die Discord-App und den OAuth-Teil im Worker.
4. **E** nicht umsetzen.

## Offene Fragen

- [ ] Wer soll Discord nutzen: eher Familie und Freunde, oder auch Jugendliche ab 16 aus der Schule?
- [ ] Passen A und B als erster Schritt?
- [ ] Hast du einen eigenen Discord-Server zum Ausprobieren von Bot und Activity?
- [ ] Soll ich für D den Verifizierungsablauf bei Discord genau klären, bevor du entscheidest?

## Quellen

- [Discord-Hilfe: Mindestalter je Land](https://support.discord.com/hc/en-us/articles/360040724612)
- [Discord Social SDK: unterstützte Plattformen](https://docs.discord.com/developers/discord-social-sdk/core-concepts/platform-compatibility)
- [Cinevva: Spiel als Discord Activity veröffentlichen (2026)](https://app.cinevva.com/de/guides/publish-game-discord-activities)
- [PC Games Hardware: Discord verschiebt Altersverifikation](https://www.pcgameshardware.de/Jugendschutz-Thema-24986/News/Discord-greift-beim-Jugendschutz-durch-Ende-des-Wilden-Westens-1497035/)
- [Deskmodder: Discord stellt auf „Teen by default“ um](https://www.deskmodder.de/blog/2026/02/09/discord-stellt-weltweit-auf-teen-by-default-um/)
