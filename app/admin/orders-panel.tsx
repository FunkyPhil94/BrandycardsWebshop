"use client";

import { useEffect, useState } from "react";
import { authHeaders } from "./admin-auth";
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

type OrdersResponse = { orders?: AdminOrder[]; error?: string; page?: number; pageSize?: number; total?: number; totalPages?: number };

const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: "Offen",
  PAID: "Bezahlt",
  PROCESSING: "In Bearbeitung",
  SHIPPED: "Versendet",
  COMPLETED: "Abgeschlossen",
  CANCELLED: "Storniert",
  REFUNDED: "Erstattet",
};

function formatDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" });
}

function statusLabel(status: string) {
  return ORDER_STATUS_LABELS[status] ?? status;
}

export function OrdersPanel() {
  const [orders, setOrders] = useState<AdminOrder[] | null>(null);
  const [note, setNote] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageInfo, setPageInfo] = useState({ page: 1, pageSize: 25, total: 0, totalPages: 1 });
  const [updatingOrder, setUpdatingOrder] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(`/api/admin/orders?page=${page}`, { headers: await authHeaders() });
        const data = await response.json() as OrdersResponse;
        if (!response.ok || !data.orders) throw new Error(data.error ?? "Bestellungen konnten nicht geladen werden.");
        if (!cancelled) {
          const nextPageInfo = {
            page: data.page ?? page,
            pageSize: data.pageSize ?? 25,
            total: data.total ?? data.orders.length,
            totalPages: data.totalPages ?? 1,
          };
          setOrders(data.orders);
          setPageInfo(nextPageInfo);
          if (nextPageInfo.page !== page) setPage(nextPageInfo.page);
        }
      } catch (error) {
        if (cancelled) return;
        setNote(error instanceof Error ? error.message : "Bestellungen konnten nicht geladen werden.");
        setOrders([]);
      }
    })();
    return () => { cancelled = true; };
  }, [page]);

  async function markShipped(orderId: string) {
    setUpdatingOrder(orderId);
    setNote("");
    try {
      const response = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: await authHeaders(true, true),
        body: JSON.stringify({ orderId, status: "SHIPPED" }),
      });
      const data = await response.json() as { status?: string; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Bestellung konnte nicht aktualisiert werden.");
      setOrders((current) => current?.map((order) => order.id === orderId ? { ...order, status: data.status ?? "SHIPPED" } : order) ?? current);
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Bestellung konnte nicht aktualisiert werden.");
    } finally {
      setUpdatingOrder(null);
    }
  }

  if (!orders) return null;

  return <section className="admin-section">
    <div className="admin-orders-heading">
      <h2>Bestellungen ({pageInfo.total})</h2>
      {pageInfo.totalPages > 1 && <span>Seite {pageInfo.page} von {pageInfo.totalPages}</span>}
    </div>
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
                <span className={`admin-order-status status-${order.status.toLowerCase()}`}>{statusLabel(order.status)}</span>
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
                {(order.status === "PAID" || order.status === "PROCESSING") && <button className="button button-outline admin-order-ship" type="button" onClick={() => void markShipped(order.id)} disabled={updatingOrder === order.id}>
                  {updatingOrder === order.id ? "Wird gespeichert …" : "Als versendet markieren"}
                </button>}
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
    {pageInfo.totalPages > 1 && <nav className="admin-orders-pagination" aria-label="Bestellseiten">
      <button className="button button-outline" type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={pageInfo.page <= 1}>Zurück</button>
      <span>Seite {pageInfo.page} / {pageInfo.totalPages}</span>
      <button className="button button-outline" type="button" onClick={() => setPage((current) => Math.min(pageInfo.totalPages, current + 1))} disabled={pageInfo.page >= pageInfo.totalPages}>Weiter</button>
    </nav>}
  </section>;
}
