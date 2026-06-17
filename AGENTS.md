# AGENTS.md

## Projektziel

Dieses Repository ist ein eigenstaendiges Node-RED npm-Paket fuer SMTP-basierten E-Mail-Versand.

## Paket

- GitHub-Repository: Harpau/node-red-contrib-smtp-email
- npm-Paketname: @compeso/node-red-contrib-smtp-email
- Internes Node-RED-Typpraefix: smtp-email
- Sichtbare Node-Namen:
  - smtp email account
  - smtp email send

## Zielarchitektur

Das Paket stellt einen SMTP-Send-Node fuer Node-RED bereit.

Der Versand erfolgt ueber SMTP. Empfang, IMAP-Zugriff und IMAP-Acknowledgement gehoeren nicht in dieses Paket.

Eine ueber `imap email in` empfangene Mail soll jedoch einfach ueber `smtp email send` weitergeleitet werden koennen. Dabei muss `msg.imap.ackToken` unveraendert erhalten bleiben, damit nach erfolgreichem Versand ein nachgeschalteter `imap email ack` Node die urspruengliche Mail loeschen, verschieben oder flaggen kann.

## Ziel-Nodes fuer die oeffentliche Version

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
- Versand von E-Mails aus msg-Feldern
- einfache Weiterleitung empfangener IMAP-Mails
- Durchreichen von `msg.imap.ackToken` ohne Veraenderung
- Ausgabe von Versandmetadaten in `msg.smtpEmail`

Eingabefelder:

- `msg.to`
- `msg.cc`
- `msg.bcc`
- `msg.from`
- `msg.replyTo`
- `msg.subject`
- `msg.payload`
- `msg.html`
- `msg.attachments`

Ausgabe bei Erfolg:

- urspruengliche `msg`
- unveraendertes `msg.imap`
- zusaetzliches `msg.smtpEmail` mit Versandinformationen

Empfohlene Ausgaenge:

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
- Die Entwicklungsfassung beginnt mit Version 0.1.0.
- Eine oeffentliche Version 1.0.0 erst nach erfolgreichem lokalen Node-RED-Test und Dokumentationspruefung vorbereiten.

## package.json-Regeln

- `package.json` name muss lauten: `@compeso/node-red-contrib-smtp-email`
- repository, homepage und bugs muessen auf `Harpau/node-red-contrib-smtp-email` zeigen, sofern nicht ausdruecklich anders vorgegeben.
- `package.json` muss eine gueltige `node-red`-Sektion enthalten.
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
- Erfolgspfad mit unveraendertem `msg.imap.ackToken`
- Fehlerpfad ohne versehentliches Ack
- Attachments
- CC, BCC und Reply-To
- keine Zugangsdaten in Fehlern oder Logs

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
- Keine Veroeffentlichung auf npm oder flows.nodered.org durchfuehren.
