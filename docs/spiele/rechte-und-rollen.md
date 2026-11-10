# Rechte und Rollen über Organisationen (#217)

Stand: 10.11.2026. Konzept zum Issue #217; Entscheidungen von Cornelius stehen in den Issue-Kommentaren. Es ist noch nichts gebaut. Grundlage ist #213: Die Liste `Capability` und `tournamentCapabilities` (`packages/online/src/capabilities.ts`) kennen Rechte, die Rollen sind aber fest verdrahtet (Raumleitung; im Turnier Leitung, Mitleitung, Helfer).

## 1. Entscheidungen

| Frage | Entscheidung |
|---|---|
| Woran hängt eine Rolle? | Am **Spielerpass** (Kennung aus dem Ausweis, `hello.token`), nicht an einem Gerät. Die Rolle zieht mit dem Pass um. |
| Wo gilt sie? | **Übergreifend** in einer **Organisation** (Verein, Schule, Klasse): für alle ihre Turniere, Räume und Serien. |
| Wie frei sind Rollen? | **Feste Bündel** (Vorlagen), keine freie Zusammenstellung einzelner Rechte. |
| Wie wird vergeben? | **Beides**: Einmal-Link/Code für Gäste und Neue, direkte Zuweisung an bekannte Mitglieder. |
| Wer legt Organisationen an? | **Auf Antrag**; der Betreiber (Cornelius) gibt frei. Der Antragsteller wird Betreiber seiner Organisation. |
| Geltung in der Organisation | **Alle Turniere der Organisation.** |
| Klassen | Eine Klasse ist ein **Sonderfall** einer Organisation (Lehrkraft = Betreiber, Schüler = Mitglieder). Klassen legen Lehrkräfte **ohne Antrag** an, solange sie intern bleiben. |
| Rollen je Person | **Mehrere** Rollen je Person und Organisation sind möglich; die Rechte sind die Vereinigung aller Rollen. |
| Rollen vergeben | Die **Leitung darf** (außer Leitung und Betreiber); der Betreiber kann es je Organisation abschalten. |
| Name und Größe | In der Oberfläche **„Verein oder Schule“**; höchstens **200 Mitglieder**, bei Klassen **40**. |

## 2. Begriffe

- **Organisation:** Eine benannte Gruppe mit Mitgliedern und Rollen. Hat einen Code (wie `ClassRoom`: 6 Emoji aus 16, weil sie lange lebt), einen Namen und eine Art (`verein`, `schule`, `klasse`).
- **Mitglied:** Eine Pass-Kennung in einer Organisation, mit einer oder mehreren Rollen.
- **Rolle:** Ein festes Bündel aus Rechten (`Capability`).
- **Recht:** Eine einzelne Fähigkeit (`kick`, `enterResult`, `entrants`, …), wie bisher.
- **Plattform-Betreiber:** Wer den `OPERATOR_KEY` hält. Er gibt Organisationen frei und kann sie sperren oder auflösen, ist aber kein Mitglied und sieht keine Spielinhalte.

## 3. Rollen (Bündel)

| Rolle | Rechte |
|---|---|
| **Betreiber** | alles, dazu Rollen vergeben und entziehen, Mitglieder verwalten, Organisation verwalten, Turniere löschen |
| **Leitung** | Turniere anlegen und leiten: `entrants`, `tools` (Zuschaulink, Helfer, Zeitplan, Serie), `enterResult`, `checkin`, `print`; nicht löschen, keine Rollen vergeben |
| **Schiedsrichter** | `enterResult`, `checkin` |
| **Tischhelfer** | `enterResult` an den eigenen Tischen (Feld/Tisch), `checkin`, `print` (wie der bisherige Helfer) |
| **Anmeldung** | `entrants` (eintragen, freigeben), `checkin`; keine Ergebnisse |
| **Protokoll** | `print` (Ansicht, Druck, Export); keine Änderungen |
| **Bildschirm** | nur Ansicht, kein Pass nötig (Beamer, Turniertafel, `#/turnier/<Code>/beamer`) |

