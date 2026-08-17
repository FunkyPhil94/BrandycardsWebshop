"use client";

import { useEffect, useRef, useState } from "react";
import { NurAngemeldet, useKontoSitzung } from "../account-shell";
import { ANGEBOT_STATUS, statusText } from "../status";
import { formatPrice } from "../../site-chrome";
import { useI18n } from "../../i18n";

type Angebot = {
  id: string;
  title: string;
  text: string | null;
  requestedAmountCents: number | null;
  currency: string;
  status: string;
  createdAt: string;
  assets: Array<{ id: string; originalName: string }>;
};

export default function KontoKartenangebotePage() {
  return <NurAngemeldet><Kartenangebote /></NurAngemeldet>;
}

function Kartenangebote() {
  const { user, token } = useKontoSitzung();
  const { t, locale } = useI18n();
  const [angebote, setAngebote] = useState<Angebot[] | null>(null);
  const [note, setNote] = useState("");
  const [bilder, setBilder] = useState<Record<string, string>>({});
  const objektUrls = useRef<string[]>([]);

  useEffect(() => {
    if (!user) return;
    let abgebrochen = false;
    void (async () => {
      try {
        const kopf = { Authorization: `Bearer ${await token()}` };
        const response = await fetch("/api/account/card-submissions", { headers: kopf });
        const body = await response.json() as { submissions?: Angebot[]; error?: string };
        if (!response.ok || !body.submissions) throw new Error(body.error ?? t("Deine Kartenangebote konnten nicht geladen werden."));
        if (abgebrochen) return;
        setAngebote(body.submissions);

        // Die Bilder liegen nicht öffentlich; jedes kommt angemeldet und wird
        // als Objekt-URL angezeigt. `blob:` ist in der CSP erlaubt, seit genau
        // das am 2026-08-17 im Adminbereich gefehlt hat.
        const eintraege = await Promise.all(body.submissions.flatMap((angebot) => angebot.assets.map(async (asset) => {
          const bild = await fetch(`/api/account/card-submissions/assets?assetId=${encodeURIComponent(asset.id)}`, { headers: kopf });
          if (!bild.ok) return null;
          return [asset.id, URL.createObjectURL(await bild.blob())] as const;
        })));
        const gefunden = eintraege.filter((eintrag): eintrag is readonly [string, string] => eintrag !== null);
        if (abgebrochen) {
          for (const [, url] of gefunden) URL.revokeObjectURL(url);
          return;
        }
        objektUrls.current = gefunden.map(([, url]) => url);
        setBilder(Object.fromEntries(gefunden));
      } catch (error) {
        if (!abgebrochen) setNote(error instanceof Error ? t(error.message) : t("Deine Kartenangebote konnten nicht geladen werden."));
      }
    })();
    return () => {
      abgebrochen = true;
      for (const url of objektUrls.current) URL.revokeObjectURL(url);
      objektUrls.current = [];
    };
  }, [t, token, user]);

  function datum(wert: string) {
    const zeit = new Date(wert);
    return Number.isNaN(zeit.getTime()) ? wert : zeit.toLocaleString(locale === "en" ? "en-GB" : "de-DE", { dateStyle: "medium", timeStyle: "short" });
  }

  return <section aria-labelledby="submissions-title">
    <h1 id="submissions-title">{t("Meine angebotenen Karten")}</h1>
    <p className="privacy-note">{t("Karten, die du uns zum Ankauf angeboten hast. Wir melden uns per E-Mail, sobald wir sie angesehen haben.")}</p>
    {note && <p className="form-feedback error" role="status">{note}</p>}
    {angebote === null && !note && <p className="privacy-note">{t("Kartenangebote werden geladen …")}</p>}
    {angebote?.length === 0 && <p className="privacy-note">{t("Du hast uns noch keine Karten angeboten.")}</p>}
    <div className="account-orders">
      {angebote?.map((angebot) => <article className="account-order" key={angebot.id}>
        <header className="account-order-head">
          <div><strong>{angebot.title}</strong><span>{datum(angebot.createdAt)}</span></div>
          <span className={`admin-order-status status-${angebot.status.toLowerCase()}`}>{t(statusText(ANGEBOT_STATUS, angebot.status))}</span>
        </header>
        <div className="account-order-body">
          <dl className="account-order-facts">
            <div><dt>{t("Deine Preisvorstellung")}</dt><dd>{typeof angebot.requestedAmountCents === "number"
              ? formatPrice(angebot.requestedAmountCents, angebot.currency, locale)
              : t("keine genannt")}</dd></div>
            <div><dt>{t("Bilder")}</dt><dd>{angebot.assets.length}</dd></div>
          </dl>
          {angebot.text && <p className="account-order-address">{angebot.text}</p>}
          <div className="admin-submission-images">
            {angebot.assets.map((asset) => bilder[asset.id]
              // eslint-disable-next-line @next/next/no-img-element
              ? <img key={asset.id} src={bilder[asset.id]} alt={`${t("Dein Bild zu")} ${angebot.title}`} loading="lazy" />
              : <span key={asset.id} className="admin-submission-image-broken">{t("Bild nicht abrufbar")}</span>)}
          </div>
        </div>
      </article>)}
    </div>
  </section>;
}
