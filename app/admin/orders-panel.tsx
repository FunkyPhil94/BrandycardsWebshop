"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase-browser";
import { formatPrice } from "../site-chrome";

type AdminOrder = {
  id: string;
  orderNumber: string;
  status: string;
  currency: string;
  subtotalAmountCents: number;
  shippingAmountCents: number;
  totalAmountCents: number;
  createdAt: string;
  paidAt: string | null;
  email: string | null;
  shippingAddress: { name: string; street: string; postalCode: string; city: string; country: string } | null;
  items: Array<{ title: string; quantity: number; unitAmountCents: number; totalAmountCents: number }>;
  payments: Array<{ provider: string; status: string; providerCaptureId: string | null }>;
};

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await getSupabaseBrowserClient().auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function formatDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" });
}

export function OrdersPanel() {
  const [orders, setOrders] = useState<AdminOrder[] | null>(null);
  const [note, setNote] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/admin/orders", { headers: await authHeaders() });
        const data = await response.json() as { orders?: AdminOrder[]; error?: string };
        if (!response.ok || !data.orders) throw new Error(data.error ?? "Bestellungen konnten nicht geladen werden.");
        if (!cancelled) setOrders(data.orders);
      } catch (error) {
        if (cancelled) return;
        setNote(error instanceof Error ? error.message : "Bestellungen konnten nicht geladen werden.");
        setOrders([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!orders) return null;

  return <section className="admin-section">
    <h2>Bestellungen ({orders.length})</h2>
    {note && <p className="form-feedback" role="status">{note}</p>}
    {orders.length === 0
      ? <p className="form-feedback">Noch keine Bestellungen.</p>
      : <div className="admin-orders">
          {orders.map((order) => {
            const expanded = open === order.id;
            // Der jüngste Zahlungssatz steht zuletzt in der Liste; für die
            // Kopfzeile zählt er, weil ein zweiter Versuch den ersten ablöst.
            const payment = order.payments.at(-1);
            return <article className={`admin-order${expanded ? " is-open" : ""}`} key={order.id}>
              <button type="button" className="admin-order-head" onClick={() => setOpen(expanded ? null : order.id)} aria-expanded={expanded}>
                <span className="admin-order-number">{order.orderNumber}</span>
                <span className={`admin-order-status status-${order.status.toLowerCase()}`}>{order.status}</span>
                <span>{order.email ?? "unbekannt"}</span>
                <span>{formatPrice(order.totalAmountCents, order.currency)}</span>
                <span>{formatDate(order.createdAt)}</span>
              </button>
              {expanded && <div className="admin-order-body">
                <ul className="admin-order-items">
                  {order.items.map((item, index) => <li key={index}>
                    <span>{item.quantity}× {item.title}</span>
                    <span>{formatPrice(item.totalAmountCents, order.currency)}</span>
                  </li>)}
                </ul>
                <dl className="admin-order-facts">
                  <div><dt>Zwischensumme</dt><dd>{formatPrice(order.subtotalAmountCents, order.currency)}</dd></div>
                  <div><dt>Versand</dt><dd>{formatPrice(order.shippingAmountCents, order.currency)}</dd></div>
                  <div><dt>Gesamt</dt><dd>{formatPrice(order.totalAmountCents, order.currency)}</dd></div>
                  <div><dt>Bezahlt</dt><dd>{formatDate(order.paidAt) ?? "—"}</dd></div>
                  <div><dt>Zahlung</dt><dd>{payment ? `${payment.provider} · ${payment.status}` : "keine"}</dd></div>
                  {/* Die Capture-Id ist der Faden zum PayPal-Konto: ohne sie
                      lässt sich eine Rückerstattung dort nicht zuordnen. */}
                  {payment?.providerCaptureId && <div><dt>Capture-Id</dt><dd className="admin-order-mono">{payment.providerCaptureId}</dd></div>}
                </dl>
                {order.shippingAddress
                  ? <address className="admin-order-address">
                      {order.shippingAddress.name}<br />
                      {order.shippingAddress.street}<br />
                      {order.shippingAddress.postalCode} {order.shippingAddress.city}<br />
                      {order.shippingAddress.country}
                    </address>
                  : <p className="form-feedback">Keine vollständige Lieferadresse hinterlegt.</p>}
              </div>}
            </article>;
          })}
        </div>}
  </section>;
}