Neue Fähigkeiten brauchen (dazu `leaderMayGrant` als Einstellung der Organisation):
- `manageRoles` (Rollen vergeben/entziehen, nur Betreiber),
- `manageMembers` (Mitglieder aufnehmen/entfernen, Betreiber, optional Leitung),
- `createTournament` (Turnier unter dem Namen der Organisation anlegen, Leitung und Betreiber),
- `ownFieldsOnly` (Einschränkung für Tischhelfer; Umsetzung siehe Abschnitt 8).

Zuordnung der bestehenden Rollen (Migration): Hauptleitung → Betreiber, Mitleitung → Leitung, Helfer → Tischhelfer. Solange ein Turnier keiner Organisation gehört, gilt wie bisher die Rolle aus dem Turnier selbst (Abschnitt 7).

## 4. Datenmodell

```
Organisation { code, name, kind, createdAt, status: 'pending' | 'active' | 'blocked' }
Mitglied     { org, passKey, roles: Rolle[], since, via: 'link' | 'direct', by }
Einladung    { org, role, code, expiresAt, attempts }          // Einmal-Link
Protokoll    { org, at, by, action, subject, role?, note? }    // nur Anfügen
Antrag       { code?, name, kind, requester: passKey, text, at, status }
```

- Der Server speichert die **Pass-Kennung** (nicht den Spielercode) mit der Rolle. Weder E-Mail noch Klarnamen: Mitglieder zeigen Spitzname, Bild und Wappen aus dem Pass, wie bei Klassen.
- **Mehrere Rollen je Person und Organisation.** Die Rechte sind die Vereinigung der Rollen (`can(roles, recht)`); es gibt keine Verschachtelung. Entzug und Protokoll gelten je Rolle. Hat jemand Betreiber, wirkt der Rest nur als Anzeige.
- **Turnier → Organisation:** `settings.org` (Code der Organisation) oder leer. Eine Serie gehört ebenfalls höchstens einer Organisation. Ein Raum hat die Raumleitung wie bisher; Organisationsrollen im Raum bleiben eine spätere Erweiterung.
- **Speicherung:** Ein Durable Object je Organisation (`OrgRoom`, Muster `ClassRoom`), in der EU. Anträge liegen in einem kleinen Verzeichnis-Objekt, das der Betreiber über `/betreiber/…` einsieht.

## 5. Ablauf

### 5.1 Antrag und Freigabe
1. Ein Pass-Inhaber stellt auf `#/organisationen` einen **Antrag** (Name, Art, kurzer Zweck).
2. Der Betreiber sieht die offenen Anträge auf `#/betreiber` (Betreiber-Schlüssel) und gibt frei oder lehnt ab. Das ist der einzige Eingriff der Plattform.
3. Nach der Freigabe entsteht die Organisation, der Antragsteller wird **Betreiber** und bekommt einen Hinweis beim nächsten Öffnen.
4. Klassen: Der Weg bleibt wie bei #150 (jeder Pass legt eine Klasse an, ohne Antrag). Eine Klasse ist eine Organisation der Art `klasse` mit der Beschränkung auf Schulzwecke; der Antrag entfällt dort, solange die Klasse keine Turniere mit Außenwirkung (öffentlicher Zuschaulink) anlegt. Offen: Genügt das, oder soll auch die Klasse einen Antrag brauchen? (Abschnitt 10)

