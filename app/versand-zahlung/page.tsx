import Link from "next/link";

export default function VersandZahlungPage() {
  return <main className="account-page">
    <Link className="back-link" href="/">← Zurück zu BrandyCards</Link>
    <article className="account-card legal-page">
      <p className="eyebrow">BRANDYCARDS</p>
      <h1>Versand und Zahlung.</h1>
      <h2>Versandgebiet</h2>
      <p>Wir liefern innerhalb der Europäischen Union. Ein Versand in die USA oder nach Großbritannien ist nicht möglich.</p>
      <h2>Versandkosten</h2>
      <p>Deutschland: <strong>3,45 €</strong><br />Übrige EU-Mitgliedstaaten: <strong>14,49 €</strong></p>
      <h2>Lieferzeiten</h2>
      <p>Deutschland: 3–5 Werktage nach Zahlungseingang.<br />Übrige EU-Mitgliedstaaten: 10–20 Werktage nach Zahlungseingang.</p>
      <p>Die Lieferzeit kann sich bei unvorhersehbaren Verzögerungen des Versanddienstleisters verlängern. Wir informieren über wesentliche Verzögerungen.</p>
      <h2>Zahlungsart</h2>
      <p>Wir akzeptieren derzeit PayPal. Die Bearbeitung und der Versand beginnen nach erfolgreicher Zahlungsbestätigung.</p>
      <h2>Rücksendungen</h2>
      <p>Rücksendungen sind an folgende Adresse zu senden:</p>
      <p>BrandyCards GbR<br />Legienstraße 6<br />51373 Leverkusen</p>
      <p>Die unmittelbaren Kosten der Rücksendung trägt der Käufer, soweit gesetzlich zulässig und ordnungsgemäß informiert.</p>
      <p>Weitere Informationen finden Sie in der <Link href="/widerruf">Widerrufsbelehrung</Link>.</p>
    </article>
  </main>;
}
