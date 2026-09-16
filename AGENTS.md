# AGENTS.md

## Einstieg fuer neue Chats

- Zuerst [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) lesen: bestaetigter Release-Stand, Entscheidungen, Testnachweise und deren Grenzen.
- Vor Release-Arbeiten [docs/RELEASING.md](docs/RELEASING.md) lesen.
- Danach `git status --short --branch`, `git log -5 --oneline`, `package.json` und `CHANGELOG.md` pruefen. Lokale Aenderungen nicht ueberschreiben.
- Der dokumentierte Release-Stand ist eine datierte Momentaufnahme. Aktuelle npm-Versionen, Sicherheitsmeldungen und GitHub-Zustaende bei Bedarf neu abfragen.
- README.md beschreibt das oeffentliche Verhalten; diese Datei beschreibt die Arbeitsregeln. Abgeschlossene Releases und die historische Roadmap sind keine offenen Aufgaben.

## Projektziel

Dieses Repository ist ein eigenstaendiges Node-RED npm-Paket fuer SMTP-basierten E-Mail-Versand.

## Paket

- GitHub-Repository: Harpau/node-red-contrib-smtp-email
- npm-Paketname: @compeso/node-red-contrib-smtp-email
- Internes Node-RED-Typpraefix: smtp-email
- Sichtbare Node-Namen:
  - smtp email account
  - smtp email send

## Architektur

Das Paket stellt einen SMTP-Send-Node fuer Node-RED bereit.

Der Versand erfolgt ueber SMTP. Empfang, IMAP-Zugriff und IMAP-Acknowledgement gehoeren nicht in dieses Paket.

Eine ueber `imap email in` empfangene Mail soll jedoch einfach ueber `smtp email send` weitergeleitet werden koennen. Dabei muss `msg.imap.ackToken` unveraendert erhalten bleiben, damit nach erfolgreichem Versand ein nachgeschalteter `imap email ack` Node die urspruengliche Mail loeschen, verschieben oder flaggen kann.

## Oeffentliche Nodes

### smtp-email account

Interner Node-RED-Typ:

- smtp-email account

Sichtbarer Name:

- smtp email account

Zweck:

- gemeinsame SMTP-Kontokonfiguration
- Host, Port, TLS, Zertifikatspruefung, Benutzername, Passwort
- Default-Absenderadresse
- optionale spaetere OAuth2-Erweiterung

### smtp-email send

Interner Node-RED-Typ:

- smtp-email send

Sichtbarer Name:

- smtp email send

Zweck:

- extern getriggerter SMTP-Send-Node
- Versand von E-Mails aus konfigurierbaren msg-Feldern oder festen Strings
- einfache Weiterleitung empfangener IMAP-Mails
- Durchreichen von `msg.imap.ackToken` ohne Veraenderung
- Ausgabe von Versandmetadaten in `msg.smtpEmail`

Feldkonfiguration:

Der Node verwendet keinen globalen Message-Mode. Fuer jedes zu sendende E-Mail-Feld waehlt der Nutzer stattdessen eine Quelle:

- `msg`: Wert aus einem `msg`-Pfad lesen
- `str`: festen String verwenden

Konfigurierbare E-Mail-Felder:

- `to`
- `cc`
- `bcc`
- `from`
- `replyTo`
- `subject`
- `text`
- `html`
- `attachments`

Standardbelegung:

- `to`: `str`, leer
- `cc`: `str`, leer
- `bcc`: `str`, leer
- `from`: `str`, leer
- `replyTo`: `msg.email.header.reply-to`
- `subject`: `msg.email.topic`
- `text`: `msg.email.text`
- `html`: `msg.email.html`
- `attachments`: `msg.email.attachments`

Die Standardbelegung fuer Inhalt, Betreff, Reply-To und Attachments entspricht der dokumentierten Ausgabe von `imap email in`. Empfaengerfelder bleiben bewusst leer, damit nicht versehentlich an urspruengliche Empfaenger weitergesendet wird. Der Nutzer setzt den neuen Empfaenger zum Beispiel als festen String oder konfiguriert einen passenden `msg`-Pfad.

Wenn `from` leer bleibt, wird die Default-Absenderadresse des SMTP-Accounts verwendet.

