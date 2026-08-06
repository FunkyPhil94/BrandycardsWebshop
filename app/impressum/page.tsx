import Link from "next/link";

export default function ImpressumPage() {
  return <main className="account-page">
    <Link className="back-link" href="/">← Zurück zu BrandyCards</Link>
    <article className="account-card legal-page">
      <p className="eyebrow">BRANDYCARDS</p>
      <h1>Impressum.</h1>
      <h2>Anbieter</h2>
      <p>BrandyCards GbR<br />Legienstraße 6<br />51373 Leverkusen<br />Deutschland</p>
      <h2>Vertretungsberechtigte Gesellschafter</h2>
      <p>Philip Brand<br />Sebastian Brand</p>
      <h2>Kontakt</h2>
      <p>E-Mail: <a href="mailto:brandycards@gmx.de">brandycards@gmx.de</a></p>
      <h2>Umsatzsteuer</h2>
      <p>Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG: DE463062716</p>
      <p>Die BrandyCards GbR wendet die Kleinunternehmerregelung gemäß § 19 UStG an. Es wird keine Umsatzsteuer ausgewiesen.</p>
      <h2>Verantwortlich für den Inhalt</h2>
      <p>BrandyCards GbR, Legienstraße 6, 51373 Leverkusen</p>
      <p className="form-feedback">Bitte prüfen, ob die angegebene USt-IdNr. der BrandyCards GbR zugeteilt ist und ob ein Eintrag im Gesellschaftsregister besteht.</p>
    </article>
  </main>;
}
