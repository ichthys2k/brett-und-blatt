# Web Push für „Du bist dran“ – Konzept (#206, 9.11.2026)

Stand: **nur Konzept, nichts gebaut.** Cornelius entscheidet nach diesem Text, ob und wie es weitergeht. Rechtliches (Datenschutzerklärung, Einwilligung) ist hier nur skizziert und nicht juristisch geprüft.

## Ausgangslage

Heute gibt es Hinweise nur bei offener Seite im Hintergrund (Web Notifications, z. B. Go-Fernpartien und Turnierpartien). Sobald der Browser-Tab geschlossen oder die App vom Betriebssystem beendet ist, kommt nichts an. Bei Fernpartien über Tage und Turnieren mit Fristen ist das die größte Lücke.

## Funktionsumfang (Vorschlag)

Ereignisse, für jeweils den betroffenen Menschen, nur auf Wunsch:

| Ereignis | Wer | Wann |
|---|---|---|
| Du bist dran (Fernpartie, Go, Schach über Tage) | Spieler am Zug | wenn der Zug fällig wird, nicht bei jedem Zug einer schnellen Partie (nur wenn niemand verbunden ist) |
| Deine Turnierpartie ist angesetzt / startet | Beide Seiten | beim Aufruf; Erinnerung kurz vor Fristende |
| Frist läuft bald ab | Wer noch fehlt | z. B. 2 Stunden vor Ablauf |
| Turnier hat begonnen / ist zu Ende | Teilnehmer | einmalig |

Nicht Teil des Vorschlags: Werbung, Chat-Inhalte, Sammelhinweise „Es gibt neue Spiele“. Je Nachricht nur ein kurzer Text ohne Namen Dritter („Du bist am Zug in deiner Partie“), damit auf dem Sperrbildschirm nichts Verräterisches steht.

## Technischer Ablauf

1. **Schlüssel:** Ein VAPID-Schlüsselpaar (ES256). Der private Schlüssel liegt als Wrangler-Secret (`VAPID_PRIVATE_KEY`), der öffentliche steht im Build (`VITE_VAPID_PUBLIC_KEY`). Nie ins Repo.
2. **Abonnement:** Auf Wunsch (Knopf „Hinweise aufs Gerät“) fragt die App die Berechtigung an und ruft `registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })`. Ergebnis: Endpunkt-URL des Push-Dienstes des Browsers plus zwei Schlüssel (`p256dh`, `auth`).
3. **Speicherung:** Das Abonnement geht per WebSocket-Nachricht an den Raum bzw. das Turnier (Durable Object), gebunden an die Geräte-Kennung (`token`) und dort nur, solange die Partie bzw. das Turnier läuft. Es gehört in den Speicher des jeweiligen Objekts, nicht in eine globale Tabelle; wird das Objekt gelöscht, ist auch das Abonnement weg.
4. **Versand:** Fällt ein Ereignis an (Zug fällig, Aufruf, Frist), sendet das Durable Object aus seinem bestehenden Wecker (`alarm`) eine Web-Push-Anfrage (RFC 8030/8291, verschlüsselter Inhalt, VAPID-Kopf) an den Endpunkt. Cloudflare Workers können das mit der Web-Crypto-API selbst; eine kleine Bibliothek (z. B. `web-push`-kompatibel für Workers) oder eigener Code von etwa 150 Zeilen genügt. Antwortet der Push-Dienst mit 404/410, wird das Abonnement gelöscht.
5. **Anzeige:** Der Service Worker der PWA (`generateSW` bisher; für Push wäre auf `injectManifest` oder ein ergänzendes Skript umzustellen) zeigt die Nachricht (`push`-Ereignis) und öffnet beim Antippen `#/raum/<Code>` oder `#/turnier/<Code>` (`notificationclick`).
6. **Widerruf:** Knopf „Hinweise ausschalten“ ruft `unsubscribe()` und löscht das Abonnement im Objekt. Wer in den Browser-Einstellungen widerruft, wird beim nächsten Versand durch 410 bereinigt.

## Grenzen je Plattform