### 5.2 Rollen vergeben
- **Einmal-Link/Code:** Betreiber oder Leitung (je nach Stufe, Abschnitt 6) erzeugt eine Einladung für eine Rolle. Link `#/org/<Code>?rolle=<Einladung>`. 24 Stunden gültig, fünf Fehlversuche, nach Einlösen verbraucht (Muster `LEADER_TRANSFER_*` aus #203). Der Link nennt die Rolle fest und wird nach dem Einlösen aus der Adresszeile genommen.
- **Direkt:** In der Mitgliederliste wählt die berechtigte Person ein Mitglied und eine Rolle. Das Mitglied sieht die Zuweisung beim nächsten Öffnen und kann **ablehnen**. Bis zur Annahme gilt die Rolle nicht.
- **Entzug:** Jederzeit durch den Betreiber (Leitung nur für niedrigere Rollen). Wer Mitglied ist, kann selbst austreten.
- **Protokoll:** Jede Änderung wird angefügt (wer, wann, was, Person, Rolle) und ist für Betreiber und Leitung einsehbar. Es enthält keine Klarnamen, nur das, was der Pass anzeigt.

### 5.3 Prüfung auf dem Server
Der Server prüft **bei jeder Nachricht**, ob die Kennung des Absenders in der zuständigen Organisation eine Rolle hat, die das Recht umfasst. Die Oberfläche fragt nur zur Anzeige `can(...)`, wie in #213. Ein Recht steht **nie** nur im Pass oder in der Oberfläche; der Pass liefert die Kennung, der Server kennt die Rolle.

## 6. Wer darf was vergeben

- **Betreiber:** alle Rollen, an alle.
- **Leitung:** Schiedsrichter, Tischhelfer, Anmeldung, Protokoll, Bildschirm; nicht Leitung oder Betreiber. Der Betreiber kann das je Organisation abschalten (`leaderMayGrant`, Standard ja).
- Alle anderen: nichts.

## 7. Zusammenspiel mit dem Bestehenden

- **Turniere ohne Organisation** laufen unverändert (Gerätekennung der Leitung, `leaderToken`, Helferlinks). Wird ein Turnier einer Organisation zugeordnet, wirken die Organisationsrollen zusätzlich: Ein Mitglied mit Rolle `Leitung` leitet jedes Turnier der Organisation, der Anleger bleibt Hauptleitung dieses Turniers.
- **Helferlinks** (`addHelper`) bleiben für Turniere ohne Organisation, in Organisationen ersetzt die Einladung sie (Helfer = Tischhelfer).
- **Serien (#205):** Eine Serie kann einer Organisation gehören; Serienleitung wird eine Rolle der Organisation, die Übergabe per Einmalcode bleibt für Serien ohne Organisation.
- **Betreiber-Schlüssel (`OPERATOR_KEY`):** bleibt der Plattform-Eingriff (löschen, sperren), bekommt aber `org` als weiteres Ziel (`DELETE /betreiber/org/<Code>`).
- **Klassen (#150–#152):** `ClassRoom` wird zur Organisation der Art `klasse` (Mitglieder, Warteliste, Leitung gibt es dort schon). Die Klassenleitung ist Betreiber, weitere Lehrkräfte sind `Leitung`, Schüler haben keine Rolle (nur Mitgliedschaft). Der Umbau ist ein eigener Schritt (Abschnitt 9), bis dahin laufen Klassen wie bisher.
- **Konto-Anmeldung (#154):** ein Konto ist ein weiterer Öffner des Passes; Rollen hängen am Pass und ändern sich dadurch nicht.
- **Tisch-Bildschirm und Turnier-Bildschirm (#100, #212):** Die Rolle `Bildschirm` ist ein Zuschaulink mit Zeichen „nur Ansicht“ und braucht keinen Pass.

## 8. Risiken und offene technische Punkte

- **Pass verloren oder weitergegeben:** Die Rolle hängt an der Kennung. Wer den Ausweis hat, hat die Rolle. Gegenmittel: Betreiber entzieht, Rolle wird neu vergeben; wichtige Rollen (Betreiber, Leitung) sollten mit PIN/Passkey gesichert sein, die Oberfläche weist darauf hin.
- **Betreiber verschwindet:** Jede Organisation braucht mindestens einen Betreiber; ein zweiter lässt sich ernennen, der letzte kann nicht austreten (nur Übergabe oder Auflösung). Der Plattform-Betreiber kann im Notfall einen neuen einsetzen (protokolliert).
- **Missbrauch bei Anträgen:** Begrenzung je Pass (ein offener Antrag), Name und Zweck werden gefiltert (`isBlockedText`); der Betreiber sieht nur Antragstext, keine Spielinhalte.
- **Datenschutz:** Mitglieder und Rollen sind personenbezogen (Pass-Kennung plus Spitzname). Die Datenschutzerklärung braucht einen Abschnitt „Organisationen“ (wie bei Klassen). Aufbewahrung: ein Jahr ohne Aktivität löscht die Organisation (wie `ClassRoom`), Protokoll nur so lange wie die Organisation.
- **`ownFieldsOnly` für Tischhelfer:** Ein Tischhelfer soll nur an den ihm zugewiesenen Tischen eintragen. Dafür muss die Leitung Tische zuweisen (`assignFields` kennt Felder, aber keine Personen). Erste Fassung: Tischhelfer dürfen wie bisher alle Ergebnisse eintragen; die Einschränkung folgt, wenn Tischzuweisung an Personen gebaut ist.
- **Mehrfach-Mitgliedschaft:** Eine Person kann in mehreren Organisationen sein, je Organisation mit mehreren Rollen. Die Oberfläche muss bei einem Turnier die zuständige Organisation anzeigen.

## 9. Umsetzung in Schritten (neue Issues nach Freigabe)

1. **Rechtekern:** `OrgRole`, Rollen-Bündel → `Capability`, reine Logik und Tests in `packages/online` (`org.ts`, `org-roles.ts`); `tournamentCapabilities` leitet aus Organisationsrolle ab, bisherige Rollen bleiben als Abbildung. Kein Server, keine Oberfläche.
2. **Organisation auf dem Server:** `OrgRoom` (Durable Object, Migration v11), Anlegen, Mitglieder, Einladungen, Protokoll, Zugriffsprüfung, Rauchtest.
3. **Antrag und Betreiberseite:** Anträge, Freigabe auf `#/betreiber`, `betreiber.mjs org`.
4. **Oberfläche:** `#/organisationen` (Antrag, eigene Organisationen), `#/org/<Code>` (Mitglieder, Rollen, Einladungen, Protokoll).
5. **Anbindung der Turniere:** `settings.org`, Prüfung auf dem Server, Anzeige der Rolle, Turnierseite.
6. **Serien und Räume:** Serien einer Organisation zuordnen; Rollen im Raum (optional).
7. **Klassen als Organisationen:** `ClassRoom` in das Modell überführen.
8. **Datenschutzerklärung und Hilfetexte.**

Reihenfolge: 1 → 2 → 3 → 4 → 5; 6 bis 8 danach, jeweils nach Cornelius' Review.

## 10. Entschiedene Fragen (10.11.2026)

1. **Klassen** brauchen keinen Antrag, solange sie intern bleiben (kein öffentlicher Zuschaulink); sonst gilt der Antragsweg.
2. **Mehrere Rollen** je Person sind möglich.
3. **Leitung darf Rollen vergeben**, abschaltbar durch den Betreiber.
4. **Obergrenze** 200 Mitglieder, bei Klassen 40.
5. **Name** in der Oberfläche: „Verein oder Schule“.

Noch offen: nichts am Konzept; als Nächstes die Freigabe der Umsetzungsschritte (Abschnitt 9) als eigene Issues.

## 11. Stand der Umsetzung

- **#226 Rechtekern** (10.11.2026): `packages/online/src/org-roles.ts` – sieben Rollen-Bündel, Vereinigung bei Mehrfachrollen (`orgCapabilities`), Vergaberegel (`canGrantRole`, `leaderMayGrant`), Abbildung der alten Rollen (`orgRoleOfLegacy`), `tournamentCapabilities` nimmt optional `orgRoles` hinzu.
- **#227 Organisation auf dem Server** (10.11.2026): Logik `packages/online/src/org.ts` (Code aus sechs Emoji, Mitglieder mit Rollen und angebotenen Rollen, Einmal-Einladungen mit 24 h und fünf Fehlversuchen, Annahme/Ablehnung, Entzug, Entfernen, Austritt, Protokoll mit 200 Einträgen, Obergrenze 200/40), Durable Object `OrgRoom` (Binding `ORGS`, **Wrangler-Migration v11**), `POST /org` (anlegen, **nur mit Betreiber-Schlüssel**, bis Antrag und Freigabe #228 folgen), `POST /org/<Code>` mit den Aktionen `view`, `redeem`, `invite`, `revokeInvite`, `offer`, `accept`, `decline`, `revoke`, `remove`, `leave`, `configure`, `update`, `dissolve`, `DELETE /betreiber/org/<Code>`. Sichten enthalten nie Kennungen oder Einladungs-Codes; Einladungen und Protokoll sehen nur Betreiber und Leitung. Rauchtest: `OPERATOR_KEY=… node apps/server/scripts/org.mjs` (Server mit `OPERATOR_KEY` in `apps/server/.dev.vars`).
- **#228 Antrag und Freigabe** (10.11.2026): Logik `packages/online/src/org-requests.ts` (ein offener Antrag je Pass, Name, Art und Zweck gefiltert, höchstens 200 offene, Entschiedenes nach 30 Tagen weg), Durable Object `OrgDesk` (ein Objekt, Binding `ORG_DESK`, ebenfalls **Migration v11**). Wege: `POST /org-antrag` (`submit`, `status`, für Antragsteller), `GET /betreiber/antraege`, `POST /betreiber/antrag/<Id>` (`approve`, `note`; bei Freigabe entsteht die Organisation, der Antragsteller wird Betreiber), `POST /betreiber/org-sperre/<Code>` (`blocked`), Löschen über `DELETE /betreiber/org/<Code>`. Gesperrte Organisationen haben keine Rechte und keine Einladungen. Oberfläche: Bereich „Anträge auf Organisationen“ und Sperren auf `#/betreiber`, Hinweis „freigegeben/abgelehnt“ auf `#/online` (`OrgRequestNotice`, nur wenn dieses Gerät einen Antrag gestellt hat). Das Formular zum Antragstellen kommt mit #229; `submitOrgRequest` (`lib/orgServer.ts`) ist vorbereitet. Rauchtest `org.mjs` deckt Antrag, Ablehnung, Freigabe, Sperren und Auflösen ab (43 Prüfungen).
- **#229 Oberfläche „Verein oder Schule“** (10.11.2026): `#/organisationen` (`Orgs`: meine Gruppen, Öffnen per Emoji-Code, Antrag stellen mit Name, Art und Zweck, Stand offener Anträge) und `#/org/<Code>` (`Org`, `?einladung=<Code>` füllt den Einladungscode vor): eigene Rollen mit Erklärung und Tipp zu PIN/Passkey, Angebote annehmen oder ablehnen, Mitgliederliste mit Rollen, Rolle anbieten, einzelne Rollen entziehen, Entfernen (Betreiber), Einladung erstellen (Rollen wählen, Code und QR einmalig, offene Einladungen zurückziehen), Einstellungen (Name, „Leitung darf Rollen vergeben“), Protokoll, Austreten. Bezeichnungen in `lib/orgLabels.ts`, Aufrufe in `lib/orgServer.ts` (`orgAct`, Merkliste `brett-und-blatt:organisationen`). Einstieg über die Schaltfläche „Verein oder Schule“ auf „Online Spiel“.
- **#230 Turniere einer Organisation zuordnen** (10.11.2026): `settings.org` (Code der Gruppe, beim Anlegen geprüft). Beim Anlegen über `POST /turniere` verlangt der Server das Recht `createTournament` in der Gruppe (sonst 403). Das Durable Object `TournamentRoom` fragt die Rollen je Kennung bei der Gruppe ab (`OrgRoom.rolesOf`, höchstens alle 15 Sekunden je Kennung, vor `hello`, vor jeder Nachricht und vor jedem Rundruf) und trägt sie mit `Tournament.setOrgRoles` ein; sie werden nicht gespeichert. Wirkung: Leitung und Betreiber der Gruppe sind im Turnier Leitung (`isLeader`), der Betreiber darf löschen (`mayDelete`), Schiedsrichter tragen Ergebnisse ein, die Rolle „Anmeldung“ trägt Teilnehmer ein, gibt frei und setzt Check-in; wer eine Rolle hat, sieht das Turnier (`maySee`). Ohne `settings.org` sind Rollen wirkungslos; Turniere ohne Netz (`LOKAL-…`) bleiben unberührt (beim Abgleich prüft der Server das Anlegerecht). Die Sicht trägt `orgRoles`; die Turnierseite zeigt die Rolle und fragt `can(…)` mit den Gruppenrollen, das Anlege-Formular bietet nur Gruppen an, in denen das Gerät Turniere anlegen darf. Rauchtest `org.mjs` (56 Prüfungen) und `packages/online/test/tournament-org.test.ts`.
- **#231 Serien einer Gruppe** (10.11.2026): `SeriesRecord.org` und `SeriesBook.setOrgRoles`; Leitung und Betreiber der Gruppe verwalten die Serie mit (`mayManage`: Umbenennen, Wertung, Turniere herausnehmen, neuer Zuordnungscode, Verlängern, Löschen). Anlegen unter einer Gruppe (`POST /serien` mit `org`) verlangt `createTournament` dort (403 sonst). Die Übergabe der Serienleitung per Einmalcode gibt es nur für Serien ohne Gruppe; bei einer Serie der Gruppe ändern Rollen der Gruppe die Leitung. `SeriesRoom` fragt die Rollen wie das Turnier ab (15 Sekunden gemerkt, nicht gespeichert). Das Formular „Serie anlegen“ bietet passende Gruppen an. **Räume (Entscheidung):** bleiben bei der Raumleitung (`roomCapabilities`); Organisationsrollen gelten im Raum nicht, weil ein Raum keine feste Gruppe hat und kurzlebig ist. Turnierpartien sind Räume des Turniers und folgen dessen Rollen nicht; ein Tisch-Bildschirm funktioniert dort wie bisher. Rauchtest `org.mjs` (63 Prüfungen), 3 neue Unit-Tests.
- **#232 Klassen im Rollenmodell** (10.11.2026, **Brücke statt Umbau**): Der Speicher von `ClassRoom` (Mitglieder, Klassenkarten, Warteliste, Klassenausweise mit Lehrkraft-Schloss) bleibt unverändert; eine Klasse nimmt über `classRoles` (`packages/online/src/classroom.ts`) am Rollenmodell teil: die dienstälteste Leitung gilt als **Betreiber**, weitere Leitungen als **Leitung**, Schüler haben keine Rolle. Ein Code, den keine Organisation kennt, gilt als Klassencode: `orgRolesOf` (Server) fragt erst `OrgRoom.rolesOf` (`null` = gibt es nicht), dann `ClassRoom.rolesOf`. Damit kann eine Klasse Turniere und Serien tragen (`settings.org` / `org` = Klassencode); Lehrkräfte leiten sie, Schüler sehen sie nur, wenn sie sonst Zutritt hätten. Klassen- und Organisationscodes haben dieselbe Form; beim Anlegen prüft jede Seite, dass der Code in der anderen nicht vergeben ist (`exists`). Das Formular „Turnier/Serie anlegen“ bietet Klassen an, die dieses Gerät leitet. **Bewusst nicht umgesetzt:** die Überführung des `ClassRoom`-Speichers in `OrgRoom` (Migration bestehender Klassen). Sie brächte nur Mehrfachrollen und Einladungslinks für Klassen, würde aber Klassenkarten, Klassenausweise und die Warteliste berühren; das Risiko für laufende Klassen steht in keinem Verhältnis. Entscheidung für Cornelius. Rauchtest `org.mjs` (69 Prüfungen), 1 neuer Unit-Test.
- **#233 Datenschutzerklärung und Hilfetexte** (10.11.2026): Neuer Absatz „Verein oder Schule (Organisationen)“ in `screens/Legal.tsx` (Daten, Zweck, Aufbewahrung ein Jahr bzw. 30 Tage für entschiedene Anträge, Rechte, Klassen als Gruppe), Stand der Erklärung „November 2026“. Hilfetexte zu den Rollen stehen auf der Gruppenseite (`ROLE_HELP` in `lib/orgLabels.ts`). **Wortlaut bitte rechtlich prüfen** (Cornelius).
