# Suno-Playlists im Spiel einbetten: Machbarkeit (Issue #59)

Stand: 20.11.2026. Rechercheauftrag, kein Code.

**Wichtiger Vorbehalt zur Quellenlage:** In der Recherche-Umgebung waren `suno.com` und `help.suno.com` für direkte Abrufe gesperrt (Fehler „Host nicht erreichbar“). Alle Aussagen über Suno stützen sich daher auf Auszüge einer Websuche, die Suno-Hilfeseiten und -Blog wiedergeben, sowie auf Drittseiten. Was nur von Drittseiten stammt, ist als „Drittquelle“ gekennzeichnet. Die Nutzungsbedingungen selbst konnte ich **nicht im Wortlaut lesen**. Vor einer Entscheidung sollte Cornelius die unten genannten Seiten selbst öffnen.

## Kurzfassung

1. Einbetten ersetzt die heutige Lösung nicht sinnvoll: Ein offizieller Einbett-Player für einzelne Stücke existiert vermutlich, für Playlisten und für eine Steuerung durch das Spiel (Überblenden, Lautstärke, Ereignisse) konnte ich nichts belegen; zudem bräche der Offline-Betrieb weg, und es entstünde eine Verbindung eines Drittanbieters in einer App für Kinder und Schulklassen.
2. Die Annahme zu den Downloads stimmt im Kern: Pro erlaubt laut Suno 20 Downloads im Monat (Premier 60), sie gelten auch für Altbestand. Der Engpass lässt sich aber zeitlich strecken, weil jeder Monat neue Downloads bringt und die Stücke danach dauerhaft im privaten Klang-Repo liegen.
3. Empfehlung: Bei der heutigen Bauweise bleiben und Stücke gestaffelt herunterladen (gut 20 im Monat); wenn das Streuen der Musikdateien nicht stört, bei Bedarf zusätzlich vom eigenen Speicher nachladen.

## Heutige Lösung (aus dem Repo)

