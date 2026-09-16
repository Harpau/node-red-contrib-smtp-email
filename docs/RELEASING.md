# Release-Leitfaden

Fuer `@compeso/node-red-contrib-smtp-email` im Repository
`Harpau/node-red-contrib-smtp-email`. Den zuletzt bestaetigten Release dokumentiert
[PROJECT_STATUS.md](PROJECT_STATUS.md); dieser Leitfaden ist kein Auftrag zur
Veroeffentlichung.

## 1. Ausgangslage und Umfang klaeren

```bash
git status --short --branch
git log -5 --oneline
git tag --list
npm view @compeso/node-red-contrib-smtp-email dist-tags versions --json --prefer-online
```

Lokale Aenderungen erhalten. GitHub-Stand vor einem Push abgleichen; nicht
erzwingen oder bestehende Tags verschieben. Paketversion, Lockfile und Changelog
muessen zusammenpassen. Eine bereits auf npm veroeffentlichte Version nicht
erneut verwenden.

Commit, Push auf `main`, Release-Tag, GitHub-Release, npm-Publish und
Node-RED-Katalogaktualisierung sind getrennte Schritte. Die ausdrueckliche
Benutzerfreigabe muss den ausgefuehrten Umfang abdecken. Eine bereits passende
Freigabe im aktuellen Auftrag beruecksichtigen; historische Freigaben fuer
1.0.0 oder 1.0.1 erlauben keine beliebigen kuenftigen Releases.

## 2. Abhaengigkeiten und Kompatibilitaet pruefen

```bash
npm outdated
npm view nodemailer dist-tags engines --json --prefer-online
npm audit
```

- `npm audit` prueft bekannte Sicherheitsluecken. Es bestaetigt nicht, dass alle
  Abhaengigkeiten aktuell sind.
- `npm outdated` zeigt `current`, `wanted` und `latest`. Insbesondere
  `wanted = current` bei neuerem `latest` beachten: der erlaubte Versionsbereich
  kann einen Major-Sprung ausschliessen. Bei gefundenen Updates liefert der
  Befehl einen von null verschiedenen Exitcode; anschliessende Pruefungen
  deshalb nicht versehentlich durch eine `&&`-Kette ueberspringen.
- Release Notes, Mindestversionen und API-Aenderungen vor Major-Updates lesen.
  Die Abhaengigkeit gezielt aktualisieren, Lockfile mitfuehren und testen;
  nicht nur fuer eine gruene Scorecard ungeprueft aktualisieren.
