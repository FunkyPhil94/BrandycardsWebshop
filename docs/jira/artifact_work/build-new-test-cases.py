# -*- coding: utf-8 -*-
"""Erzeugt docs/jira/new-test-cases.csv — story-spezifische Testfälle.

Anders als die 333 abgelösten Fälle hat hier jeder Test eigene Schritte. Wenn
zwei Tests denselben Ablauf hätten, wäre einer davon überflüssig; das prüft der
Selbsttest am Ende.
"""
import csv, os, sys, hashlib

# (Nr, Story-Code, Titel, Bereich, Schritte, Erwartet, Warum-wichtig)
T = [
(1,"E2-01","Katalogsuche findet eine bekannte Karte","Katalog",
 ["Shop öffnen und /karten aufrufen.",
  "Im Suchfeld den Namen eines Spielers eingeben, der im Bestand ist.",
  "Trefferzahl über dem Raster ablesen.",
  "Suchbegriff auf eine Zeichenfolge ändern, die nicht vorkommt."],
 "Die Trefferliste enthält die gesuchte Karte, die Trefferzahl passt zur Anzahl der Kacheln, und der unsinnige Begriff führt zu einer verständlichen Leermeldung statt zu einer leeren Seite.",
 "Findet ein Kunde seine Karte nicht, kauft er sie nicht."),

(2,"E2-06","Preisfilter grenzt den Bestand korrekt ein","Katalog",
 ["/karten aufrufen und die Gesamttrefferzahl notieren.",
  "„Preis ab“ auf einen Wert oberhalb der günstigsten Karte setzen.",
  "„Preis bis“ zusätzlich auf einen Wert unterhalb der teuersten Karte setzen.",
  "Beide Felder leeren."],
 "Die Trefferzahl sinkt bei jeder Eingrenzung, keine angezeigte Karte liegt außerhalb der Spanne, und nach dem Leeren steht wieder die Ausgangszahl da.",
 "Ein falsch filternder Katalog versteckt verkäufliche Ware."),

(3,"E2-09","Blättern behält Filter und springt an den Rasteranfang","Katalog",
 ["/karten aufrufen und einen Suchbegriff mit mehr als einer Seite Treffer eingeben.",
  "Seitengröße auf den kleinsten Wert stellen.",
  "Auf „Weiter“ klicken.",
  "Auf „Zurück“ klicken."],
 "Der Suchbegriff bleibt über beide Klicks erhalten, die Ergebnisanzeige nennt den passenden Bereich, und die Ansicht steht jeweils am Anfang des Rasters statt am Seitenfuß.",
 "Verliert das Blättern den Filter, ist der Katalog ab 296 Karten unbenutzbar."),

(4,"E2-10","Produktdetail zeigt Preis, Zustand und Verfügbarkeit","Katalog",
 ["Aus dem Raster eine verfügbare Karte öffnen.",
  "Titel, Preis, Beschreibung und Bilder mit der Kachel vergleichen.",
  "Das Hauptbild anklicken und die Vergrößerung mit Escape schließen.",
  "Über den Zurück-Weg des Browsers ins Raster zurückkehren."],
 "Detailseite und Kachel zeigen denselben Preis und Titel, die Vergrößerung öffnet und schließt sauber, und das Raster steht nach dem Zurück an der vorherigen Stelle.",
 "Die Detailseite ist der letzte Schritt vor dem Warenkorb."),

(5,"E3-01","Einzelstück lässt sich nur einmal in den Warenkorb legen","Warenkorb",
 ["Eine verfügbare Karte öffnen und in den Warenkorb legen.",
  "Die Beschriftung der Schaltfläche prüfen.",
  "Erneut auf die Schaltfläche klicken.",
  "Zum Warenkorb wechseln und die Menge prüfen."],
 "Nach dem ersten Klick wechselt die Schaltfläche in den Zustand „im Warenkorb“, ein zweiter Klick erzeugt keine zweite Position, und der Warenkorb führt die Karte genau einmal.",
 "Jede Karte ist ein Unikat. Eine Menge größer eins wäre ein Versprechen, das der Bestand nicht hält."),

(6,"E3-05","Nicht mehr verfügbare Karte wird vor der Zahlung erkannt","Warenkorb",
 ["Eine verfügbare Karte in den Warenkorb legen.",
  "Die Karte im Adminbereich auf INACTIVE setzen oder ihren Bestand auf null bringen.",
  "Im Shop den Checkout aufrufen.",
  "Den Kauf fortsetzen wollen."],
 "Der Checkout weist die Karte als nicht mehr verfügbar aus und lässt die Zahlung nicht zu; es entsteht keine Bestellung.",
 "Das ist die Bremse gegen den Doppelverkauf. Sie muss vor dem Geld greifen, nicht danach."),

(7,"E3-04","Zwischensumme, Versand und Gesamtsumme stimmen überein","Warenkorb",
 ["Zwei Karten unterschiedlichen Preises in den Warenkorb legen.",
  "Checkout aufrufen und die Zwischensumme nachrechnen.",
  "Versandkosten und Gesamtsumme ablesen.",
  "Eine Karte entfernen und erneut nachrechnen."],
 "Die Zwischensumme entspricht der Summe der Einzelpreise, die Gesamtsumme entspricht Zwischensumme plus Versand, und beide Werte aktualisieren sich nach dem Entfernen korrekt.",
 "Eine falsche Summe ist entweder Verlust oder ein Rechtsproblem."),

(8,"E3-07","Gastbestellung läuft ohne Konto bis zur Zahlung durch","Checkout",
 ["Abgemeldet eine Karte in den Warenkorb legen.",
  "Checkout aufrufen und die vollständige Lieferadresse eingeben.",
  "Die Bestellübersicht mit dem Warenkorb vergleichen.",
  "Auf „Mit PayPal fortfahren“ klicken."],
 "Der Checkout verlangt zu keinem Zeitpunkt ein Konto, die Übersicht stimmt mit dem Warenkorb überein, und die Weiterleitung zu PayPal erfolgt mit dem angezeigten Betrag.",
 "Der Kaufzwang zum Konto hat den Shop schon einmal blockiert."),

(9,"E3-12","Unvollständige Adresse wird am Feld erklärt","Checkout",
 ["Checkout mit gefülltem Warenkorb aufrufen.",
  "Pflichtfelder der Adresse leer lassen und absenden.",
  "Eine offensichtlich ungültige Postleitzahl eintragen und erneut absenden.",
  "Die Adresse korrekt vervollständigen."],
 "Jeder Fehler wird an seinem Feld benannt, es entsteht keine halbfertige Bestellung, und nach der Korrektur geht es ohne Neuladen weiter.",
 "Formularfehler ohne Erklärung sind ein häufiger Abbruchgrund."),

(10,"E4-01","Echte PayPal-Zahlung führt zu bezahlter Bestellung","Zahlung",
 ["Gastbestellung bis zur Weiterleitung zu PayPal durchführen.",
  "Bei PayPal mit einem echten Konto bezahlen.",
  "Die Rückkehr in den Shop abwarten.",
  "Bestellnummer notieren und im Adminbereich nachsehen.",
  "Das Postfach der angegebenen Adresse prüfen."],
 "Der Shop zeigt die Bestellbestätigung mit Bestellnummer, die Bestellung steht im Adminbereich auf PAID, und die Bestätigungsmail ist zugestellt.",
 "Der vollständige Geldweg. Nur ein echter Durchlauf belegt ihn."),

(11,"E4-03","Abbruch bei PayPal hinterlässt keine Bestellung","Zahlung",
 ["Bestellung bis zur PayPal-Seite führen.",
  "Dort abbrechen statt zu bezahlen.",
  "Die Rückkehrseite im Shop lesen.",
  "Adminbereich auf neue Bestellungen prüfen und die Karte erneut aufrufen."],
 "Der Shop erklärt den Abbruch verständlich, es entsteht keine Bestellung, und die Karte ist wieder frei kaufbar.",
 "Ein Abbruch, der die Karte blockiert, kostet den nächsten Verkauf."),

(12,"E4-08","Doppelte Zahlungsbestätigung erzeugt keine zweite Bestellung","Zahlung",
 ["Eine Bestellung erfolgreich bezahlen.",
  "Die Zahlungsbestätigung von PayPal ein zweites Mal an den Shop zustellen lassen.",
  "Bestellliste im Adminbereich prüfen.",
  "Bestand der gekauften Karte prüfen."],
 "Es existiert genau eine Bestellung, der Bestand wurde genau einmal verringert, und die zweite Zustellung bleibt folgenlos.",
 "Zahlungsdienste stellen mehrfach zu. Ohne Idempotenz entstehen Geisterbestellungen."),

(13,"E4-04","Reservierung hält die Karte während des Checkouts","Bestand",
 ["Karte in den Warenkorb legen und den Checkout beginnen.",
  "In einem zweiten Browser dieselbe Karte aufrufen.",
  "Dort versuchen, sie in den Warenkorb zu legen.",
  "Den ersten Checkout abbrechen und die Freigabefrist abwarten.",
  "Im zweiten Browser erneut versuchen."],
 "Während der Reservierung ist die Karte im zweiten Browser nicht kaufbar; nach Abbruch und Ablauf der Frist ist sie es wieder.",
 "Zwei Kunden, eine Karte — das ist der teuerste Fehler im Shop."),

(14,"E1-11","eBay-Abgleich aktualisiert Bestand und isoliert Fehler","eBay",
 ["Im Adminbereich einen Abgleich starten.",
  "Laufstatus und Ergebnis abwarten.",
  "Eine auf eBay beendete Karte im Shop nachschlagen.",
  "Die Ereignisliste des Laufs auf gemeldete Fehler durchsehen."],
 "Der Lauf endet mit einem Ergebnis statt hängen zu bleiben, beendete Karten sind im Shop nicht mehr kaufbar, und einzelne fehlerhafte Datensätze haben den restlichen Lauf nicht gestoppt.",
 "Ein stillschweigend veralteter Bestand ist gefährlicher als ein langsamer."),

(15,"E7-12","Fehlgeschlagener eBay-Auftrag ist sichtbar und wiederholbar","eBay",
 ["Adminbereich öffnen und die Auftragsliste (Outbox) aufrufen.",
  "Einen fehlgeschlagenen oder wartenden Auftrag heraussuchen.",
  "Fehlerursache und Zeitpunkt lesen.",
  "Den Auftrag erneut ausführen lassen."],
 "Fehlgeschlagene Aufträge sind mit Ursache sichtbar, der erneute Lauf ist ohne Datenbankzugriff auslösbar, und das Ergebnis wird zurückgemeldet.",
 "Ohne diese Ansicht bleibt nur der Datenbankzugriff von Hand."),

(16,"E7-09","Preisvorschlag: drei Versuche je Karte","Verhandlung",
 ["Als angemeldeter Kunde eine Karte öffnen und einen Preis vorschlagen.",
  "Den Vorschlag zweimal wiederholen.",
  "Einen vierten Vorschlag versuchen.",
  "Eine andere Karte öffnen und dort vorschlagen."],
 "Drei Vorschläge werden angenommen, der vierte wird mit Begründung abgewiesen, und bei einer anderen Karte beginnt die Zählung von vorn.",
 "Die Verhandlung ist das Alleinstellungsmerkmal des Shops und nirgends automatisiert geprüft."),

(17,"E7-09","Angenommener Preis gilt 48 Stunden und erscheint im Checkout","Verhandlung",
 ["Als Admin einen offenen Preisvorschlag annehmen.",
  "Als betroffener Kunde die Karte öffnen.",
  "Die Karte in den Warenkorb legen und den Checkout aufrufen.",
  "Betrag im Checkout mit dem angenommenen Preis vergleichen."],
 "Der Checkout rechnet mit dem angenommenen Preis statt mit dem Listenpreis, weist die Ersparnis aus, und der Hinweis auf den ausgehandelten Preis ist sichtbar.",
 "Ein angenommener Preis, der im Checkout nicht ankommt, ist ein gebrochenes Versprechen."),

(18,"E7-01","Adminbereich verlangt Anmeldung mit zweitem Faktor","Admin",
 ["Adminbereich mit einem Konto ohne Adminrechte aufrufen.",
  "Adminbereich abgemeldet aufrufen.",
  "Mit Adminkonto ohne zweiten Faktor anmelden.",
  "Zweiten Faktor abschließen und erneut aufrufen."],
 "Alle drei ersten Wege werden abgewiesen, ohne Daten preiszugeben; erst nach dem zweiten Faktor erscheint der Adminbereich.",
 "Der Adminbereich sieht Bestellungen, Kundendaten und den ganzen Bestand."),

(19,"E1-01","Karte von Hand einstellen erscheint im Shop","Admin",
 ["Im Adminbereich „Karte von Hand einstellen“ öffnen.",
  "Titel, Beschreibung und mindestens ein Bild angeben und speichern.",
  "Den Shop-Katalog aufrufen und nach der Karte suchen.",
  "Die Detailseite der neuen Karte öffnen."],
 "Die Karte ist nach dem Speichern im Katalog auffindbar, das hochgeladene Bild wird angezeigt, und die Detailseite zeigt die eingegebenen Daten.",
 "Der Weg für Vorverkaufs- und Lagerkarten außerhalb von eBay."),

(20,"E1-10","Sichtbarkeit umschalten wirkt sofort im Shop","Admin",
 ["Eine im Shop sichtbare Karte im Adminbereich auf INACTIVE setzen.",
  "Den Katalog neu laden und nach der Karte suchen.",
  "Die Detailseite der Karte direkt über ihre Adresse aufrufen.",
  "Die Karte wieder auf ACTIVE setzen und erneut suchen."],
 "Die inaktive Karte verschwindet aus Suche und Raster und ist auch über den direkten Aufruf nicht kaufbar; nach dem Zurückschalten ist sie wieder da.",
 "Eine Karte muss sich sofort aus dem Verkauf nehmen lassen."),

(21,"E4-10","Bestellung auf Versendet setzen zeigt die Sendungsnummer","Admin",
 ["Eine bezahlte Bestellung im Adminbereich öffnen.",
  "Versanddienst und Sendungsnummer eintragen und auf Versendet setzen.",
  "Die Bestellliste neu laden.",
  "Als betroffener Kunde die Bestellhistorie im Konto aufrufen."],
 "Der Status steht im Adminbereich und im Kundenkonto auf versendet, die Sendungsnummer ist beim Kunden sichtbar und der Sendungsverfolgungslink führt zum richtigen Dienst.",
 "Ohne Sendungsnummer kommen die Nachfragen per Mail."),

(22,"E4-12","Storno und Erstattung setzen Bestellung und Bestand zurück","Admin",
 ["Eine bezahlte Bestellung im Adminbereich öffnen.",
  "Die Erstattung auslösen.",
  "Bestellstatus und PayPal-Vorgang prüfen.",
  "Bestand und Kaufbarkeit der betroffenen Karte prüfen."],
 "Die Bestellung ist als erstattet gekennzeichnet, die Rückzahlung ist bei PayPal sichtbar, und die Karte ist entweder wieder kaufbar oder bewusst gesperrt — in jedem Fall nachvollziehbar.",
 "Erstattungen passieren unter Zeitdruck und müssen auf Anhieb stimmen."),

(23,"E5-01","Registrierung mit Bestätigungsmail führt zum nutzbaren Konto","Konto",
 ["Konto mit einer echten, noch nicht verwendeten Adresse registrieren.",
  "Das Postfach öffnen und den Bestätigungslink prüfen.",
  "Den Link aufrufen.",
  "Anmelden und das Profil öffnen."],
 "Die Bestätigungsmail kommt an, ihr Link zeigt auf die Produktionsadresse und nicht auf localhost, und nach der Bestätigung ist die Anmeldung möglich.",
 "Genau dieser Link zeigte einmal auf localhost und hat den Shop verkaufsunfähig gemacht."),

(24,"E5-04","Passwort zurücksetzen funktioniert über den echten Link","Konto",
 ["Auf der Kontoseite „Passwort vergessen?“ wählen und die Adresse angeben.",
  "Die Mail abwarten und den Link aufrufen.",
  "Ein neues Passwort setzen.",
  "Mit dem neuen Passwort anmelden, mit dem alten einen Versuch machen."],
 "Der Link führt in den Shop und nicht auf localhost, das neue Passwort funktioniert, und das alte wird abgewiesen.",
 "Ein kaputter Reset sperrt Kunden dauerhaft aus."),

(25,"E5-07","Bestellhistorie zeigt Status und Sendungsnummer","Konto",
 ["Mit einem Konto anmelden, das mindestens eine Bestellung hat.",
  "Die Bestellhistorie öffnen.",
  "Bestellnummer, Betrag und Status mit dem Adminbereich vergleichen.",
  "Eine versendete Bestellung auf die Sendungsnummer prüfen."],
 "Alle Bestellungen des Kontos sind aufgeführt, Beträge und Status stimmen mit dem Adminbereich überein, und Fremdbestellungen erscheinen nicht.",
 "Falsche oder fremde Bestellungen im Konto sind ein Datenschutzvorfall."),

(26,"E5-10","Datenauskunft und Kontolöschung funktionieren","Konto",
 ["Angemeldet die Datenauskunft herunterladen.",
  "Die Datei öffnen und auf Vollständigkeit und Klartext-Geheimnisse prüfen.",
  "Die Kontolöschung mit dem geforderten Bestätigungswort auslösen.",
  "Anmeldung mit den alten Zugangsdaten versuchen.",
  "Im Adminbereich prüfen, was von den Bestellungen bleibt."],
 "Die Auskunft enthält die Kontodaten ohne Passwörter oder Tokens, die Anmeldung ist danach nicht mehr möglich, und Bestellungen bleiben als Rechnungsbelege erhalten.",
 "Beides ist gesetzlich geschuldet und wird bei einer Beschwerde geprüft."),

(27,"E6-01","Eingereichte Verkaufskarte erreicht den Adminbereich","Anbieter",
 ["Die Seite /verkaufen öffnen.",
  "Titel, Preiswunsch, Nachricht und E-Mail ausfüllen und Bilder anhängen.",
  "Absenden und die Bestätigung auf der Seite lesen.",
  "Im Adminbereich die Einreichungen öffnen und die Bilder anzeigen."],
 "Die Einreichung erscheint im Adminbereich mit allen Angaben, die Bilder sind dort ansehbar, und die einreichende Person erhält eine Rückmeldung.",
 "Der Ankauf ist die Nachschubquelle des Shops."),

(28,"E8-06","Kaufweg funktioniert auf dem Smartphone","Oberfläche",
 ["Browserfenster auf 390 x 844 CSS-Pixel stellen.",
  "Katalog öffnen, suchen und eine Karte öffnen.",
  "Karte in den Warenkorb legen und den Checkout aufrufen.",
  "Adressformular ausfüllen bis zur PayPal-Schaltfläche."],
 "Kein Element läuft über den Rand, alle Schaltflächen sind ohne Zoom bedienbar, und der Weg bis zur Zahlung ist vollständig durchführbar.",
 "Der größere Teil der Käufer kommt vom Telefon."),

(29,"E8-06","Kaufweg funktioniert auf sehr breiten Bildschirmen","Oberfläche",
 ["Browserfenster auf 3440 x 1440 CSS-Pixel stellen.",
  "Startseite, Katalog und eine Detailseite ansehen.",
  "Checkout mit gefülltem Warenkorb aufrufen.",
  "Den Verhandlungsabschnitt der Startseite ansehen."],
 "Textspalten bleiben lesbar breit statt über den Schirm zu laufen, Raster und Abschnitte behalten ihre Ausrichtung, und keine Fläche wirkt leer gedehnt.",
 "Auf Ultrawide ist genau hier schon einmal ein Abschnitt auseinandergelaufen."),

(30,"E8-10","Katalog und Checkout sind per Tastatur bedienbar","Oberfläche",
 ["Katalog öffnen und nur mit Tabulator durch die Seite gehen.",
  "Eine Karte allein mit der Tastatur öffnen und in den Warenkorb legen.",
  "Im Checkout alle Adressfelder per Tastatur ausfüllen.",
  "Die Bildvergrößerung öffnen und mit Escape schließen."],
 "Der Fokus ist an jeder Stelle sichtbar, die Reihenfolge folgt der Leserichtung, jede Aktion ist ohne Maus erreichbar, und die Vergrößerung gibt den Fokus zurück.",
 "Tastaturbedienbarkeit ist die Grundlage jeder weiteren Barrierefreiheit."),

(31,"E2-13","Katalog erklärt Lade- und Fehlerzustände","Oberfläche",
 ["Katalog bei gedrosselter Verbindung aufrufen.",
  "Den Zustand während des Ladens beobachten.",
  "Die Produktabfrage blockieren und die Seite neu laden.",
  "Blockade aufheben und neu laden."],
 "Während des Ladens erscheint ein Ladehinweis statt einer leeren Fläche, im Fehlerfall eine verständliche Meldung mit Handlungsempfehlung, und nach Aufheben lädt der Katalog normal.",
 "Eine leere Seite liest der Kunde als „ausverkauft“."),

(32,"E7-11","Zwei gleichzeitige Abgleiche verklemmen sich nicht","eBay",
 ["Im Adminbereich einen Abgleich starten.",
  "Während er läuft, einen zweiten Abgleich auslösen.",
  "Rückmeldung des zweiten Versuchs lesen.",
  "Ende des ersten Laufs abwarten und einen neuen starten."],
 "Der zweite Versuch wird mit Hinweis abgewiesen statt parallel zu laufen, und nach Ende des ersten Laufs ist ein neuer Start sofort möglich.",
 "Eine hängende Sperre hat den Import schon einmal über eine Stunde stillgelegt."),

(33,"E3-08","Bestellung mit Konto übernimmt die Kontodaten","Checkout",
 ["Angemeldet eine Karte in den Warenkorb legen.",
  "Checkout aufrufen und die vorbelegten Felder prüfen.",
  "Bestellung bis zur PayPal-Weiterleitung führen.",
  "Nach Abschluss die Bestellhistorie im Konto prüfen."],
 "Die Kontodaten sind sinnvoll vorbelegt, die Bestellung wird dem Konto zugeordnet und erscheint anschließend in der Historie.",
 "Die Kontobestellung ist ein anderer Weg als die Gastbestellung und scheitert an anderen Stellen."),

(34,"E1-06","Kartenbilder werden in passender Größe ausgeliefert","Katalog",
 ["Katalog aufrufen und die Netzwerkanalyse des Browsers öffnen.",
  "Größe der geladenen Rasterbilder ablesen.",
  "Eine Detailseite öffnen und dort die Bildgröße ablesen.",
  "Die Vergrößerung öffnen und erneut ablesen."],
 "Im Raster werden verkleinerte Varianten geladen und nicht die Originale; erst die Vergrößerung holt die volle Auflösung.",
 "Bei 296 Karten entscheidet das über Ladezeit und Kosten."),

(35,"E4-06","Shop-Verkauf beendet das zugehörige eBay-Angebot","eBay",
 ["Eine Karte auswählen, die zugleich auf eBay aktiv ist.",
  "Die Karte im Shop vollständig kaufen und bezahlen.",
  "Die eBay-Auftragsliste im Adminbereich prüfen.",
  "Den Zustand des Angebots bei eBay nachsehen."],
 "Nach der Zahlung entsteht ein Auftrag zum Beenden des eBay-Angebots, er wird erfolgreich ausgeführt, und das Angebot ist bei eBay nicht mehr aktiv.",
 "Diese Richtung ist offen und wird mit jedem Verkauf wahrscheinlicher. Solange sie fehlt, ist BLOCKED das ehrliche Ergebnis."),
]