`attachments` darf per `msg`-Pfad auf ein Array zeigen. Ein nicht-leerer fester String ist fuer Attachments nicht zulaessig und muss mit einer klaren Fehlermeldung abbrechen.

Falls die empfangene Message keine ausreichend strukturierte Mail fuer die konfigurierte Feldbelegung enthaelt, muss der Node mit einer klaren Fehlermeldung abbrechen.

Ausgabe bei Erfolg:

- urspruengliche `msg`
- unveraendertes `msg.imap`
- zusaetzliches `msg.smtpEmail` mit Versandinformationen

Ausgaenge:

- Ausgang 1: Versand erfolgreich
- Ausgang 2: Versand fehlgeschlagen

## Zusammenspiel mit imap email

Dieses Paket darf keine direkte Laufzeitabhaengigkeit vom IMAP-Paket haben.

Die Integration erfolgt ausschliesslich ueber die Message-Struktur:

- `msg.imap` gehoert dem IMAP-Paket
- `msg.imap.ackToken` darf nicht veraendert werden
- `msg.smtpEmail` gehoert dem SMTP-Paket

Empfohlener Flow:

```text
imap email in -> smtp email send -> imap email ack
```

Bei erfolgreichem Versand wird die Message an Ausgang 1 weitergegeben. Dadurch kann ein nachgeschalteter `imap email ack` Node die urspruengliche Mail abschliessen.

Bei fehlgeschlagenem Versand darf die Message nicht versehentlich an den Ack-Pfad weitergegeben werden.

## Nicht-Ziele

- Kein IMAP-Empfang in diesem Paket.
- Kein Loeschen, Verschieben oder Flaggen von IMAP-Mails in diesem Paket.
- Keine direkte Abhaengigkeit vom Paket `@compeso/node-red-contrib-imap-email`.
- Keine Speicherung echter Zugangsdaten, Tokens oder privater Endpunkte in Tests, Beispielen oder Dokumentation.
- Kein npm publish ohne ausdrueckliche menschliche Freigabe.
- Keine Veroeffentlichung auf flows.nodered.org ohne ausdrueckliche menschliche Freigabe.

## Versions- und Kompatibilitaetsregeln

- Node.js-Mindestversion: >=22.0.0
- Node-RED-Mindestversion: >=4.0.0
- Die Erstimplementierung und der Wechsel auf eine stabile 1.x-Version sind abgeschlossen; den zuletzt bestaetigten Stand nennt docs/PROJECT_STATUS.md.
- Vor neuen oeffentlichen Releases lokale Tests, einen passenden Node-RED-Praxistest und die Dokumentation pruefen; siehe docs/RELEASING.md.
- Versionen in package.json und package-lock.json muessen uebereinstimmen. Bereits veroeffentlichte Versionen und Release-Tags nicht ueberschreiben.

## package.json-Regeln

- `package.json` name muss lauten: `@compeso/node-red-contrib-smtp-email`
- repository, homepage und bugs muessen auf `Harpau/node-red-contrib-smtp-email` zeigen, sofern nicht ausdruecklich anders vorgegeben.
- `package.json` muss eine gueltige `node-red`-Sektion enthalten.
- `node-red.version` muss die Node-RED-Mindestversion ebenso deklarieren wie `engines.node-red`.
- Alle Eintraege in `node-red.nodes` muessen auf existierende JavaScript-Dateien zeigen.
- Alle Node-RED-Typen in package.json, JavaScript und HTML muessen konsistent sein.
- `publishConfig.access` darf `public` bleiben.

## Node-RED-Regeln

- `RED.nodes.registerType(...)` darf nur die oeffentlichen Typen dieses Pakets verwenden.
- HTML-Dateien muessen dieselben Typnamen verwenden wie die passenden JavaScript-Dateien.
- `data-template-name`, `data-help-name` und `RED.nodes.registerType(...)` muessen konsistent sein.
- Palette-Labels duerfen benutzerfreundlich `smtp email account` und `smtp email send` heissen.
- Interne Typen sollen `smtp-email account` und `smtp-email send` heissen.
- Beispiel-Flows gehoeren in `examples`.
- README.md muss Installation, Konfiguration, Beispiel-Flows, Delivery-Semantik, Weiterleitung aus IMAP-Flows und Grenzen dokumentieren.

