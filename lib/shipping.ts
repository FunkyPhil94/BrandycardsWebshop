const CARRIER_URLS: Record<string, string> = {
  DHL: "https://www.dhl.de/de/privatkunden/dhl-sendungen/track-and-trace.html?piececode=",
  DEUTSCHE_POST: "https://www.deutschepost.de/de/s/sendungen/status.html?piececode=",
  HERMES: "https://www.myhermes.de/empfangen/sendungen-verfolgen/?suche=",
  DPD: "https://tracking.dpd.de/status/de_DE/parcel/",
  GLS: "https://gls-group.com/DE/de/paketverfolgung?match=",
  UPS: "https://www.ups.com/track?loc=de_DE&tracknum=",
};

const CARRIER_LABELS: Record<string, string> = {
  DHL: "DHL",
  DEUTSCHE_POST: "Deutsche Post",
  HERMES: "Hermes",
  DPD: "DPD",
  GLS: "GLS",
  UPS: "UPS",
};

/** Nur bekannte Anbieter werden als Link ausgegeben. So kann ein Adminfeld
 * keinen beliebigen externen Link in Kundenkonto oder E-Mail einschleusen. */
export function normalizeShippingCarrier(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const key = value.trim().toUpperCase().replaceAll(" ", "_");
  return key in CARRIER_LABELS ? key : null;
}

/** Trackingnummern werden als kurze, druckbare Kennung gespeichert. */
export function normalizeTrackingNumber(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const number = value.trim();
  if (!number) return null;
  return /^[A-Za-z0-9][A-Za-z0-9 ._/-]{1,79}$/u.test(number) ? number : null;
}

export function shippingCarrierLabel(value: string | null | undefined): string | null {
  return value ? CARRIER_LABELS[value] ?? null : null;
}

export function trackingUrl(carrier: string | null | undefined, trackingNumber: string | null | undefined): string | null {
  if (!carrier || !trackingNumber) return null;
  const base = CARRIER_URLS[carrier];
  return base ? `${base}${encodeURIComponent(trackingNumber)}` : null;
}