VIEWPORT_HINWEIS = (
    "Oberflächenprüfung: Dieser Test wird zusätzlich in 1440x900 und 390x844 CSS-Pixel "
    "durchgeführt. Weitere Auflösungen nur, wenn der Test dem Bereich Oberfläche zugeordnet ist."
)
NACHWEIS = (
    "Nachweis: Ein Screenshot je Schritt, der Eingabe und sichtbares Ergebnis zeigt. "
    "PASS nur bei vollständig erfüllten Erwartungen. FAIL mit Reproduktionsschritten und "
    "verknüpftem Fehler, BLOCKED mit Ursache und fehlender Abhängigkeit. "
    "Passwörter, Tokens und Zahlungsdaten vor dem Anhang maskieren."
)

root = sys.argv[1]
out = os.path.join(root, "docs", "jira", "new-test-cases.csv")

# Selbsttest: kein Ablauf darf doppelt vorkommen. Genau daran ist die alte Liste
# gescheitert — 333 Faelle mit 27 Ablaeufen.
schritte = [hashlib.md5(("|".join(t[4]) + t[5]).encode()).hexdigest() for t in T]
assert len(set(schritte)) == len(T), "Doppelter Ablauf gefunden: %d von %d einzigartig" % (len(set(schritte)), len(T))
assert len({t[0] for t in T}) == len(T)

