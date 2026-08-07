"use client";

import Link from "next/link";
import { BotGuardFields, Field, FormFeedback, PrivacyNotice, botGuardPayload, postJson, useFormSubmit } from "../forms";
import { SiteFooter, SiteHeader } from "../site-chrome";

export default function AnfragenPage() {
  const inquiry = useFormSubmit();

  return <main>
    <SiteHeader active="/anfragen" />

    <section className="page-intro">
      <p className="eyebrow">DU SUCHST ETWAS BESTIMMTES?</p>
      <h1>Wir helfen<br /><em>beim Finden.</em></h1>
      <p>Manche Karten liegen schon in unserer Sammlung, aber noch nicht im Shop. Schreib uns, wonach du suchst — ein Kundenkonto brauchst du dafür nicht, deine E-Mail-Adresse genügt.</p>
    </section>

    <section className="forms-section single">
      <div className="form-card">
        <p className="eyebrow">KONTAKT</p>
        <h2>Karte anfragen</h2>
        <p>Je genauer der Titel, desto schneller finden wir sie — Set, Spieler und Kartennummer helfen uns am meisten.</p>
        <form onSubmit={(event) => inquiry.run(event, async (form) => {
          const data = new FormData(form);
          return postJson("/api/inquiries", {
            ...botGuardPayload(form),
            title: data.get("title"),
            message: data.get("message"),
            email: data.get("email"),
          });
        })}>
          <BotGuardFields />
          <Field label="Kartentitel" name="title" placeholder="z. B. 2024 Topps Chrome UCC Lamine Yamal" />
          <label className="form-field">
            <span>Nachricht<b aria-hidden="true"> *</b></span>
            <textarea name="message" required maxLength={4000} rows={5} placeholder="Wonach suchst du? Zustand, Variante, Preisrahmen …" />
          </label>
          <Field label="E-Mail-Adresse" name="email" type="email" />
          <PrivacyNotice />
          <button className="button button-primary" type="submit" disabled={inquiry.pending}>
            {inquiry.pending ? "Wird gesendet …" : "Anfrage senden"}
          </button>
          <FormFeedback feedback={inquiry.feedback} />
        </form>
      </div>
    </section>

    <section className="cta-strip">
      <p>Vielleicht liegt sie schon im Bestand.</p>
      <Link className="button button-outline" href="/karten">Alle Karten ansehen <span>→</span></Link>
    </section>

    <SiteFooter />
  </main>;
}
