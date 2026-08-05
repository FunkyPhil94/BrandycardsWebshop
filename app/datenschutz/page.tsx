import Link from "next/link";

export default function DatenschutzPage() {
  return <main className="account-page">
    <Link className="back-link" href="/">← Zurück zu BrandyCards</Link>
    <article className="account-card">
      <p className="eyebrow">BRANDYCARDS</p>
      <h1>Datenschutz &amp; Löschung.</h1>
      <p>Wenn du uns eine Anfrage, einen Preisvorschlag oder ein Kartenangebot sendest, verarbeiten wir deine Angaben ausschließlich zur Bearbeitung deiner Anfrage und zur Kontaktaufnahme.</p>
      <h2>Welche Daten werden gespeichert?</h2>
      <p>Je nach Formular können E-Mail-Adresse, Name, Kartentitel, Nachricht, Preisvorstellung sowie hochgeladene Kartenbilder gespeichert werden. Bilder liegen in einem privaten Speicher und sind nicht öffentlich zugänglich.</p>
      <h2>Aufbewahrung</h2>
      <p>Wir bewahren die Daten nur so lange auf, wie sie für die Bearbeitung des Vorgangs, gesetzliche Pflichten oder die Klärung eines berechtigten Interesses erforderlich sind. Nicht mehr benötigte Anfragen und Bilder werden gelöscht.</p>
      <h2>Auskunft und Löschung</h2>
      <p>Du kannst jederzeit Auskunft oder die Löschung deiner Anfrage und der zugehörigen Bilder verlangen. Nutze dafür die E-Mail-Adresse, über die du uns kontaktiert hast, und schreibe an BrandyCards. Wir prüfen die Anfrage, bevor wir Daten löschen.</p>
      <h2>Technischer Schutz</h2>
      <p>Öffentliche Formulare prüfen Eingaben und Uploads. Kartenbilder werden nicht analysiert. Der Zugriff auf eingereichte Bilder ist auf berechtigte Administratoren beschränkt und erfolgt ohne öffentliche Dateien oder dauerhaft öffentliche Links.</p>
      <p className="form-feedback">Diese Seite ist eine technische Informationsseite und ersetzt keine rechtliche Prüfung oder ein vollständiges Impressum.</p>
    </article>
  </main>;
}
