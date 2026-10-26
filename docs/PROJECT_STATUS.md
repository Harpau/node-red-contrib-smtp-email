# Projektstand fuer neue Chats

Zuletzt bestaetigter Release-Stand: **26. Oktober 2026**.

Dieses Dokument bewahrt Entscheidungen und Pruefergebnisse. Es ersetzt keine
aktuelle Git-, Registry- oder Sicherheitspruefung. Zuerst den Arbeitsbaum,
`package.json` und [CHANGELOG.md](../CHANGELOG.md) lesen; neuere lokale Aenderungen
oder Commits koennen ueber diesen Release-Stand hinausgehen.

## Bestaetigte Veroeffentlichung

| Eintrag | Bestaetigter Wert |
| --- | --- |
| npm-Paket | `@compeso/node-red-contrib-smtp-email` |
| Release | `1.0.2`, auf npm als `latest` veroeffentlicht |
| GitHub | `Harpau/node-red-contrib-smtp-email`, Branch `main` |
| Release-Tag | `v1.0.2`, annotiert |
| Release-Commit | `397d98b5ad81096683d26ae4a932e0d73d1aba70` |
| Produktive Abhaengigkeit | Nodemailer `^10.2.1`; Lockfile: `10.2.1` |
| Mindestversionen | Node.js `>=22.0.0`, Node-RED `>=4.0.0` |
| Lizenz | MIT, Copyright 2026 Harald Paulus |
| Tarball | `compeso-node-red-contrib-smtp-email-1.0.2.tgz`, 12.845 Bytes, 11 Dateien |
| npm `dist.shasum` (SHA1) | `b250ea52f4955475cd47b39309f98366d5f65aad` |
| npm `dist.integrity` | `sha512-WFvjOYSjq9eRCb2XVMqsvp1/5hYnLZv8Mo8/f8MeXa3/IQ0NsqYwlXmb/h/gvfgtoO2al7VuDyj74UOhYGEuIw==` |

