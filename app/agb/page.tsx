import Link from "next/link";

export default function AgbPage() {
  return <main className="account-page">
    <Link className="back-link" href="/">← Zurück zu BrandyCards</Link>
    <article className="account-card legal-page">
      <p className="eyebrow">BRANDYCARDS</p>
      <h1>Allgemeine Geschäftsbedingungen.</h1>
      <h2>1. Geltungsbereich</h2>
      <p>Diese Allgemeinen Geschäftsbedingungen gelten für Bestellungen von Verbrauchern und Unternehmern über den Online-Shop der BrandyCards GbR.</p>
      <h2>2. Vertragspartner</h2>
      <p>Vertragspartner ist die BrandyCards GbR, Legienstraße 6, 51373 Leverkusen.</p>
      <h2>3. Vertragsschluss</h2>
      <p>Die Darstellung der Artikel stellt kein verbindliches Angebot dar. Mit dem Abschluss des Bestellvorgangs gibt der Kunde ein verbindliches Angebot ab. Der Vertrag kommt durch unsere Bestellbestätigung oder durch den Versand der Ware zustande.</p>
      <h2>4. Artikel und Preise</h2>
      <p>Es handelt sich um einzelne Trading Cards. Maßgeblich sind die Angaben im jeweiligen Artikelangebot. Alle Preise sind Gesamtpreise in Euro. Aufgrund der Kleinunternehmerregelung gemäß § 19 UStG wird keine Umsatzsteuer ausgewiesen.</p>
      <h2>5. Zahlung</h2>
      <p>Als Zahlungsart wird PayPal angeboten. Die Bestellung wird nach erfolgreicher Zahlungsbestätigung bearbeitet.</p>
      <h2>6. Lieferung</h2>
      <p>Wir liefern innerhalb der Europäischen Union, jedoch nicht in die USA oder nach Großbritannien. Die Lieferzeiten und Versandkosten sind unter <Link href="/versand-zahlung">Versand und Zahlung</Link> beschrieben.</p>
      <h2>7. Eigentumsvorbehalt</h2>
      <p>Die Ware bleibt bis zur vollständigen Zahlung unser Eigentum.</p>
      <h2>8. Mängelhaftung</h2>
      <p>Es gelten die gesetzlichen Mängelhaftungsrechte. Zustand, erkennbare Gebrauchsspuren und Besonderheiten werden im jeweiligen Angebot beschrieben.</p>
      <h2>9. Widerruf</h2>
      <p>Verbrauchern steht grundsätzlich ein gesetzliches Widerrufsrecht zu. Einzelheiten stehen in unserer <Link href="/widerruf">Widerrufsbelehrung</Link>.</p>
      <h2>10. Schlussbestimmungen</h2>
      <p>Für Verbraucher gelten die gesetzlichen Gerichtsstände. Zwingende gesetzliche Verbraucherschutzvorschriften bleiben unberührt.</p>
    </article>
  </main>;
}
