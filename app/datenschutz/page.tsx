"use client";

import Link from "next/link";
import { useI18n } from "../i18n";

export default function DatenschutzPage() {
  const { t } = useI18n();
  return <main className="account-page">
    <Link className="back-link" href="/">{t("← Zurück zu BrandyCards")}</Link>
    <article className="account-card legal-page">
      <p className="eyebrow">{t("BRANDYCARDS")}</p>
      <h1>{t("Datenschutzerklärung.")}</h1>
      <h2>1. {t("Verantwortlicher")}</h2>
      <p>BrandyCards GbR<br />Legienstraße 6<br />51373 Leverkusen<br />{t("E-Mail")}: <a href="mailto:brandycards@gmx.de">brandycards@gmx.de</a></p>
      <h2>2. {t("Welche Daten wir verarbeiten")}</h2>
      <p>{t("Je nach Nutzung des Shops verarbeiten wir E-Mail-Adresse, Login- und Sitzungsdaten, Bestell-, Liefer- und Zahlungsdaten, Nachrichten, Preisvorschläge, Kartenangebote und hochgeladene Bilder. Außerdem können technische Zugriffsdaten wie IP-Adresse, Zeitpunkt und Browserinformationen in Sicherheits- und Serverprotokollen anfallen.")}</p>
      <h2>3. {t("Kundenkonto")}</h2>
      <p>{t("Die Einrichtung und Verwaltung eines Kundenkontos erfolgt zur Durchführung vorvertraglicher Maßnahmen und des Vertrags (Art. 6 Abs. 1 lit. b DSGVO). Für die Authentifizierung nutzen wir Supabase Auth. Die Daten werden nur für Anmeldung, Kontoverwaltung und damit verbundene Shopfunktionen verwendet.")}</p>
      <h2>4. {t("Bestellungen und PayPal")}</h2>
      <p>{t("Für die Zahlungsabwicklung werden die erforderlichen Zahlungs- und Bestelldaten an PayPal übermittelt. Dabei gelten zusätzlich die Datenschutzbestimmungen von PayPal. Bestell- und Rechnungsdaten bewahren wir im Rahmen gesetzlicher handels- und steuerrechtlicher Pflichten auf.")}</p>
      <h2>5. {t("E-Mails über Resend")}</h2>
      <p>{t("Registrierungs-, Bestätigungs- und Passwort-Reset-E-Mails werden über Resend versendet. Dabei werden insbesondere E-Mail-Adresse sowie Versand- und Zustellinformationen verarbeitet. Für den Versand ist die Domain brandycards.de in der EU-Region Irland verifiziert. Resend-Informationen:")} <a href="https://resend.com/legal/privacy-policy" target="_blank" rel="noreferrer">{t("Datenschutzerklärung von Resend")}</a>.</p>
      <h2>6. {t("Hosting und Speicher")}</h2>
      <p>{t("Die Website und Teile der Infrastruktur werden über Cloudflare Workers, D1 und R2 betrieben. Hochgeladene Kartenbilder werden in einem privaten Speicher abgelegt und nicht öffentlich analysiert oder veröffentlicht. Zugriff erhalten nur berechtigte Administratoren für die Bearbeitung des Vorgangs. Cloudflare-Informationen:")} <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noreferrer">{t("Datenschutzerklärung von Cloudflare")}</a>.</p>
      <h2>7. {t("eBay-Synchronisierung und Kartenbilder")}</h2>
      <p>{t("Öffentliche eBay-Festpreisangebote können mit Titel, Bildern, Preis-, Bestands- und Angebotsdaten in den Shop übernommen werden. Auktionen werden nur als Hinweis mit eBay-Link angezeigt. Für die eBay-API und deren Datenverarbeitung gelten zusätzlich die Datenschutzinformationen von eBay.")}</p>
      <p><strong>{t("Kartenbilder werden nicht von uns ausgeliefert, sondern direkt von den Bildservern von eBay geladen.")}</strong> {t("Beim Aufruf einer Seite mit Kartenbildern stellt Ihr Browser deshalb eine Verbindung zu eBay her; dabei werden Ihre IP-Adresse und technische Angaben wie der verwendete Browser an eBay übermittelt. Wir übermitteln dabei nur die Herkunft der Seite, nicht die vollständige Adresse.")} (<code>Referrer-Policy: strict-origin-when-cross-origin</code>). {t("Rechtsgrundlage ist unser berechtigtes Interesse an einer schnellen und stets aktuellen Darstellung des Bestands (Art. 6 Abs. 1 lit. f DSGVO). Weitere Informationen:")} <a href="https://www.ebay.de/help/policies/member-behaviour-policies/datenschutzerklrung?id=4260" target="_blank" rel="noreferrer">{t("Datenschutzerklärung von eBay")}</a>.</p>
      <h2>8. {t("Anfragen, Preisvorschläge und Kartenangebote")}</h2>
      <p>{t("Angaben aus Kontaktformularen, Preisvorschlägen und Kartenangeboten verarbeiten wir zur Bearbeitung der Anfrage und zur Kontaktaufnahme. Bilder werden nicht durch KI analysiert. Bitte übermitteln Sie nur Daten und Bilder, die für die Anfrage erforderlich sind.")}</p>
      <h2>9. {t("Speicherdauer und Löschung")}</h2>
      <p>{t("Wir löschen Daten, sobald der Zweck entfällt und keine gesetzlichen Aufbewahrungspflichten oder berechtigten Interessen entgegenstehen. Bestell- und Rechnungsdaten können wegen gesetzlicher Pflichten länger gespeichert werden. Sie können die Löschung Ihres Kontos oder Ihrer Anfrage unter")} <a href="mailto:brandycards@gmx.de">brandycards@gmx.de</a> {t("verlangen.")}</p>
      <p><strong>{t("Mit Kundenkonto geht beides ohne Umweg über uns:")}</strong> {t("Unter")} <Link href="/account">{t("Konto")}</Link> {t("können Sie alle zu Ihrem Konto gespeicherten Daten als Datei herunterladen und Ihr Konto selbst löschen. Die Löschung entfernt Anfragen, Preisvorschläge und Kartenangebote samt hochgeladener Bilder sowie Ihre Anmeldung.")} <strong>{t("Bestellungen bleiben als Rechnungsbelege gespeichert.")}</strong> {t("Dazu verpflichten uns die handels- und steuerrechtlichen Aufbewahrungsfristen (Art. 17 Abs. 3 lit. b DSGVO). Die Verknüpfung zu Ihrem Konto wird aufgehoben.")}</p>
      <p><strong>{t("Kartenangebote aus dem Ankauf")}</strong> {t("löschen wir mitsamt den hochgeladenen Bildern automatisch")} <strong>{t("90 Tage")}</strong> {t("nachdem der Vorgang abgeschlossen wurde, also abgelehnt oder beendet ist. Führt ein Angebot zu einem Ankauf, gelten für die daraus entstehenden Kauf- und Rechnungsdaten die gesetzlichen Aufbewahrungsfristen; diese Daten bleiben entsprechend länger gespeichert.")}</p>
      <p>{t("Zahlungs- und Webhook-Rohdaten von PayPal und eBay werden nur so lange gespeichert, wie sie für Abwicklung und Fehleranalyse erforderlich sind. Nach 30 Tagen löschen wir die Rohinhalte; Zahlungs- und Ereignismetadaten wie Status, Betrag, Provider-ID und Zeitpunkte bleiben zur Nachvollziehbarkeit erhalten. Bestell- und Rechnungsdaten bleiben wegen gesetzlicher Pflichten länger gespeichert.")}</p>
      <h2>10. {t("Ihre Rechte")}</h2>
      <p>{t("Sie haben insbesondere das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch im Rahmen der gesetzlichen Voraussetzungen. Außerdem besteht ein Beschwerderecht bei einer Datenschutzaufsichtsbehörde.")}</p>
      <h2>11. {t("Cookies und Tracking")}</h2>
      <p>{t("Wir zählen die Aufrufe unserer eigenen Seiten, um zu sehen, welche Bereiche des Shops genutzt werden. Gespeichert wird dabei ausschließlich ein Zähler je Stunde und Seitenbereich. Es werden keine Cookies gesetzt, keine IP-Adressen, Geräte- oder Sitzungskennungen gespeichert, keine Profile gebildet und keine Daten an Dritte übermittelt; ein Rückschluss auf einzelne Personen ist aus diesen Zahlen nicht möglich. Sie werden nach 90 Tagen gelöscht.")}</p>
      <p>{t("Darüber hinaus setzen wir keine Analyse-, Werbe- oder Resend-Trackingfunktionen ein. Falls sich dies ändert, werden die erforderlichen Informationen und gegebenenfalls eine Einwilligungslösung ergänzt. Unabhängig davon werden Kartenbilder direkt von eBay geladen; was dabei übertragen wird, steht in Abschnitt 7.")}</p>
      <p className="form-feedback">{t("Arbeitsentwurf: Anbieter- und Speicherortangaben sowie Aufbewahrungsfristen sollten vor dem Verkaufsstart anhand der aktuellen Verträge und Anbieterunterlagen rechtlich geprüft werden. Das gilt besonders für die Abschnitte 7 (Einbindung der eBay-Bildserver) und 9 (Löschfrist für Kartenangebote).")}</p>
    </article>
  </main>;
}
