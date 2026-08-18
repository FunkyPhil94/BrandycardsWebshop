"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { NurAngemeldet, useKontoSitzung } from "../account-shell";
import { VORSCHLAG_STATUS, statusText } from "../status";
import { formatPrice } from "../../site-chrome";
import { useI18n } from "../../i18n";

type Vorschlag = {
  id: string;
  productId: string;
  title: string | null;
  amountCents: number;
  currency: string;
  status: string;
  message: string | null;
  createdAt: string;
  expiresAt: string | null;
};

export default function KontoPreisvorschlaegePage() {
  return <NurAngemeldet><Preisvorschlaege /></NurAngemeldet>;
}

function Preisvorschlaege() {
  const { user, token } = useKontoSitzung();
  const { t, locale } = useI18n();
  const [offers, setOffers] = useState<Vorschlag[] | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function zurueckziehen(offerId: string) {
    if (!window.confirm(t("Diesen Vorschlag zurückziehen? Der Versuch steht dir danach wieder zur Verfügung."))) return;
    setBusy(offerId);
    setNote("");
    try {
      const response = await fetch("/api/account/price-offers", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ offerId }),
      });
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? t("Der Vorschlag konnte nicht zurückgezogen werden."));
      setOffers((current) => current?.map((eintrag) => eintrag.id === offerId ? { ...eintrag, status: "WITHDRAWN" } : eintrag) ?? current);
    } catch (error) {
      setNote(error instanceof Error ? t(error.message) : t("Der Vorschlag konnte nicht zurückgezogen werden."));
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    if (!user) return;
    let abgebrochen = false;
    void (async () => {
      try {
        const response = await fetch("/api/account/price-offers", { headers: { Authorization: `Bearer ${await token()}` } });
        const body = await response.json() as { offers?: Vorschlag[]; error?: string };
        if (!response.ok || !body.offers) throw new Error(body.error ?? t("Deine Preisvorschläge konnten nicht geladen werden."));
        if (!abgebrochen) setOffers(body.offers);
      } catch (error) {
        if (!abgebrochen) setNote(error instanceof Error ? t(error.message) : t("Deine Preisvorschläge konnten nicht geladen werden."));
      }
    })();
    return () => { abgebrochen = true; };
  }, [t, token, user]);

  function datum(wert: string | null) {
    if (!wert) return null;
    const zeit = new Date(wert);
    return Number.isNaN(zeit.getTime()) ? wert : zeit.toLocaleString(locale === "en" ? "en-GB" : "de-DE", { dateStyle: "medium", timeStyle: "short" });
  }

  return <section aria-labelledby="offers-title">
    <h1 id="offers-title">{t("Meine Preisvorschläge")}</h1>
    {note && <p className="form-feedback error" role="status">{note}</p>}
    {offers === null && !note && <p className="privacy-note">{t("Preisvorschläge werden geladen …")}</p>}
    {offers?.length === 0 && <p className="privacy-note">{t("Du hast noch keinen Preis vorgeschlagen. Auf jeder Kartenseite steht der Kasten dafür.")}</p>}
    <div className="account-orders">
      {offers?.map((vorschlag) => {
        const angenommen = vorschlag.status === "ACCEPTED";
        const offen = vorschlag.status === "NEW" || vorschlag.status === "IN_REVIEW";
        return <article className="account-order" key={vorschlag.id}>
          <header className="account-order-head">
            <div>
              <strong>{vorschlag.title ?? t("Karte nicht mehr im Sortiment")}</strong>
              <span>{datum(vorschlag.createdAt)}</span>
            </div>
            <span className={`admin-order-status status-${vorschlag.status.toLowerCase()}`}>{t(statusText(VORSCHLAG_STATUS, vorschlag.status))}</span>
          </header>
          <div className="account-order-body">
            <dl className="account-order-facts">
              <div><dt>{t("Dein Vorschlag")}</dt><dd>{formatPrice(vorschlag.amountCents, vorschlag.currency, locale)}</dd></div>
              {angenommen && vorschlag.expiresAt && <div><dt>{t("Gültig bis")}</dt><dd>{datum(vorschlag.expiresAt)}</dd></div>}
            </dl>
            {vorschlag.message && <p className="account-order-address">{vorschlag.message}</p>}
            {/* Der angenommene Preis nützt nur, wenn man von hier aus zur Karte
                kommt — er gilt 48 Stunden und wird in der Kasse angewendet. */}
            {angenommen && <p className="account-tracking">
              <Link href={`/karten/${vorschlag.productId}`}>{t("Zur Karte")}</Link>
            </p>}
            {/* Zurückziehen geht nur, solange niemand entschieden hat — und es
                gibt den Versuch zurück, den der Vorschlag verbraucht hat. */}
            {offen && <p className="account-tracking">
              <button type="button" className="offer-withdraw" disabled={busy === vorschlag.id} onClick={() => void zurueckziehen(vorschlag.id)}>
                {busy === vorschlag.id ? t("Wird zurückgezogen …") : t("Vorschlag zurückziehen")}
              </button>
            </p>}
          </div>
        </article>;
      })}
    </div>
  </section>;
}
