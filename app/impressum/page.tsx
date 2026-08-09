import Link from "next/link";
import { useI18n } from "../i18n";

export default function ImpressumPage() {
  const { t } = useI18n();
  return <main className="account-page">
    <Link className="back-link" href="/">{t("← Zurück zu BrandyCards")}</Link>
    <article className="account-card legal-page">
      <p className="eyebrow">{t("BRANDYCARDS")}</p>
      <h1>{t("Impressum.")}</h1>
      <h2>{t("Anbieter")}</h2>
      <p>BrandyCards GbR<br />Legienstraße 6<br />51373 Leverkusen<br />Deutschland</p>
      <h2>{t("Vertretungsberechtigte Gesellschafter")}</h2>
      <p>Philip Brand<br />Sebastian Brand</p>
      <h2>{t("Kontakt")}</h2>
      <p>{t("E-Mail")}: <a href="mailto:brandycards@gmx.de">brandycards@gmx.de</a></p>
      <h2>{t("Umsatzsteuer")}</h2>
      <p>{t("Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG: DE463062716")}</p>
      <p>{t("Die BrandyCards GbR wendet die Kleinunternehmerregelung gemäß § 19 UStG an. Es wird keine Umsatzsteuer ausgewiesen.")}</p>
      <h2>{t("Verantwortlich für den Inhalt")}</h2>
      <p>BrandyCards GbR, Legienstraße 6, 51373 Leverkusen</p>
      <p className="form-feedback">{t("Bitte prüfen, ob die angegebene USt-IdNr. der BrandyCards GbR zugeteilt ist und ob ein Eintrag im Gesellschaftsregister besteht.")}</p>
    </article>
  </main>;
}