- `packages/ui/src/audio/music.json`: 6 Playlists, 25 Stücke, jedes mit Dateiname; Spiel -> Playlist über `games`.
- `packages/ui/src/audio/music.ts` (`MusicPlayer`): zwei Abspieler, je ein `Audio`-Element mit `createMediaElementSource(element)` (Zeile um 304-306) in Web Audio; Überblenden und Lautstärke laufen über Gain-Knoten; geladen werden nur das laufende und das nächste Stück.
- `apps/web/klaenge.ts`: baut die MP3s aus dem privaten Repo `brett-und-blatt-klaenge` beim Bauen unter `klaenge/musik/` ein; ein Stück darf höchstens 8 MB haben.
- `apps/web/vite.config.ts`: Musik ist aus dem Vorab-Cache des Service Workers ausgenommen und wird zur Laufzeit zwischengespeichert (Cache `musik`) – nach dem ersten Hören also offline verfügbar.
- `apps/web/csp.ts` (#322): `default-src 'self'`, `media-src 'self' blob: data:`, `frame-src 'none'`, `connect-src` nur eigene Seite und Spieleserver. Fremde Medien und Frames sind damit gesperrt.
- Die Stücke stehen laut CLAUDE.md unter CC BY-SA 4.0 (Suno).

## Befunde mit Quellen (alle abgerufen 20.11.2026)

**Downloads**
- Pro: 20 Downloads pro Monat, Premier 60, Free 7 einmalig; Rücksetzen am Abrechnungstag, kein Übertrag; MP3 auf allen Plänen, WAV für Pro/Premier nur im Web; ein Stück zählt einmal unabhängig vom Format; abgebrochene Downloads zählen nicht. Die Grenzen gelten ab 3.9.2026 auch für vor diesem Datum erzeugte Stücke; Zusatz-Downloads sind kaufbar. Ein Stapel-Download wurde nicht gefunden (Suchauszug: „no explicit bulk-download option“). Quellen: Suno-Hilfe <https://help.suno.com/en/articles/13876865>, <https://help.suno.com/en/articles/13926209>, <https://help.suno.com/en/articles/13926081>, <https://help.suno.com/en/articles/13614785>; Suno-Blog <https://suno.com/blog/suno-updates-tos>; Presse <https://www.musicbusinessworldwide.com/suno-limits-pro-subscribers-to-20-song-downloads-per-month>. Nur über Suchauszüge gelesen, nicht im Volltext.
- Zusatz-Downloads für 2,99 US-Dollar je Stück und Export über Suno Studio (Premier): nur Drittquelle <https://replayedstudio.com/blog/ran-out-of-suno-downloads/>, <https://mubert.com/blog/suno-commercial-use-plans-downloads>; **nicht belegt**.
- Die Annahme „stark begrenzt“ stimmt also; 20 im Monat bedeuten bei 25 vorhandenen Stücken aber nur etwa ein Monat Verzögerung je 20 weitere Stücke.

**Rechte**
- Suno (Blog): Für Stücke, die man als zahlender Abonnent herunterlädt, bestehen die kommerziellen Rechte; Trial-Downloads der Free-Stufe sind nicht kommerziell nutzbar (<https://suno.com/blog/suno-updates-tos>, über Suchauszug). Drittquelle: Die Bedingungen ab 3.9.2026 verbieten, Ausgaben kommerziell zu verwerten, die nicht über einen „approved channel“ heruntergeladen wurden (<https://mubert.com/blog/suno-commercial-use-plans-downloads>; Wortlaut **nicht verifiziert**).
- Folge für das Projekt (Vermutung): Die Rechte hängen am Download aus dem Pro-Konto. Ein Spiel, das ausschließlich über Sunos Player streamt, verlässt sich auf die Zusage für Sunos eigene Seite; eine Weitergabe unter CC BY-SA 4.0 (Nachnutzung durch Dritte, auch kommerziell) setzt dagegen heruntergeladene, selbst gehaltene Dateien voraus. Ob Suno-Bedingungen eine freie Lizenz überhaupt zulassen, ist **nicht belegt** und sollte rechtlich geklärt werden; das gilt für die heutige Lösung schon genauso.
- Hotlinking der CDN-Adressen der Audiodateien: Zu Sunos Bedingungen darüber **nicht belegt**. Technisch ist es keine vorgesehene Schnittstelle (siehe unten), also keine tragfähige Grundlage.

**Einbetten und API**
- Einbett-Player: Eine Drittquelle nennt Player-Seiten der Form `https://suno.com/embed/<Song-ID>` und zeigt ein `iframe` (<https://jackrighteous.com/blogs/guides-using-suno-ai-music-creation/how-to-embed-suno-songs>, <https://huggingface.co/spaces/MySafeCode/Downloadmp3fromsuno/commit/dc3ae0cd006147647e2c55a014c408db126fef33>). Eine **offizielle Hilfeseite zum Einbetten fand ich nicht**; die Suno-Hilfe nennt nur Teilen per Link, „Copy Link“ (<https://help.suno.com/en/articles/2565761>). Neue Stücke sind standardmäßig nur per Link sichtbar, Public muss gesetzt werden.
- Playlist-Einbettung: nichts gefunden (**nicht belegt**).
- Steuerung (Start, Lautstärke, nächstes Stück, Ereignisse): Eine JavaScript-Schnittstelle für den Player ist **nicht belegt**. Ein `iframe` von fremder Herkunft lässt sich ohne eine solche Schnittstelle nicht durch das Spiel steuern, und sein Ton läuft nicht durch das eigene Web-Audio-Netz: Überblenden zwischen Stücken, Master-Lautstärke und Stummschalten beim Verlassen (wie bei `ownMusic`) wären nicht umsetzbar.
- Offizielle API: keine öffentliche. Suno kündigte am 1.7.2026 einen Entwicklerzugang erst als eingeladenen Partnerkreis an, ohne Zeitplan und Preis (<https://www.digitalmusicnews.com/2026/07/03/suno-is-opening-an-api-partner-program/>, <https://musicbusinessworldwide.com/suno-explores-developer-api-seeking-apps-that-unlock-experiences-generative-music-makes-possible-for-the-first-time>; Zusammenfassung über Suchauszug). Inoffizielle Wrapper sind keine Option für ein öffentliches Schulprojekt.

**Technische Folgen im Projekt (aus dem Repo, sicher)**
- CSP: Ein Einbetten brauchte `frame-src https://suno.com` (heute `'none'`) und vermutlich weitere Hosts für Medien/Skripte des Players; das schwächt die in #322 gewonnene Absicherung.
- Direktes Streamen von Suno-Adressen in `MusicPlayer`: `createMediaElementSource` liefert bei fremder Herkunft ohne CORS-Freigabe Stille. Ob Sunos Server CORS erlaubt, ist **nicht belegt**.
- Offline: Entfällt vollständig; die PWA spielt heute zwischengespeicherte Stücke weiter.
- Autoplay: Ein fremder `iframe` braucht eine eigene Nutzerbedienung im Frame; das eigene Audio-Netz startet dagegen nach der ersten Geste der Seite (Annahme aus allgemeinem Browserverhalten, nicht für Suno geprüft).
- Datenschutz: Jeder Aufruf verbindet das Gerät mit einem US-Drittanbieter (IP-Adresse, ggf. Cookies/Tracking im Player – Inhalt **nicht belegt**). Für Schulklassen und Kinder wäre eine Einwilligung oder zumindest ein Klick-zum-Laden nötig; heute fließt nichts an Dritte.
- Abhängigkeit: Songs können von Suno gesperrt, gelöscht oder der Player geändert werden (Drittquelle weist darauf hin, siehe jackrighteous-Link). Es gibt eine eigene Hinweisreihe zu den Änderungen ab 3.9.2026.

## Vergleich

| Weg | Offline/PWA | Überblenden, Lautstärke | Datenschutz | Rechte/Lizenz | Aufwand | Risiko |
| --- | --- | --- | --- | --- | --- | --- |
| Suno-iframe je Stück | nein | nein (nicht belegt) | Drittverbindung | nur Sunos Zusagen, kein CC BY-SA | hoch, CSP öffnen | hoch |
| Hotlink auf Suno-CDN | nein | evtl. nicht (CORS) | Drittverbindung | Bedingungen unklar | niedrig | sehr hoch |
| Heute: Dateien im privaten Repo, eingebaut | ja, nach erstem Hören | ja | nichts an Dritte | Download als Abonnent, CC BY-SA | vorhanden | gering |
| Gestaffelt herunterladen (ca. 20 im Monat) | wie heute | wie heute | wie heute | wie heute | gering, nur Zeit | gering |
| Stücke vom eigenen Speicher nachladen (z. B. eigene Domain/Cloudflare R2 statt Einbau in den Build) | ja, mit Cache | ja | nur eigener Server | wie heute | mittel | gering |

## Empfehlung

Beim Herunterladen bleiben und gestaffelt arbeiten: Jeden Monat die Pro-Downloads (20) für die besten neuen Stücke nutzen; Stücke vorher in Suno vormerken oder per Playlist sammeln, dort aber nicht ohne Not verändern. Erst nach Qualitätswahl herunterladen, nicht auf Verdacht, denn jeder Download zählt, auch bei WAV (nicht nötig, MP3 genügt für das Projekt). Rechtlich vor einem größeren Ausbau klären, ob die Bedingungen die freie Lizenz CC BY-SA 4.0 für heruntergeladene Stücke tragen.

Vorteile: Offline-Betrieb, Überblenden und Lautstärke bleiben, keine Drittverbindung, keine Änderung an der CSP, kein Umbau. Nachteile: Das Wachstum der Bibliothek ist auf etwa 20 Stücke pro Monat begrenzt, und die Dateien belegen Platz im Klang-Repo und im Build.

Wächst die Bibliothek stark, ist der Zwischenweg „vom eigenen Speicher bei Bedarf nachladen“ der nächste Schritt: Die Stücke liegen nicht mehr im Build, sondern auf einem eigenen Speicher (nur Domain des Projekts in `media-src`), `MusicPlayer` lädt wie heute nur laufendes und nächstes Stück. Das bleibt eine Änderung an `klaenge.ts`, `vite.config.ts` und der CSP, nicht am Spielcode.

Einbetten von Suno nur als reiner Verweis („Mehr Musik auf Suno hören“, ein Link in der Tonseite `#/ton`) ist ohne Risiko möglich.

## Offene Fragen an Cornelius

1. Wie viele Stücke fehlen noch, und wie schnell sollen sie da sein? (Bei unter 40 reichen zwei Monate.)
2. Kennt Cornelius den Wortlaut der aktuellen Suno-Bedingungen (Abschnitt zu Rechten und freier Lizenz) und ist die Weitergabe unter CC BY-SA 4.0 damit gedeckt? Dann bitte kurz bestätigen oder die Lizenz anpassen.
3. Sind die Stücke in Suno auf „Public“ oder „Link“ gestellt? (Relevant, falls der Link-Weg gewünscht ist.)
4. Soll der Link auf Sunos Seite in die Tonseite aufgenommen werden?
5. Gibt es eine Möglichkeit, die Downloads zu erhöhen (Zusatzkauf, Premier) und ist das Geld wert?
6. Könnten die Hilfeseiten `suno.com/terms`, `help.suno.com/en/articles/13876865` und `13926209` von Cornelius selbst geprüft werden, da ich sie nicht abrufen konnte?