rows = []
for nr, story, titel, bereich, schr, erw, warum in T:
    beschreibung = "\n".join([
        "Abgedeckte Story: %s" % story,
        "Bereich: %s" % bereich,
        "",
        "Warum dieser Test existiert",
        warum,
        "",
        "Schritte",
    ] + ["%d. %s" % (i + 1, s) for i, s in enumerate(schr)] + [
        "",
        "Erwartetes Ergebnis",
        erw,
        "",
        VIEWPORT_HINWEIS,
        "",
        NACHWEIS,
    ])
    rows.append({
        "Work type": "Test",
        "Summary": "%s %s" % (story, titel),
        "Description": beschreibung,
        "Story Code": story,
        "Bereich": bereich,
        "Nr": nr,
    })

with open(out, "w", encoding="utf-8-sig", newline="") as fh:
    w = csv.DictWriter(fh, fieldnames=["Nr", "Work type", "Summary", "Story Code", "Bereich", "Description"])
    w.writeheader()
    w.writerows(rows)

import collections
print("geschrieben:", out, len(rows), "Testfälle")
print("Einzigartige Abläufe:", len(set(schritte)), "von", len(T))
for b, n in collections.Counter(r["Bereich"] for r in rows).most_common():
    print("  %-12s %d" % (b, n))
print("Abgedeckte Stories:", len({r["Story Code"] for r in rows}))
