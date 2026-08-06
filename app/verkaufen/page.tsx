"use client";

import Link from "next/link";
import { ChangeEvent, useState } from "react";
import { Field, FormFeedback, PrivacyNotice, postMultipart, useFormSubmit } from "../forms";
import { SiteFooter, SiteHeader } from "../site-chrome";

export default function VerkaufenPage() {
  const submission = useFormSubmit();
  const [imageCount, setImageCount] = useState(0);

  function handleImages(event: ChangeEvent<HTMLInputElement>) {
    setImageCount(event.target.files?.length ?? 0);
  }

  return <main>
    <SiteHeader active="/verkaufen" />

    <section className="page-intro">
      <p className="eyebrow">DEINE KARTEN. DEINE CHANCE.</p>
      <h1>Verkaufe<br /><em>an BrandyCards.</em></h1>
      <p>Du hast Karten abzugeben? Schick uns Bilder und optional deine Preisvorstellung. Wir schauen sie uns an und melden uns mit einem Angebot zurück.</p>
    </section>

    <section className="steps" aria-label="So läuft der Ankauf">
      <div className="step"><span className="step-number">01</span><h2>Anbieten</h2><p>Titel, Bilder und optional dein Wunschpreis über das Formular.</p></div>
      <div className="step"><span className="step-number">02</span><h2>Prüfen</h2><p>Wir sichten Zustand und Marktlage und melden uns per E-Mail.</p></div>
      <div className="step"><span className="step-number">03</span><h2>Einigen</h2><p>Passt das Angebot, klären wir Versand und Zahlung direkt mit dir.</p></div>
    </section>

    <section className="forms-section single">
      <div className="form-card">
        <p className="eyebrow">ANKAUF</p>
        <h2>Eigene Karten anbieten</h2>
        <p>Bilder werden sicher in unserem privaten Speicher abgelegt und ausschließlich von BrandyCards verwaltet. JPG, PNG oder WebP, maximal 10 MB je Bild und bis zu fünf Bilder.</p>
        <form onSubmit={(event) => submission.run(event, async (form) => {
          const message = await postMultipart("/api/card-submissions", form);
          setImageCount(0);
          return message;
        })}>
          <Field label="Kartentitel" name="title" placeholder="z. B. 2023-24 Panini Prizm Bukayo Saka Silver" />
          <Field label="Gewünschter Preis in €" name="price" type="number" required={false} placeholder="Optional" />
          <label className="form-field">
            <span>Nachricht</span>
            <textarea name="message" maxLength={4000} rows={5} placeholder="Zustand, Anzahl oder weitere Hinweise" />
          </label>
          <Field label="E-Mail-Adresse" name="email" type="email" />
          <label className="form-field">
            <span>Bilder auswählen</span>
            <input name="images" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handleImages} />
            <small>{imageCount ? `${imageCount} Bild(er) ausgewählt.` : "Noch keine Bilder ausgewählt."}</small>
          </label>
          <PrivacyNotice />
          <button className="button button-primary" type="submit" disabled={submission.pending}>
            {submission.pending ? "Wird gesendet …" : "Karte anbieten"}
          </button>
          <FormFeedback feedback={submission.feedback} />
        </form>
      </div>
    </section>

    <section className="cta-strip">
      <p>Lieber erst stöbern, was wir schon haben?</p>
      <Link className="button button-outline" href="/karten">Alle Karten ansehen <span>→</span></Link>
    </section>

    <SiteFooter />
  </main>;
}
