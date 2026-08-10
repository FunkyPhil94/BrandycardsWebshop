"use client";

import Link from "next/link";
import { useI18n } from "../i18n";

export default function VersandZahlungPage() {
  const { t } = useI18n();
  return <main className="account-page">
    <Link className="back-link" href="/">{t("← Zurück zu BrandyCards")}</Link>
    <article className="account-card legal-page">
      <p className="eyebrow">{t("BRANDYCARDS")}</p>
      <h1>{t("Versand und Zahlung.")}</h1>
      <h2>{t("Versandgebiet")}</h2>
      <p>{t("Wir liefern innerhalb der Europäischen Union. Ein Versand in die USA oder nach Großbritannien ist nicht möglich.")}</p>
      <h2>{t("Versandkosten")}</h2>
      <p>{t("Deutschland:")} <strong>3,45 €</strong><br />{t("Übrige EU-Mitgliedstaaten:")} <strong>14,49 €</strong></p>
      <h2>{t("Lieferzeiten")}</h2>
      <p>{t("Deutschland: 3 bis 5 Werktage nach Zahlungseingang.")}<br />{t("Übrige EU-Mitgliedstaaten: 10 bis 20 Werktage nach Zahlungseingang.")}</p>
      <p>{t("Die Lieferzeit kann sich bei unvorhersehbaren Verzögerungen des Versanddienstleisters verlängern. Wir informieren über wesentliche Verzögerungen.")}</p>
      <h2>{t("Zahlungsart")}</h2>
      <p>{t("Wir akzeptieren derzeit PayPal. Die Bearbeitung und der Versand beginnen nach erfolgreicher Zahlungsbestätigung.")}</p>
      <h2>{t("Rücksendungen")}</h2>
      <p>{t("Rücksendungen sind an folgende Adresse zu senden:")}</p>
      <p>BrandyCards GbR<br />Legienstraße 6<br />51373 Leverkusen</p>
      <p>{t("Die unmittelbaren Kosten der Rücksendung trägt der Käufer, soweit gesetzlich zulässig und ordnungsgemäß informiert.")}</p>
      <p>{t("Weitere Informationen finden Sie in der")} <Link href="/widerruf">{t("Widerrufsbelehrung")}</Link>.</p>
    </article>
  </main>;
}
