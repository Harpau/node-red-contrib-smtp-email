# Projektstand fuer neue Chats

Zuletzt bestaetigter Release-Stand: **16. September 2026**.

Dieses Dokument bewahrt Entscheidungen und Pruefergebnisse. Es ersetzt keine
aktuelle Git-, Registry- oder Sicherheitspruefung. Zuerst den Arbeitsbaum,
`package.json` und [CHANGELOG.md](../CHANGELOG.md) lesen; neuere lokale Aenderungen
oder Commits koennen ueber diesen Release-Stand hinausgehen.

## Bestaetigte Veroeffentlichung

| Eintrag | Bestaetigter Wert |
| --- | --- |
| npm-Paket | `@compeso/node-red-contrib-smtp-email` |
| Release | `1.0.1`, auf npm als `latest` veroeffentlicht |
| GitHub | `Harpau/node-red-contrib-smtp-email`, Branch `main` |
| Release-Tag | `v1.0.1` |
| Release-Commit | `8d27a7ea5010ac8e5792baebc4f570eeecdb9202` |
| Produktive Abhaengigkeit | Nodemailer `^10.0.10`; Lockfile: `10.0.10` |
| Mindestversionen | Node.js `>=22.0.0`, Node-RED `>=4.0.0` |
| Lizenz | MIT, Copyright 2026 Harald Paulus |
| Tarball | `compeso-node-red-contrib-smtp-email-1.0.1.tgz`, 12.604 Bytes, 11 Dateien |
| npm `dist.shasum` (SHA1) | `6c0f1449d73dc11188541a57f1e6ccae0eeda8a4` |

