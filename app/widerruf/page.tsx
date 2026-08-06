import Link from "next/link";

export default function WiderrufPage() {
  return <main className="account-page">
    <Link className="back-link" href="/">← Zurück zu BrandyCards</Link>
    <article className="account-card legal-page">
      <p className="eyebrow">BRANDYCARDS</p>
      <h1>Widerrufsbelehrung.</h1>
      <h2>Widerrufsrecht</h2>
      <p>Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen.</p>
      <p>Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag, an dem Sie oder ein von Ihnen benannter Dritter, der nicht der Beförderer ist, die Ware erhalten haben.</p>
      <p>Um Ihr Widerrufsrecht auszuüben, müssen Sie uns mittels einer eindeutigen Erklärung per E-Mail oder Brief über Ihren Entschluss informieren:</p>
      <p>BrandyCards GbR<br />Legienstraße 6<br />51373 Leverkusen<br />E-Mail: <a href="mailto:brandycards@gmx.de">brandycards@gmx.de</a></p>
      <p>Zur Wahrung der Widerrufsfrist reicht es aus, dass Sie die Mitteilung vor Ablauf der Widerrufsfrist absenden.</p>
      <h2>Folgen des Widerrufs</h2>
      <p>Wenn Sie diesen Vertrag widerrufen, erstatten wir alle erhaltenen Zahlungen einschließlich der Kosten der günstigsten Standardlieferung unverzüglich und spätestens binnen vierzehn Tagen ab Eingang Ihres Widerrufs.</p>
      <p>Wir können die Rückzahlung verweigern, bis wir die Ware zurückerhalten haben oder Sie den Nachweis der Rücksendung erbracht haben.</p>
      <p>Sie müssen die Ware unverzüglich und spätestens binnen vierzehn Tagen ab Abgabe des Widerrufs zurücksenden an:</p>
      <p>BrandyCards GbR<br />Legienstraße 6<br />51373 Leverkusen</p>
      <p>Sie tragen die unmittelbaren Kosten der Rücksendung. Für einen Wertverlust müssen Sie nur aufkommen, wenn dieser auf einen zur Prüfung der Beschaffenheit, Eigenschaften und Funktionsweise nicht notwendigen Umgang zurückzuführen ist.</p>
      <h2>Muster-Widerrufsformular</h2>
      <p>An BrandyCards GbR, Legienstraße 6, 51373 Leverkusen, brandycards@gmx.de:</p>
      <p>Hiermit widerrufe ich den von mir abgeschlossenen Vertrag über den Kauf der folgenden Waren:</p>
      <p>Bestellt am: ____________________<br />Erhalten am: ____________________<br />Bestellnummer: ____________________<br />Name: ____________________<br />Anschrift: ____________________<br />Datum: ____________________<br />Unterschrift (nur bei Mitteilung auf Papier): ____________________</p>
      <p className="form-feedback">Diese Belehrung ist ein Arbeitsentwurf und sollte vor dem Verkaufsstart rechtlich geprüft werden.</p>
    </article>
  </main>;
}
