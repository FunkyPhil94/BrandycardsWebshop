import Link from "next/link";
import { useI18n } from "../i18n";

export default function AgbPage() {
  const { t } = useI18n();
  return <main className="account-page">
    <Link className="back-link" href="/">{t("← Zurück zu BrandyCards")}</Link>
    <article className="account-card legal-page">
      <p className="eyebrow">{t("BRANDYCARDS")}</p>
      <h1>{t("Allgemeine Geschäftsbedingungen.")}</h1>
      <h2>1. {t("Geltungsbereich")}</h2>
      <p>{t("Diese Allgemeinen Geschäftsbedingungen gelten für Bestellungen von Verbrauchern und Unternehmern über den Online-Shop der BrandyCards GbR.")}</p>
      <h2>2. {t("Vertragspartner")}</h2>
      <p>{t("Vertragspartner ist die BrandyCards GbR, Legienstraße 6, 51373 Leverkusen.")}</p>
      <h2>3. {t("Vertragsschluss")}</h2>
      <p>{t("Die Darstellung der Artikel stellt kein verbindliches Angebot dar. Mit dem Abschluss des Bestellvorgangs gibt der Kunde ein verbindliches Angebot ab. Der Vertrag kommt durch unsere Bestellbestätigung oder durch den Versand der Ware zustande.")}</p>
      <h2>4. {t("Artikel und Preise")}</h2>
      <p>{t("Es handelt sich um einzelne Trading Cards. Maßgeblich sind die Angaben im jeweiligen Artikelangebot. Alle Preise sind Gesamtpreise in Euro. Aufgrund der Kleinunternehmerregelung gemäß § 19 UStG wird keine Umsatzsteuer ausgewiesen.")}</p>
      <h2>5. {t("Zahlung")}</h2>
      <p>{t("Als Zahlungsart wird PayPal angeboten. Die Bestellung wird nach erfolgreicher Zahlungsbestätigung bearbeitet.")}</p>
      <h2>6. {t("Lieferung")}</h2>
      <p>{t("Wir liefern innerhalb der Europäischen Union, jedoch nicht in die USA oder nach Großbritannien.")} {t("Die Lieferzeiten und Versandkosten sind unter")} <Link href="/versand-zahlung">{t("Versand und Zahlung")}</Link> {t("beschrieben.")}</p>
      <h2>7. {t("Eigentumsvorbehalt")}</h2>
      <p>{t("Die Ware bleibt bis zur vollständigen Zahlung unser Eigentum.")}</p>
      <h2>8. {t("Mängelhaftung")}</h2>
      <p>{t("Es gelten die gesetzlichen Mängelhaftungsrechte. Zustand, erkennbare Gebrauchsspuren und Besonderheiten werden im jeweiligen Angebot beschrieben.")}</p>
      <h2>9. {t("Widerruf")}</h2>
      <p>{t("Verbrauchern steht grundsätzlich ein gesetzliches Widerrufsrecht zu. Einzelheiten stehen in unserer")} <Link href="/widerruf">{t("Widerrufsbelehrung")}</Link>.</p>
      <h2>10. {t("Schlussbestimmungen")}</h2>
      <p>{t("Für Verbraucher gelten die gesetzlichen Gerichtsstände. Zwingende gesetzliche Verbraucherschutzvorschriften bleiben unberührt.")}</p>
    </article>
  </main>;
}