- [npm-Paket](https://www.npmjs.com/package/@compeso/node-red-contrib-smtp-email)
- [GitHub-Release v1.0.1](https://github.com/Harpau/node-red-contrib-smtp-email/releases/tag/v1.0.1)
- [Node-RED-Katalog](https://flows.nodered.org/node/@compeso/node-red-contrib-smtp-email)
- [Node-RED-Scorecard](https://flows.nodered.org/node/@compeso/node-red-contrib-smtp-email/scorecard)

Commit und Tag wurden gepusht, der GitHub-Release freigeschaltet und der
Node-RED-Katalog auf 1.0.1 aktualisiert. Das von npm heruntergeladene Paket war
bytegleich mit dem getesteten Artefakt; Registry-`gitHead` entsprach dem
Release-Commit. Die Scorecard-Pruefung **Dependencies use latest versions**
zeigte anschliessend einen gruenen Haken. Diese Aussage betrifft diese einzelne
Pruefung, nicht pauschal alle Scorecard-Regeln.

Fuer diesen Release sind keine Veroeffentlichungsschritte mehr offen. Eine
spaetere Dokumentationsaenderung macht daraus keine erneute npm-Veroeffentlichung.
Ob der heutige Arbeitsbaum sauber oder mit GitHub synchron ist, immer mit Git
feststellen und nicht aus diesem Dokument ableiten.

## Warum es den Patchrelease gibt

Version 1.0.0 brachte die Verbindungspruefung beim Deploy, die MIT-Lizenz und die
ergaenzten Paketmetadaten. Der Anwender bestaetigte den Node-RED-Praxistest.

Die in 1.0.0 enthaltene Abhaengigkeit `nodemailer: ^9.1.1` schloss Nodemailer 10
aus. Version 10.0.10 war bereits vor dem Release verfuegbar. Obwohl `npm audit`
keine bekannten Sicherheitsluecken meldete, warnte die Node-RED-Scorecard deshalb
zu Recht vor einer veralteten Abhaengigkeit. Version 1.0.1 aktualisierte
`package.json`, `package-lock.json` und den Changelog; eigener Laufzeitcode wurde
dabei nicht geaendert. Fuer kuenftige Releases **auch `npm outdated` pruefen**.

## Bewusst festgelegtes Verhalten

Die vollstaendige Benutzerdokumentation steht in [README.md](../README.md).
Bei weiteren Aenderungen besonders erhalten:

- Nur SMTP-Versand; keine IMAP-Laufzeitabhaengigkeit. `msg.imap` und sein
  `ackToken` bleiben unveraendert. Versandmetadaten gehoeren unter `msg.smtpEmail`.
- Erfolgreicher Versand geht an Ausgang 1, Fehler an Ausgang 2. Akzeptiert SMTP
  nur einen Teil der Empfaenger und Nodemailer meldet Erfolg, ist dies bewusst
  ein Erfolg. Ein nachgeschalteter IMAP-Ack kann dadurch die Originalmail
  abschliessen; abgelehnte Empfaenger stehen in `msg.smtpEmail.rejected`.
- Jeder gestartete Send-Node prueft seinen Account ohne E-Mail-Versand. Ein
  partieller Deploy prueft nur neu gestartete Instanzen. Gleichzeitige Pruefungen
  desselben Account-Objekts werden geteilt, spaetere Starts pruefen erneut.
- `connected` bezeichnet den letzten erfolgreichen Test, keine dauerhafte
  Verbindung und keine Zustellgarantie. Konfigurierte Zugangsdaten erfordern
  erfolgreiche Authentifizierung, auch wenn der Server AUTH nicht anbietet.
  Ohne Zugangsdaten sind Relays ohne Anmeldung unterstuetzt.
- Die Statuswartezeit betraegt maximal 15 Sekunden; separate Netzwerk-Timeouts
  betragen 10 Sekunden. `close()` beendet eine laufende Nodemailer-Pruefung
  nicht garantiert sofort. Auch ein bereits als Timeout gemeldeter Versuch
  bleibt geteilt, bis die eigentliche Operation endet.
- Pruefungen erzeugen keine Ausgangsnachrichten und aendern keine Versandzaehler.
  Ein fehlgeschlagener Test blockiert spaetere Sendversuche nicht. Nach der
  ersten Eingangsnachricht hat der Versandstatus Vorrang; spaete Testergebnisse
  und Ergebnisse geschlossener Instanzen werden ignoriert.
- Credentials bleiben Node-RED-Credentials. Verbindungsstatus verwendet feste
  Fehlerkategorien; keine rohen SMTP-Fehler oder Zugangsdaten anzeigen.

## Nachgewiesene Tests fuer 1.0.1

Am 16. September 2026 erfolgreich:

- `npm install`, `npm test`: **73 Tests**, einschliesslich fuenf Tests mit
  echtem Nodemailer gegen lokale SMTP-Testserver.
- `npm run pack:check`: **11 Paketdateien**, einschliesslich LICENSE und
  CHANGELOG; keine Tests oder Entwicklungsdokumente im npm-Paket.
- `npm audit`: keine bekannten Sicherheitsluecken; `npm outdated`: leeres
  Ergebnis. Beides sind zeitabhaengige Ergebnisse.
- Gesonderter Test des finalen Tarballs unter **Node-RED 5.0.7**, **Node.js
  22.14.0** und **Nodemailer 10.0.10**: alle **13 Laufzeitszenarien** bestanden.
  Alle elf installierten Paketdateien waren bytegleich mit dem Tarball.

Die 13 Szenarien waren:

1. Start mit zwei Send-Nodes: gemeinsame authentifizierte Pruefung, keine Mail
   und keine Ausgangsnachricht.
2. Editor, Templates, Hilfe und registrierte Paketversion laden korrekt.
3. Full Deploy: beide Send-Nodes pruefen erneut ueber einen geteilten Versuch.
4. Modified-Nodes Deploy: nur die geaenderte Send-Instanz startet neu.
5. Nur Passwort aendern: beide Nutzer des Accounts starten neu und melden
   `auth failed` bei ungueltigem Passwort.
6. Passwort korrigieren: beide Nodes erreichen wieder `connected`.
7. Echter SMTP-Versand mit Teilannahme, CC/BCC/Reply-To, Text/HTML und Attachment:
   Ausgang 1, korrekte Metadaten und unveraenderter IMAP-Ack-Token.
8. Alle Empfaenger abgelehnt: ausschliesslich Ausgang 2, Ack-Token erhalten.
9. Server ohne AUTH: konfigurierte Zugangsdaten erfordern dennoch Anmeldung.
10. Relay ohne konfigurierte Zugangsdaten: Pruefung gelingt ohne AUTH.
11. TLS-Protokollfehler: sicherer Status `TLS error`.
12. Ausbleibende Serverbegruessung: begrenzter Versuch mit Status `timeout`.
13. Rueckkehr zu `connected`; ausgelesener Flow, Status und Runtime-Logs geben
    keine Zugangsdaten preis.

Diese 13 Szenarien wurden mit einem separaten temporaeren Testaufbau ausgefuehrt.
Der Harness ist **nicht versioniert und nicht Teil von `npm test`**. Die Liste
ist ein dauerhafter Ergebnisnachweis und eine Vorlage fuer erneute Tests, kein
Versprechen eines vorhandenen Testkommandos. Temporaere Dateien oder laufende
Testdienste nicht voraussetzen; alle Testdienste wurden beendet. Fuer 1.0.1
wurde damit Node-RED 5.0.7 geprueft, nicht jede erlaubte Node-RED-Version.

## Orientierung im Repository

| Datei/Bereich | Zweck |
| --- | --- |
| `nodes/smtp-email-account.js` und `.html` | Account-Konfiguration und Node-RED-Credentials |
| `nodes/smtp-email-send.js` und `.html` | Versand, Statusprioritaet, Editor und Hilfe |
| `lib/mail-options.js` | Feldbasierte Send-Planung und Validierung |
| `lib/smtp-transport.js` | Transport, Verbindungspruefung, Timeouts und sichere Fehler |
| `test/` | Mit `npm test` reproduzierbare Tests |
| `examples/` | Importierbarer IMAP-Weiterleitungsflow mit Platzhaltern |
| [RELEASING.md](RELEASING.md) | Vorbereitung, Freigabe, Veroeffentlichung und Verifikation |

`docs/` und `AGENTS.md` sind Repository-Dokumentation und gehoeren gemaess
`package.json.files` nicht zum npm-Paket. Sie koennen ohne neue Paketversion
gepflegt werden. Nach kuenftigen Releases diesen Stand mit Datum, Commit,
Tests und tatsaechlich bestaetigtem Veroeffentlichungsstatus aktualisieren.
