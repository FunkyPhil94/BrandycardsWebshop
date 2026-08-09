"use client";

import { FormEvent, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase-browser";
import { formatPrice } from "../site-chrome";

type AdminProduct = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  origin: string;
  priceAmountCents: number | null;
  effectivePriceCents: number | null;
  priceCurrency: string;
  manualOverrides: string[];
  listingUrl: string | null;
  listingStatus: string | null;
  availableQuantity: number | null;
};

const FELDNAMEN: Record<string, string> = { title: "Titel", description: "Beschreibung", status: "Sichtbarkeit" };

async function authHeaders(json = false): Promise<HeadersInit> {
  const { data } = await getSupabaseBrowserClient().auth.getSession();
  const token = data.session?.access_token;
  return { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(json ? { "Content-Type": "application/json" } : {}) };
}

export function ProductsPanel() {
  const [products, setProducts] = useState<AdminProduct[] | null>(null);
  const [suche, setSuche] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [offen, setOffen] = useState<string | null>(null);
  const [anlegen, setAnlegen] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(`/api/admin/products?q=${encodeURIComponent(suche)}`, { headers: await authHeaders() });
        const data = await response.json() as { products?: AdminProduct[]; error?: string };
        if (!response.ok || !data.products) throw new Error(data.error ?? "Karten konnten nicht geladen werden.");
        if (!cancelled) setProducts(data.products);
      } catch (error) {
        if (cancelled) return;
        setNote(error instanceof Error ? error.message : "Karten konnten nicht geladen werden.");
        setProducts([]);
      }
    })();
    return () => { cancelled = true; };
  }, [reloadToken, suche]);

  async function speichern(event: FormEvent<HTMLFormElement>, product: AdminProduct) {
    event.preventDefault();
    const formular = new FormData(event.currentTarget);
    setBusy(product.id);
    setNote("");
    try {
      const manuell = product.origin === "MANUAL";
      const rumpf: Record<string, unknown> = {
        id: product.id,
        title: String(formular.get("title") ?? ""),
        description: String(formular.get("description") ?? ""),
        status: String(formular.get("status") ?? "ACTIVE"),
      };
      if (manuell) {
        rumpf.quantity = Number(formular.get("menge") ?? 0);
      }
      const response = await fetch("/api/admin/products", { method: "PATCH", headers: await authHeaders(true), body: JSON.stringify(rumpf) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Speichern fehlgeschlagen.");
      setNote(manuell
        ? "Gespeichert."
        : "Gespeichert. Die geänderten Felder sind als „von Hand gesetzt“ markiert — der eBay-Import lässt sie ab jetzt in Ruhe.");
      setReloadToken((wert) => wert + 1);
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Speichern fehlgeschlagen.");
    } finally {
      setBusy(null);
    }
  }

  async function markierungLoesen(product: AdminProduct, feld: string) {
    setBusy(product.id);
    try {
      const response = await fetch(`/api/admin/products?id=${product.id}&feld=${feld}`, { method: "DELETE", headers: await authHeaders() });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Fehlgeschlagen.");
      setNote(`„${FELDNAMEN[feld] ?? feld}“ folgt wieder eBay.`);
      setReloadToken((wert) => wert + 1);
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Fehlgeschlagen.");
    } finally {
      setBusy(null);
    }
  }

  async function neueKarte(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formular = new FormData(event.currentTarget);
    setBusy("neu");
    setNote("");
    try {
      const bilder = formular.getAll("images").filter((wert): wert is File => wert instanceof File && wert.size > 0);
      if (bilder.length > 2) throw new Error("Maximal zwei Bilder pro Vorverkaufskarte sind erlaubt.");
      const upload = new FormData();
      upload.set("title", String(formular.get("title") ?? ""));
      upload.set("description", String(formular.get("description") ?? ""));
      upload.set("quantity", String(formular.get("menge") ?? ""));
      for (const bild of bilder) upload.append("images", bild);
      const response = await fetch("/api/admin/products", {
        method: "POST", headers: await authHeaders(), body: upload,
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Anlegen fehlgeschlagen.");
      setNote("Karte angelegt. Sie steht ab sofort im Vorverkauf.");
      setAnlegen(false);
      setReloadToken((wert) => wert + 1);
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Anlegen fehlgeschlagen.");
    } finally {
      setBusy(null);
    }
  }

  if (!products) return null;

  return <section className="admin-section">
    <h2>Karten</h2>
    <div className="admin-products-toolbar">
      <input type="search" value={suche} placeholder="Nach Titel suchen …" onChange={(event) => setSuche(event.target.value)} />
      <button type="button" className="button button-outline" onClick={() => setAnlegen((wert) => !wert)}>
        {anlegen ? "Abbrechen" : "Karte von Hand einstellen"}
      </button>
    </div>
    {note && <p className="form-feedback" role="status">{note}</p>}

    {anlegen && <form className="admin-product-form" onSubmit={neueKarte}>
      <label className="form-field"><span>Titel *</span><input name="title" required maxLength={200} /></label>
      <label className="form-field"><span>Beschreibung</span><textarea name="description" rows={3} maxLength={4000} /></label>
      <div className="admin-product-row">
        <label className="form-field"><span>Menge *</span><input name="menge" type="number" min="1" max="99" defaultValue={1} required /></label>
      </div>
      <label className="form-field"><span>Bilder (max. 2, JPG/PNG/WebP)</span><input name="images" type="file" accept="image/jpeg,image/png,image/webp" multiple /></label>
      <p className="admin-product-hint">Kein Festpreis. Ein Artikel wird erst nach einem angenommenen Preisvorschlag kaufbar.</p>
      <button className="button button-primary" type="submit" disabled={busy === "neu"}>{busy === "neu" ? "Lege an …" : "Karte anlegen"}</button>
    </form>}

    {products.length === 0
      ? <p className="form-feedback">Keine Karte gefunden.</p>
      : <div className="admin-products">
          {products.map((product) => {
            const manuell = product.origin === "MANUAL";
            const aufgeklappt = offen === product.id;
            return <article className="admin-product" key={product.id}>
              <button type="button" className="admin-product-head" onClick={() => setOffen(aufgeklappt ? null : product.id)} aria-expanded={aufgeklappt}>
                <span className={`admin-product-origin${manuell ? " manuell" : ""}`}>{manuell ? "Vorverkauf" : "eBay"}</span>
                <span className="admin-product-title">{product.title}</span>
                <span>{formatPrice(product.effectivePriceCents, product.priceCurrency) ?? "Preis auf Anfrage"}</span>
                <span>{product.status === "ACTIVE" ? `${product.availableQuantity ?? 0} verfügbar` : product.status}</span>
              </button>
              {aufgeklappt && <div className="admin-product-body">
                {/* Die Markierungen gehören sichtbar über das Formular: Sonst
                    wundert sich der Betreiber, warum eine eBay-Korrektur an
                    diesem Feld nicht mehr ankommt. */}
                {product.manualOverrides.length > 0 && <p className="admin-product-marks">
                  Von Hand gesetzt: {product.manualOverrides.map((feld) => <button key={feld} type="button" onClick={() => void markierungLoesen(product, feld)} disabled={busy === product.id}>
                    {FELDNAMEN[feld] ?? feld} ×
                  </button>)}
                  <small>Diese Felder lässt der eBay-Import in Ruhe. Klick auf ein Feld gibt es wieder frei.</small>
                </p>}
                <form onSubmit={(event) => void speichern(event, product)}>
                  <label className="form-field"><span>Titel</span><input name="title" defaultValue={product.title} maxLength={200} required /></label>
                  <label className="form-field"><span>Beschreibung</span><textarea name="description" rows={3} maxLength={4000} defaultValue={product.description ?? ""} /></label>
                  <div className="admin-product-row">
                    <label className="form-field"><span>Sichtbarkeit</span>
                      <select name="status" defaultValue={product.status === "INACTIVE" ? "INACTIVE" : "ACTIVE"}>
                        <option value="ACTIVE">Im Shop sichtbar</option>
                        <option value="INACTIVE">Ausgeblendet</option>
                      </select>
                    </label>
                    {manuell && <label className="form-field"><span>Menge</span>
                      <input name="menge" type="number" min="0" max="99" defaultValue={product.availableQuantity ?? 0} required />
                    </label>}
                  </div>
                  {manuell
                    ? <p className="admin-product-hint">Kein Festpreis. Der Artikel wird erst nach einem angenommenen Preisvorschlag in den Warenkorb gelegt.</p>
                    : <p className="admin-product-hint">Preis und Menge kommen von eBay und lassen sich hier nicht ändern — der nächste Import würde sie ohnehin zurückschreiben.</p>}
                  <button className="button button-primary" type="submit" disabled={busy === product.id}>{busy === product.id ? "Speichere …" : "Speichern"}</button>
                </form>
                {product.listingUrl && <p className="admin-product-hint"><a href={product.listingUrl} target="_blank" rel="noreferrer">Angebot bei eBay ansehen ↗</a></p>}
              </div>}
            </article>;
          })}
        </div>}
  </section>;
}