- [npm-Paket](https://www.npmjs.com/package/@compeso/node-red-contrib-smtp-email)
- [GitHub-Release v1.0.2](https://github.com/Harpau/node-red-contrib-smtp-email/releases/tag/v1.0.2)
- [Node-RED-Katalog](https://flows.nodered.org/node/@compeso/node-red-contrib-smtp-email)
- [Node-RED-Scorecard](https://flows.nodered.org/node/@compeso/node-red-contrib-smtp-email/scorecard)

Commit und Tag wurden am 25. Oktober 2026 gepusht, das Paket auf npm
veroeffentlicht und der GitHub-Release erst nach bestaetigtem npm-Erfolg aus dem
Entwurf freigeschaltet. Registry-`gitHead` entsprach dem Release-Commit. Das von
npm heruntergeladene Tarball war bytegleich mit dem getesteten Artefakt; es war
erst rund drei Minuten nach dem Publish herunterladbar, waehrend die
Registry-Metadaten bereits sichtbar waren.

Der Katalog-Refresh wurde am 26. Oktober 2026 nach Anmeldung auf der Paketseite
ausgeloest. Die Node-RED Flow Library zeigte anschliessend **1.0.2** als
Paketversion; die Scorecard-Seite nannte ebenfalls 1.0.2, als unterstuetzte
Node-RED-Versionen 4.1.17 und 5.0.9 und eine Abhaengigkeit. Alle angezeigten
Scorecard-Regeln einschliesslich **Dependencies use latest versions** trugen
einen gruenen Haken. Die Regel **P02 "Name matches repository"** erscheint
weiterhin rot; diese Pruefung ist in node-red-dev-cli deaktiviert und wird
deshalb fuer jedes Paket so angezeigt. Das ist kein Paketfehler und nicht zu
beheben.

Fuer diesen Release sind keine Veroeffentlichungsschritte mehr offen. Eine
spaetere Dokumentationsaenderung macht daraus keine erneute npm-Veroeffentlichung.
Ob der heutige Arbeitsbaum sauber oder mit GitHub synchron ist, immer mit Git
feststellen und nicht aus diesem Dokument ableiten.

## Warum es die Patchreleases gibt

Version 1.0.0 brachte die Verbindungspruefung beim Deploy, die MIT-Lizenz und die
ergaenzten Paketmetadaten. Der Anwender bestaetigte den Node-RED-Praxistest.

Version 1.0.1 (16. September 2026) hob die Abhaengigkeit von `nodemailer: ^9.1.1`
auf `^10.0.10`, weil der alte Bereich Nodemailer 10 ausschloss und die
Node-RED-Scorecard zu Recht vor einer veralteten Abhaengigkeit warnte. Eigener
Laufzeitcode wurde nicht geaendert.

Version 1.0.2 (25. Oktober 2026) reagiert auf drei am 23. Oktober 2026
veroeffentlichte Advisories mittlerer Schwere im Adress-Parser von Nodemailer
(GHSA-85x2-q946-cp5h, GHSA-m943-m63m-w62w, GHSA-8c8m-p3m8-cjg8; betroffen 3.0.0
bis 10.1.3, behoben ab 10.1.4). Speziell geformte Adressen in `to`, `cc` oder
`bcc` konnten zu einer Zustellung an eine Domain fuehren, die der Header nicht
nennt. Da Empfaengerfelder aus `msg`-Pfaden und damit aus Headern empfangener
Mails gelesen werden koennen, ist das fuer dieses Paket relevant. Das Lockfile
stand auf 10.0.10 und `npm audit` meldete die Advisories. 1.0.2 hob den Bereich
auf `^10.2.1` und das Lockfile auf 10.2.1; eigener Laufzeitcode wurde nicht
geaendert. Zusaetzlich erzeugt der Integrationstest fuer die Verbindungspruefung
vor den Tests einmal einen TLS Secure Context, weil das erstmalige Laden des
Zertifikatsspeichers (rund 0,8 Sekunden, unter paralleler Testlast bis 1,7
Sekunden) den TLS-Fehlertest gelegentlich in seinen 2-Sekunden-Timeout laufen
liess. Das aendert nichts am Paketinhalt.

Lehre aus beiden Patchreleases: `npm audit` **und** `npm outdated` regelmaessig
pruefen, nicht nur vor einem Release. Die Advisories erschienen fuenf Wochen nach
1.0.1; eine automatische Pruefung (CI, Dependabot) gibt es im Repository bisher
nicht.

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

## Nachgewiesene Tests fuer 1.0.2

Am 25. Oktober 2026 erfolgreich:

- `npm install`, `npm test`: **73 Tests**, einschliesslich fuenf Tests mit
  echtem Nodemailer gegen lokale SMTP-Testserver. Nach der Warm-up-Aenderung
  bestand die Gesamtsuite in sechs von sechs Laeufen; der TLS-Fehlertest
  benoetigt darin rund 4 Millisekunden statt zuvor bis zu 1,7 Sekunden.
- `npm run pack:check`: **11 Paketdateien**, einschliesslich LICENSE und
  CHANGELOG; keine Tests oder Entwicklungsdokumente im npm-Paket.
- `npm audit`: keine bekannten Sicherheitsluecken; `npm outdated`: leeres
  Ergebnis. Beides sind zeitabhaengige Ergebnisse.
- Gesonderter Test des finalen Tarballs unter **Node-RED 5.0.9**, **Node.js
  26.12.1** und **Nodemailer 10.2.1**: alle **13 Laufzeitszenarien** mit 80
  Einzelpruefungen bestanden. Alle elf installierten Paketdateien waren
  bytegleich mit dem Tarball. Zusaetzlich wurden Editor, Palette,
  Bearbeitungsdialog und Node-Hilfe im Browser geprueft; dabei wurde nichts
  deployt.

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

Die Szenarien liefen diesmal automatisiert: ein temporaerer Harness steuerte
Node-RED ueber die Admin-API (Full- und Modified-Nodes-Deploys mit
`Node-RED-Deployment-Type`) und las Status- und Debug-Ereignisse ueber den
Comms-Websocket, mit drei In-Process-SMTP-Fixtures (AUTH PLAIN mit
Teilablehnung, ohne AUTH, ohne Begruessung) und reinen Platzhalter-Zugangsdaten.
Zwei erste Laeufe scheiterten an Annahmen des Harness (Form der
`/nodes`-Antworten, zurueckbehaltene Status aus einer alten `flows.json`), nicht
am Paket. Der Harness ist **nicht versioniert und nicht Teil von `npm test`**;
die Liste ist ein dauerhafter Ergebnisnachweis und eine Vorlage fuer erneute
Tests, kein Versprechen eines vorhandenen Testkommandos. Temporaere Dateien oder
laufende Testdienste nicht voraussetzen; alle Testdienste wurden beendet.

Grenzen: Fuer 1.0.2 wurde Node-RED 5.0.9 unter Node.js 26 geprueft, nicht jede
erlaubte Node-RED- oder Node.js-Version; Node.js 22 und 24 standen lokal nicht
zur Verfuegung. Die Fixtures bieten kein STARTTLS; TLS wurde nur als
Protokollfehler gegen einen Klartext-Server geprueft. Fuer 1.0.1 war derselbe
Szenarienkatalog am 16. September 2026 unter Node-RED 5.0.7 und Node.js 22.14.0
bestanden worden.

## Orientierung im Repository

| Datei/Bereich | Zweck |
| --- | --- |
| `nodes/smtp-email-account.js` und `.html` | Account-Konfiguration und Node-RED-Credentials |
| `nodes/smtp-email-send.js` und `.html` | Versand, Statusprioritaet, Editor und Hilfe |
| `lib/mail-options.js` | Feldbasierte Send-Planung und Validierung |
| `lib/smtp-transport.js` | Transport, Verbindungspruefung, Timeouts und sichere Fehler |
| `test/` | Mit `npm test` reproduzierbare Tests; der Integrationstest erzeugt vorab einen TLS Secure Context |
| `examples/` | Importierbarer IMAP-Weiterleitungsflow mit Platzhaltern |
| [RELEASING.md](RELEASING.md) | Vorbereitung, Freigabe, Veroeffentlichung und Verifikation |

`docs/` und `AGENTS.md` sind Repository-Dokumentation und gehoeren gemaess
`package.json.files` nicht zum npm-Paket. Sie koennen ohne neue Paketversion
gepflegt werden. Nach kuenftigen Releases diesen Stand mit Datum, Commit,
Tests und tatsaechlich bestaetigtem Veroeffentlichungsstatus aktualisieren.