- Die [Scorecard-Regel D03](https://github.com/node-red/node-red-dev-cli/blob/main/docs/D03.md)
  warnt, wenn die neueste Abhaengigkeitsversion ausserhalb des deklarierten
  Bereichs liegt. `^9.1.1` erlaubt beispielsweise keine Version 10.x.

## 3. Release vorbereiten und validieren

1. Aenderungen umsetzen, Version in Paket und Lockfile gemeinsam erhoehen,
   Release Notes mit Datum im Changelog pflegen.
2. Pflichtpruefungen ausfuehren:

   ```bash
   npm install
   npm test
   npm audit
   npm run pack:check
   git diff --check
   ```

3. Mit `npm pack --json` das konkrete Artefakt erzeugen. Dateiliste, Version,
   Abhaengigkeiten und Pruefsumme kontrollieren. Nur die vorgesehenen
   Laufzeitdateien, Beispiele, README, CHANGELOG und LICENSE ausliefern.
4. Dieses Tarball in einer isolierten Node-RED-Umgebung mit lokalen
   SMTP-Testservern pruefen. Keine produktiven Flows, echten Zugangsdaten oder
   echten Empfaenger verwenden. Relevante Szenarien stehen in
   [PROJECT_STATUS.md](PROJECT_STATUS.md#nachgewiesene-tests-fuer-101).
   Runtime- und Node.js-Version sowie die tatsaechlich installierte
   Nodemailer-Version protokollieren. Testdienste anschliessend beenden.
5. Ergebnis und Grenzen festhalten. Historische Testergebnisse nicht als
   erneuten Test ausgeben. Vor Freigabe muessen Aenderungen und Artefakt konkret
   pruefbar sein.

## 4. Mit vorhandener Freigabe veroeffentlichen

- Gepruefte Dateien committen; einen annotierten Tag `v<version>` auf den
  Release-Commit setzen. Nur den beauftragten Branch und Tag pushen.
- Zugang zu GitHub und npm mit `gh auth status` und `npm whoami` pruefen.
  Keine Tokens oder Konfigurationsdateien mit Zugangsdaten ausgeben.
- Einen GitHub-Release-Entwurf mit den Release Notes vorbereiten. Bei `gh`
  mehrzeilige Texte ueber `--notes-file` uebergeben.
- Aus dem sauberen, geprueften Release-Checkout veroeffentlichen:

  ```bash
  npm publish --access public --tag latest --registry=https://registry.npmjs.org --browser=false
  ```

- npm kann trotz gueltiger Anmeldung eine gesonderte Zwei-Faktor-Bestaetigung
  fuer den Publish verlangen. Den aktuell vom CLI ausgegebenen Link an den
  Benutzer geben und den begonnenen Prozess weiterverfolgen. Passwoerter und
  Einmalcodes nicht im Chat oder in Dateien ablegen.
- Erst nach bestaetigtem npm-Erfolg den GitHub-Release freischalten. Bei
  Unterbrechung zuerst den bereits erreichten Zustand pruefen und nur die
  fehlenden Schritte fortsetzen.

### Falls ein npm-Bestaetigungslink nicht funktioniert

Zuerst die Ausgabe des gestarteten Publish-Prozesses und die Registry pruefen:

```bash
npm view @compeso/node-red-contrib-smtp-email dist-tags versions --json --prefer-online
```

Beim Release 1.0.1 war der Publish bereits erfolgreich abgeschlossen, als der
Benutzer den Link als nicht mehr funktionierend meldete. Die genauen Gruende
fuer die Ungueltigkeit des Links wurden nicht ermittelt; eine weitere
Bestaetigung war nicht noetig. Deshalb nicht aus einem unbrauchbaren Link auf
einen fehlgeschlagenen Publish schliessen. Nach Erfolg kann npm noch kurze Zeit
zur Verarbeitung benoetigen. Erneut abfragen, bevor irgendein Publish
wiederholt wird. Nur wenn die Version fehlt und der vorherige Versuch sicher
beendet/fehlgeschlagen ist, einen neuen Versuch mit neuem Link starten.
Kurzlebige Anmeldelinks und CLI-Sitzungsnummern nicht dauerhaft dokumentieren.

## 5. Veroeffentlichtes Paket und Katalog verifizieren

- Die konkrete Version auf npm frisch abfragen: Abhaengigkeiten, `gitHead`,
  `dist.shasum`, `dist.integrity` und `dist.tarball`. `latest` muss auf die
  beauftragte Version zeigen. Release-Tag, Release-Commit und Registry-`gitHead`
  abgleichen.
- Das veroeffentlichte Tarball herunterladen und mit dem getesteten lokalen
  Artefakt vergleichen. Erfolg des Upload-Kommandos allein ersetzt diese
  Pruefung nicht.
- Auf der [Paketseite der Node-RED Flow Library](https://flows.nodered.org/node/@compeso/node-red-contrib-smtp-email)
  anmelden und **check for update** betaetigen. Die Katalogaktualisierung ist
  ein eigener Schritt nach npm-Publish; siehe
  [Node-RED Packaging](https://nodered.org/docs/creating-nodes/packaging#adding-to-flowsnoderedorg).
- Die angezeigte Paketversion kontrollieren und die
  [Scorecard](https://flows.nodered.org/node/@compeso/node-red-contrib-smtp-email/scorecard)
  oeffnen. Insbesondere **Dependencies use latest versions** am tatsaechlichen
  Symbol der Regel pruefen. Ein erfolgreicher Katalog-Refresh allein beweist
  keine bestandene Scorecard-Pruefung.
- Abschliessend Git-Status pruefen und [PROJECT_STATUS.md](PROJECT_STATUS.md)
  mit Datum, Artefakt/Commit, Testergebnissen und tatsaechlichem Release-Status
  aktualisieren. Noch offene Schritte ausdruecklich nennen.

## Reine Repository-Dokumentation

`AGENTS.md` und `docs/` stehen nicht in `package.json.files`. Aenderungen nur in
diesen Dateien brauchen keinen Versionssprung und keinen neuen npm-Release.
Sie muessen separat in Git gesichert werden, damit auch andere Checkouts den
Stand erhalten. Links aus diesen Dateien duerfen repository-relativ sein;
Links aus der ausgelieferten README auf nicht mitgelieferte Dokumente sollten
vollstaendige GitHub-URLs verwenden.
