# Backup und Wiederherstellung

## Umfang

`npm run backup:production -- --output <verzeichnis>` erstellt einen
Produktions-Backup außerhalb des Repositorys:

- `database.sql`: vollständiger D1-Export von `brandycards-production`;
- `r2/`: alle tatsächlich in R2 gespeicherten, in D1 referenzierten Uploads
  (`products/` und `card-submissions/`);
- `manifest.json`: Zeitpunkt, Tabellen-Zählwerte, SHA-256-Prüfsummen und
  Objektliste.

Die eBay-Bilder werden nicht in R2 gespeichert. Ihre `ebay/...`-Schlüssel und
die externen Bild-URLs werden deshalb im Manifest als `externalAssets`
festgehalten; die URLs stehen außerdem im D1-Export. Ein Backup-Job darf diese
URLs nicht als fehlende R2-Objekte behandeln.

Der Export enthält personenbezogene Daten und Zahlungs-/Bestellinformationen.
Das Verzeichnis muss geschützt, verschlüsselt und nach der vorgesehenen
Aufbewahrungsfrist gelöscht werden. Es darf nicht in Git, ein öffentliches
Verzeichnis oder ein unverschlüsseltes Cloud-Laufwerk gelangen.

## Lokaler Restore-Test

Der Restore ist absichtlich lokal und akzeptiert kein `--remote`:

```text
npm run restore:backup -- <backup-verzeichnis>
```

Der Ablauf importiert die Tabellen und Daten in ein isoliertes lokales D1-
Binding, vergleicht die Tabellen-Zählwerte mit dem Manifest und prüft bei
vorhandenen R2-Objekten den SHA-256-Wert nach einem lokalen Put/Get-Zyklus.
Die temporäre lokale Persistenz kann mit `BRANDYCARDS_RESTORE_STATE` in ein
explizites Verzeichnis gelegt werden. `--allow-missing` ist nur für einen
ausdrücklich partiellen Test gedacht; ein Backup mit `missingObjects` gilt
nicht als vollständiger Restore-Nachweis.

Ein Produktions-Restore wird nicht automatisiert. Cloudflare D1 Time Travel
ist als zusätzliche kurzfristige Rückfallebene aktiv; ein Time-Travel-Restore
überschreibt die Datenbank und darf daher nur nach Betreiberfreigabe erfolgen.
Für eine dauerhafte, unabhängige Kopie bleibt der exportierte D1-/R2-Backup-
Ablauf maßgeblich.

## Betrieb

Der Backup-Befehl ist ein reproduzierbarer Betreiberlauf, noch kein automatisch
eingeplanter Cloud-Job. Vor einer Automatisierung sind Ziel, Verschlüsselung,
Zugriffstoken, Aufbewahrung und Alarmierung festzulegen. Für R2 besteht aktuell
nur die Lifecycle-Regel zum Abbruch alter Multipart-Uploads; sie ersetzt keine
Backup-Kopie. Die Bereinigung verwaister R2-Uploads ist davon getrennt und darf
keine referenzierten Objekte löschen.

Technische Grundlagen:

- [Cloudflare D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/)
- [Cloudflare D1 Export und Import](https://developers.cloudflare.com/d1/best-practices/import-export-data/)
- [Cloudflare Workflow: D1 nach R2 sichern](https://developers.cloudflare.com/workflows/examples/backup-d1/)
- [Cloudflare R2 Object Lifecycles](https://developers.cloudflare.com/r2/buckets/object-lifecycles/)