## Message- und Flow-Regeln

- `smtp email send` darf `msg.imap` nicht entfernen oder ueberschreiben.
- `smtp email send` darf `msg.imap.ackToken` nicht veraendern.
- Versandmetadaten des SMTP-Pakets gehoeren unter `msg.smtpEmail`.
- Der Node darf bestehende Nutzdaten nur dort veraendern, wo es fuer die dokumentierte Feldkonfiguration erforderlich ist.
- Die Feldkonfiguration muss so gestaltet sein, dass `imap email in -> smtp email send -> imap email ack` ohne zusaetzliche Glue-Logik moeglich ist, sobald ein neuer Empfaenger konfiguriert wurde.
- Bei erfolgreichem Versand wird die urspruengliche Message an Ausgang 1 weitergegeben.
- Bei fehlgeschlagenem Versand wird die Message an Ausgang 2 weitergegeben oder per Node-RED-Fehlerbehandlung gemeldet.
- Der Fehlerpfad darf nicht versehentlich einen nachgeschalteten `imap email ack` Node triggern.

## Sicherheitsregeln

- Zugangsdaten duerfen nur als Node-RED-Credentials gespeichert werden.
- Zugangsdaten, Tokens und private Endpunkte duerfen nicht in Tests, Beispielen, Dokumentation oder Logs stehen.
- Fehlermeldungen muessen so formuliert sein, dass keine SMTP-Zugangsdaten offengelegt werden.
- Beispiele muessen Platzhalter-Domains und Platzhalter-Adressen verwenden.

## Testregeln

Vor jedem groesseren Abschluss ausfuehren:

```bash
npm install
npm test
npm run pack:check
```

Wenn `npm run pack:check` nicht verfuegbar ist:

```bash
npm pack --dry-run
```

Tests muessen insbesondere abdecken:

- package.json-Metadaten
- Node-RED-Registry
- Laden aller Node-Dateien
- Konsistenz zwischen package.json, JS und HTML
- Beispiele im examples-Ordner
- Send-Planung ohne echte SMTP-Zugangsdaten
- feldbasierte Konfiguration ohne globale Message-Modes
- Erfolgspfad mit unveraendertem `msg.imap.ackToken`
- Fehlerpfad ohne versehentliches Ack
- Attachments
- CC, BCC und Reply-To
- keine Zugangsdaten in Fehlern oder Logs

## Abgeschlossene Entwicklung

- Die urspruengliche Roadmap ist umgesetzt: Paketmetadaten, Registry, Account-Credentials, feldbasierte Send-Planung, SMTP-Versand, getrennte Ausgaenge, Tests, Beispiel-Flow und README sind vorhanden.
- Die SMTP-Pruefung beim Start/Deploy und die Versandzaehler sind implementiert. Die in README.md dokumentierte Status-Prioritaet und die Fehlerbehandlung bei Aenderungen erhalten.
- Teilweise Empfaengerannahme ist bewusst ein Versandserfolg; ein nachgeschalteter IMAP-Ack darf damit ausgeloest werden. Nicht ohne neuen Auftrag in einen Fehler umdeuten.
- Weitere Arbeit richtet sich nach dem aktuellen Benutzerauftrag. OAuth2 und andere Nicht-Ziele sind keine automatisch abzuarbeitende Fortsetzung.

## Arbeitsweise fuer Codex

- Zuerst analysieren.
- Dann planen.
- Erst danach aendern.
- Grosse Aufgaben in kleine, reviewbare Aenderungen aufteilen.
- Vor riskanten Aenderungen erklaeren, welche Dateien betroffen sind.
- Nach Aenderungen immer liefern:
  - geaenderte Dateien
  - technische Wirkung
  - Testergebnis
  - offene Risiken
  - empfohlener naechster Commit
- Keine neuen produktiven Abhaengigkeiten hinzufuegen, ohne vorher den Grund zu erklaeren.
- Commit, Push, Release-Tag, GitHub-Release, npm-Publish und Katalogaktualisierung nur im jeweils beauftragten Umfang durchfuehren. Vorhandene ausdrueckliche Freigaben im aktuellen Auftrag beruecksichtigen; dokumentierte Freigaben abgeschlossener Releases sind keine pauschale Freigabe fuer neue Releases.
