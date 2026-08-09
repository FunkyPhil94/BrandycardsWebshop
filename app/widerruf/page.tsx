"use client";

import Link from "next/link";
import { useI18n } from "../i18n";

export default function WiderrufPage() {
  const { t } = useI18n();
  return <main className="account-page">
    <Link className="back-link" href="/">{t("← Zurück zu BrandyCards")}</Link>
    <article className="account-card legal-page">
      <p className="eyebrow">{t("BRANDYCARDS")}</p>
      <h1>{t("Widerrufsbelehrung.")}</h1>
      <h2>{t("Widerrufsrecht")}</h2>
      <p>{t("Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen.")}</p>
      <p>{t("Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag, an dem Sie oder ein von Ihnen benannter Dritter, der nicht der Beförderer ist, die Ware erhalten haben.")}</p>
      <p>{t("Um Ihr Widerrufsrecht auszuüben, müssen Sie uns mittels einer eindeutigen Erklärung per E-Mail oder Brief über Ihren Entschluss informieren:")}</p>
      <p>BrandyCards GbR<br />Legienstraße 6<br />51373 Leverkusen<br />{t("E-Mail:")} <a href="mailto:brandycards@gmx.de">brandycards@gmx.de</a></p>
      <p>{t("Zur Wahrung der Widerrufsfrist reicht es aus, dass Sie die Mitteilung vor Ablauf der Widerrufsfrist absenden.")}</p>
      <h2>{t("Folgen des Widerrufs")}</h2>
      <p>{t("Wenn Sie diesen Vertrag widerrufen, erstatten wir alle erhaltenen Zahlungen einschließlich der Kosten der günstigsten Standardlieferung unverzüglich und spätestens binnen vierzehn Tagen ab Eingang Ihres Widerrufs.")}</p>
      <p>{t("Wir können die Rückzahlung verweigern, bis wir die Ware zurückerhalten haben oder Sie den Nachweis der Rücksendung erbracht haben.")}</p>
      <p>{t("Sie müssen die Ware unverzüglich und spätestens binnen vierzehn Tagen ab Abgabe des Widerrufs zurücksenden an:")}</p>
      <p>BrandyCards GbR<br />Legienstraße 6<br />51373 Leverkusen</p>
      <p>{t("Sie tragen die unmittelbaren Kosten der Rücksendung. Für einen Wertverlust müssen Sie nur aufkommen, wenn dieser auf einen zur Prüfung der Beschaffenheit, Eigenschaften und Funktionsweise nicht notwendigen Umgang zurückzuführen ist.")}</p>
      <h2>{t("Muster-Widerrufsformular")}</h2>
      <p>{t("An BrandyCards GbR, Legienstraße 6, 51373 Leverkusen, brandycards@gmx.de:")}</p>
      <p>{t("Hiermit widerrufe ich den von mir abgeschlossenen Vertrag über den Kauf der folgenden Waren:")}</p>
      <p>{t("Bestellt am:")} ____________________<br />{t("Erhalten am:")} ____________________<br />{t("Bestellnummer:")} ____________________<br />{t("Name:")} ____________________<br />{t("Anschrift:")} ____________________<br />{t("Datum:")} ____________________<br />{t("Unterschrift (nur bei Mitteilung auf Papier):")} ____________________</p>
      <p className="form-feedback">{t("Diese Belehrung ist ein Arbeitsentwurf und sollte vor dem Verkaufsstart rechtlich geprüft werden.")}</p>
    </article>
  </main>;
}
