import Link from "next/link";

export default function DatenschutzPage() {
  return <main className="account-page">
    <Link className="back-link" href="/">← Zurück zu BrandyCards</Link>
    <article className="account-card legal-page">
      <p className="eyebrow">BRANDYCARDS</p>
      <h1>Datenschutzerklärung.</h1>
      <h2>1. Verantwortlicher</h2>
      <p>BrandyCards GbR<br />Legienstraße 6<br />51373 Leverkusen<br />E-Mail: <a href="mailto:brandycards@gmx.de">brandycards@gmx.de</a></p>
      <h2>2. Welche Daten wir verarbeiten</h2>
      <p>Je nach Nutzung des Shops verarbeiten wir E-Mail-Adresse, Benutzername, Anzeigename, Login- und Sitzungsdaten, Bestell-, Liefer- und Zahlungsdaten, Nachrichten, Preisvorschläge, Kartenangebote und hochgeladene Bilder. Außerdem können technische Zugriffsdaten wie IP-Adresse, Zeitpunkt und Browserinformationen in Sicherheits- und Serverprotokollen anfallen.</p>
      <h2>3. Kundenkonto</h2>
      <p>Die Einrichtung und Verwaltung eines Kundenkontos erfolgt zur Durchführung vorvertraglicher Maßnahmen und des Vertrags (Art. 6 Abs. 1 lit. b DSGVO). Für die Authentifizierung nutzen wir Supabase Auth. Die Daten werden nur für Anmeldung, Kontoverwaltung und damit verbundene Shopfunktionen verwendet.</p>
      <h2>4. Bestellungen und PayPal</h2>
      <p>Für die Zahlungsabwicklung werden die erforderlichen Zahlungs- und Bestelldaten an PayPal übermittelt. Dabei gelten zusätzlich die Datenschutzbestimmungen von PayPal. Bestell- und Rechnungsdaten bewahren wir im Rahmen gesetzlicher handels- und steuerrechtlicher Pflichten auf.</p>
      <h2>5. E-Mails über Resend</h2>
      <p>Registrierungs-, Bestätigungs- und Passwort-Reset-E-Mails werden über Resend versendet. Dabei werden insbesondere E-Mail-Adresse sowie Versand- und Zustellinformationen verarbeitet. Für den Versand ist die Domain brandycards.de in der EU-Region Irland verifiziert. Resend-Informationen: <a href="https://resend.com/legal/privacy-policy" target="_blank" rel="noreferrer">Datenschutzerklärung von Resend</a>.</p>
      <h2>6. Hosting und Speicher</h2>
      <p>Die Website und Teile der Infrastruktur werden über Cloudflare Workers, D1 und R2 betrieben. Hochgeladene Kartenbilder werden in einem privaten Speicher abgelegt und nicht öffentlich analysiert oder veröffentlicht. Zugriff erhalten nur berechtigte Administratoren für die Bearbeitung des Vorgangs. Cloudflare-Informationen: <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noreferrer">Datenschutzerklärung von Cloudflare</a>.</p>
      <h2>7. eBay-Synchronisierung</h2>
      <p>Öffentliche eBay-Festpreisangebote können mit Titel, Bildern, Preis-, Bestands- und Angebotsdaten in den Shop übernommen werden. Auktionen werden nur als Hinweis mit eBay-Link angezeigt. Für die eBay-API und deren Datenverarbeitung gelten zusätzlich die Datenschutzinformationen von eBay.</p>
      <h2>8. Anfragen, Preisvorschläge und Kartenangebote</h2>
      <p>Angaben aus Kontaktformularen, Preisvorschlägen und Kartenangeboten verarbeiten wir zur Bearbeitung der Anfrage und zur Kontaktaufnahme. Bilder werden nicht durch KI analysiert. Bitte übermitteln Sie nur Daten und Bilder, die für die Anfrage erforderlich sind.</p>
      <h2>9. Speicherdauer und Löschung</h2>
      <p>Wir löschen Daten, sobald der Zweck entfällt und keine gesetzlichen Aufbewahrungspflichten oder berechtigten Interessen entgegenstehen. Bestell- und Rechnungsdaten können wegen gesetzlicher Pflichten länger gespeichert werden. Sie können die Löschung Ihres Kontos oder Ihrer Anfrage unter <a href="mailto:brandycards@gmx.de">brandycards@gmx.de</a> verlangen.</p>
      <h2>10. Ihre Rechte</h2>
      <p>Sie haben insbesondere das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch im Rahmen der gesetzlichen Voraussetzungen. Außerdem besteht ein Beschwerderecht bei einer Datenschutzaufsichtsbehörde.</p>
      <h2>11. Cookies und Tracking</h2>
      <p>Wir setzen derzeit keine nicht erforderlichen Analyse-, Werbe- oder Resend-Trackingfunktionen ein. Falls sich dies ändert, werden die erforderlichen Informationen und gegebenenfalls eine Einwilligungslösung ergänzt.</p>
      <p className="form-feedback">Arbeitsentwurf: Anbieter- und Speicherortangaben sowie Aufbewahrungsfristen sollten vor dem Verkaufsstart anhand der aktuellen Verträge und Anbieterunterlagen rechtlich geprüft werden.</p>
    </article>
  </main>;
}
