"use client";

import { useEffect, useState } from "react";
import { NurAngemeldet, useKontoSitzung } from "../account-shell";
import { formatPrice } from "../../site-chrome";
import { useI18n } from "../../i18n";

type AccountOrder = {
  id: string;
  orderNumber: string;
  status: string;
  currency: string;
  subtotalAmountCents: number;
  shippingAmountCents: number;
  totalAmountCents: number;
  shippingAddress: { name: string; street: string; postalCode: string; city: string; country: string } | null;
  createdAt: string;
  paidAt: string | null;
  shippedAt: string | null;
  shippingCarrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  refundedAt: string | null;
  items: Array<{ title: string; quantity: number; unitAmountCents: number; totalAmountCents: number }>;
  payments: Array<{ provider: string; status: string; amountCents: number; currency: string; createdAt: string }>;
};

const ORDER_STATUS_KEYS: Record<string, string> = {
  PENDING: "Offen",
  PAID: "Bezahlt",
  PROCESSING: "In Bearbeitung",
  SHIPPED: "Versendet",
  COMPLETED: "Abgeschlossen",
  CANCELLED: "Storniert",
  REFUNDED: "Erstattet",
};

function orderDate(value: string | null, locale: "de" | "en") {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(locale === "en" ? "en-GB" : "de-DE", { dateStyle: "medium", timeStyle: "short" });
}

export default function KontoBestellungenPage() {
  return <NurAngemeldet><Bestellungen /></NurAngemeldet>;
}

function Bestellungen() {
  const { user, token } = useKontoSitzung();
  const { t, locale } = useI18n();
  const [orders, setOrders] = useState<AccountOrder[] | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!user) return;
    let abgebrochen = false;
    void (async () => {
      try {
        const response = await fetch("/api/account/orders", { headers: { Authorization: `Bearer ${await token()}` } });
        const body = await response.json() as { orders?: AccountOrder[]; error?: string };
        if (!response.ok) throw new Error(body.error ?? t("Bestellungen konnten nicht geladen werden."));
        if (!abgebrochen) setOrders(body.orders ?? []);
      } catch (error) {
        if (!abgebrochen) setNote(error instanceof Error ? t(error.message) : t("Bestellungen konnten nicht geladen werden."));
      }
    })();
    return () => { abgebrochen = true; };
  }, [t, token, user]);

  return <section className="orders-history" aria-labelledby="orders-title">
    <h1 id="orders-title">{t("Meine Bestellungen")}</h1>
    {note && <p className="form-feedback error" role="status">{note}</p>}
    {orders === null && !note && <p className="privacy-note">{t("Bestellungen werden geladen …")}</p>}
    {orders?.length === 0 && <p className="privacy-note">{t("Du hast noch keine Bestellungen.")}</p>}
    <div className="account-orders">
      {orders?.map((order) => <article className="account-order" key={order.id}>
        <header className="account-order-head">
          <div><strong>{order.orderNumber}</strong><span>{orderDate(order.createdAt, locale)}</span></div>
          <span className={`admin-order-status status-${order.status.toLowerCase()}`}>{t(ORDER_STATUS_KEYS[order.status] ?? order.status)}</span>
        </header>
        <div className="account-order-body">
          <dl className="account-order-facts">
            <div><dt>{t("Bestellt am")}</dt><dd>{orderDate(order.createdAt, locale)}</dd></div>
            <div><dt>{t("Gesamt")}</dt><dd>{formatPrice(order.totalAmountCents, order.currency, locale)}</dd></div>
            <div><dt>{t("Zahlung")}</dt><dd>{order.paidAt ? t("Bezahlt") : t("Noch nicht bezahlt")}</dd></div>
            {order.shippedAt && <div><dt>{t("Versendet am")}</dt><dd>{orderDate(order.shippedAt, locale)}</dd></div>}
            {order.completedAt && <div><dt>{t("Abgeschlossen am")}</dt><dd>{orderDate(order.completedAt, locale)}</dd></div>}
          </dl>
          <ul className="account-order-items">
            {order.items.map((item, index) => <li key={`${order.id}-${index}`}><span>{item.quantity} × {item.title}</span><strong>{formatPrice(item.totalAmountCents, order.currency, locale)}</strong></li>)}
          </ul>
          {order.trackingNumber && <p className="account-tracking">
            {order.shippingCarrier && <span>{order.shippingCarrier} · </span>}
            {order.trackingUrl ? <a href={order.trackingUrl} target="_blank" rel="noreferrer">{t("Sendung verfolgen")}</a> : <span>{order.trackingNumber}</span>}
          </p>}
          {order.shippingAddress && <address className="account-order-address">
            <strong>{t("Lieferadresse")}</strong><br />
            {order.shippingAddress.name}<br />{order.shippingAddress.street}<br />
            {order.shippingAddress.postalCode} {order.shippingAddress.city}<br />{order.shippingAddress.country}
          </address>}
        </div>
      </article>)}
    </div>
  </section>;
}
