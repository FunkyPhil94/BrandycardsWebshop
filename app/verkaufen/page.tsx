"use client";

import Link from "next/link";
import { ChangeEvent, useState } from "react";
import { BotGuardFields, Field, FormFeedback, PrivacyNotice, postMultipart, useFormSubmit } from "../forms";
import { useI18n } from "../i18n";
import { SiteFooter, SiteHeader } from "../site-chrome";

export default function VerkaufenPage() {
  const submission = useFormSubmit();
  const { t } = useI18n();
  const [imageCount, setImageCount] = useState(0);

  function handleImages(event: ChangeEvent<HTMLInputElement>) {
    setImageCount(event.target.files?.length ?? 0);
  }

  return <main>
    <SiteHeader active="/verkaufen" />

    <section className="page-intro">
      <p className="eyebrow">{t("DEINE KARTEN. DEINE CHANCE.")}</p>
      <h1>{t("Verkaufe")}<br /><em>{t("an BrandyCards.")}</em></h1>
      <p>{t("Du hast Karten abzugeben? Schick uns Bilder und optional deine Preisvorstellung. Wir schauen sie uns an und melden uns mit einem Angebot zurück.")}</p>
    </section>

    <section className="steps" aria-label={t("So läuft der Ankauf")}>
      <div className="step"><span className="step-number">01</span><h2>{t("Anbieten")}</h2><p>{t("Titel, Bilder und optional dein Wunschpreis über das Formular.")}</p></div>
      <div className="step"><span className="step-number">02</span><h2>{t("Prüfen")}</h2><p>{t("Wir sichten Zustand und Marktlage und melden uns per E-Mail.")}</p></div>
      <div className="step"><span className="step-number">03</span><h2>{t("Einigen")}</h2><p>{t("Passt das Angebot, klären wir Versand und Zahlung direkt mit dir.")}</p></div>
    </section>

    <section className="forms-section single">
      <div className="form-card">
        <p className="eyebrow">{t("ANKAUF")}</p>
        <h2>{t("Eigene Karten anbieten")}</h2>
        <p>{t("Bilder werden sicher in unserem privaten Speicher abgelegt und ausschließlich von BrandyCards verwaltet. JPG, PNG oder WebP, maximal 10 MB je Bild und bis zu fünf Bilder.")}</p>
        <form onSubmit={(event) => submission.run(event, async (form) => {
          const message = await postMultipart("/api/card-submissions", form, t("Danke! Dein Kartenangebot und die Bilder sind sicher bei uns eingegangen."), t("Die Anfrage konnte nicht gesendet werden."));
          setImageCount(0);
          return message;
        })}>
          <BotGuardFields />
          <Field label={t("Kartentitel")} name="title" placeholder={t("z. B. 2023-24 Panini Prizm Bukayo Saka Silver")} />
          <Field label={t("Gewünschter Preis in €")} name="price" type="number" required={false} placeholder={t("Optional")} />
          <label className="form-field">
            <span>{t("Nachricht")}</span>
            <textarea name="message" maxLength={4000} rows={5} placeholder={t("Zustand, Anzahl oder weitere Hinweise")} />
          </label>
          <Field label={t("E-Mail-Adresse")} name="email" type="email" />
          <label className="form-field">
            <span>{t("Bilder auswählen")}</span>
            <input name="images" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handleImages} />
            <small>{imageCount ? t("{{count}} Bild(er) ausgewählt.", { count: imageCount }) : t("Noch keine Bilder ausgewählt.")}</small>
          </label>
          <PrivacyNotice />
          <button className="button button-primary" type="submit" disabled={submission.pending}>
            {submission.pending ? t("Wird gesendet …") : t("Karte anbieten")}
          </button>
          <FormFeedback feedback={submission.feedback} />
        </form>
      </div>
    </section>

    <section className="cta-strip">
      <p>{t("Lieber erst stöbern, was wir schon haben?")}</p>
      <Link className="button button-outline" href="/karten">{t("Alle Karten ansehen")} <span>→</span></Link>
    </section>

    <SiteFooter />
  </main>;
}