- **Android (Chrome, Edge, Firefox):** Funktioniert im Browser und als installierte PWA. Spar-Modi der Hersteller können Hinweise verzögern.
- **iOS/iPadOS (ab 16.4):** Nur für Web-Apps, die **zum Home-Bildschirm hinzugefügt** wurden; im normalen Safari-Tab nicht. Die Berechtigung muss durch eine Nutzeraktion angefragt werden. Dies muss die Oberfläche erklären.
- **Desktop (Chrome, Edge, Firefox, Safari):** Funktioniert, solange der Browser läuft (Chrome/Edge können im Hintergrund laufen).
- **Zuverlässigkeit:** Push ist ein Hinweis, keine Zustellgarantie. Spielregeln dürfen nie davon abhängen, dass ein Hinweis ankam.

## Aufwand und Betriebskosten

- **Entwicklung (Schätzung):** Schlüssel und Secret anlegen, Abonnement-Verwaltung im Raum und im Turnier (mit Tests), Versand mit Verschlüsselung, Service-Worker-Umbau, Einstellungsseite, Hinweise für iOS, Datenschutztext. Etwa 3–5 Arbeitstage mit Tests; der Service-Worker-Umbau ist das Risiko (Updates der PWA, #175).
- **Betrieb:** Der Versand sind kleine ausgehende Anfragen aus dem bestehenden Durable-Object-Wecker. Bei den heutigen Zahlen (wenige Dutzend Hinweise am Tag) bleibt es im Gratis-Kontingent (100 000 Anfragen/Tag für Workers, Subrequests je Aufruf begrenzt). Bei einem Turnier mit 128 Teilnehmern und Fristhinweisen fallen einige hundert Anfragen an. Die Push-Dienste von Google/Apple/Mozilla sind kostenlos.

## Datenschutz (nicht rechtlich geprüft)

- **Gespeichert würde:** Endpunkt-URL, zwei Schlüssel und die Geräte-Kennung je Abonnement, dazu ein Zeitstempel. Die Endpunkt-URL ist ein Pseudonym beim jeweiligen Push-Dienst (Google, Apple, Mozilla, Microsoft); darüber läuft die Zustellung, also eine **Übermittlung an diese Dienste** (Drittland-Thema, daher Eintrag in der Datenschutzerklärung).
- **Dauer:** Bis zum Ende bzw. Löschen der Partie oder des Turniers, spätestens mit Widerruf oder Fehlerantwort 404/410 des Push-Dienstes.
- **Opt-in:** Nur auf ausdrücklichen Knopfdruck, nie beim Seitenaufruf. Der Browser fragt zusätzlich selbst.
- **Widerruf:** Jederzeit in der App und im Browser.
- **Inhalt der Hinweise:** keine Namen Dritter, keine Spielinhalte.
- **Nötig:** Ergänzung der Datenschutzerklärung (Zweck, Empfänger, Dauer, Widerruf) und ein Satz in „Hilfe“. Die Einwilligung ist freiwillig und für das Spielen nicht erforderlich.

## Empfehlung und Alternativen

| Weg | Vorteil | Nachteil |
|---|---|---|
| **A) Web Push (dieses Konzept)** | Hinweis auch bei geschlossener App, kein Konto, keine E-Mail | Aufwand, Service-Worker-Umbau, iOS nur als installierte App, Datenschutztext |
| **B) Erinnerungslink per E-Mail** | Funktioniert überall | Wir bräuchten E-Mail-Adressen und einen Versanddienst, schlechter Datenschutz, widerspricht „ohne Konto“ |
| **C) Kalenderdatei (.ics) mit Fristen** | Keine Schlüssel, keine Speicherung, Hinweis durch das Handy | Nur feste Termine (Fristen, Turnierabend), kein „Du bist dran“ |
| **D) Nur offene Seite (heute)** | Nichts zu tun | Kein Hinweis bei geschlossener Seite |

**Empfehlung:** Erst **C** für Termine (billig, ohne Datenspeicherung), und **A** nur für Fernpartien und Turnierfristen, **wenn** der Bedarf bleibt – in kleinem Umfang (nur „Du bist dran“ bei Fernpartien und „Frist läuft ab“), auf Wunsch und mit Abonnement im jeweiligen Objekt. B nicht.

## Offene Fragen an Cornelius

1. Soll es Web Push überhaupt geben, oder reicht zunächst C (Kalenderdatei)?
2. Wenn Push: nur Fernpartien und Turnierfristen, oder auch normale Online-Räume?
3. Ist der Umbau des Service Workers (`injectManifest`) in Ordnung, auch wenn er die PWA-Aktualisierung (#175) anfasst?
4. Wer prüft die Datenschutzerklärung rechtlich?
