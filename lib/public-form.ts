import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { products } from "../db/schema";
import { HONEYPOT_FIELD, RENDERED_AT_FIELD, inspectSubmission } from "./form-bot-guard";
import { RateLimitError } from "./rate-limit";
import { readTextBody, RequestBodyError } from "./request-body";

export class PublicFormError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

type UnknownRecord = Record<string, unknown>;

export function publicDb() {
  try {
    return getDb();
  } catch {
    throw new PublicFormError(503, "DATABASE_UNAVAILABLE", "Der Dienst ist momentan nicht verfügbar.");
  }
}

export async function readJsonBody(request: Request): Promise<UnknownRecord> {
  assertSameOrigin(request);
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) {
    throw new PublicFormError(415, "UNSUPPORTED_MEDIA_TYPE", "Die Anfrage muss JSON verwenden.");
  }
  let rawBody: string;
  try {
    rawBody = await readTextBody(request, 64_000);
  } catch (error) {
    if (error instanceof RequestBodyError) {
      throw new PublicFormError(error.status, error.status === 413 ? "PAYLOAD_TOO_LARGE" : "INVALID_LENGTH", error.message);
    }
    throw new PublicFormError(400, "INVALID_JSON", "Die Anfrage muss gültiges JSON enthalten.");
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    throw new PublicFormError(400, "INVALID_JSON", "Die Anfrage muss gültiges JSON enthalten.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new PublicFormError(400, "INVALID_BODY", "Die Anfrage muss ein JSON-Objekt enthalten.");
  }
  return body as UnknownRecord;
}

/** Rejects the cheap automation the rate limit alone cannot tell apart from a
 *  customer. Deliberately answers like an ordinary validation error, so a bot
 *  learns nothing about why it was turned away. */
export function assertHumanSubmission(fields: { [HONEYPOT_FIELD]?: unknown; [RENDERED_AT_FIELD]?: unknown }, now = Date.now()) {
  const verdict = inspectSubmission(fields[HONEYPOT_FIELD], fields[RENDERED_AT_FIELD], now);
  if (verdict.human) return;
  throw new PublicFormError(400, "INVALID_INPUT", verdict.reason === "too-fast"
    ? "Das ging uns zu schnell. Bitte sende das Formular gleich noch einmal ab."
    : "Die Anfrage konnte nicht verarbeitet werden. Bitte lade die Seite neu und versuche es erneut.");
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return;
  try {
    if (new URL(origin).origin !== new URL(request.url).origin) throw new PublicFormError(403, "ORIGIN_NOT_ALLOWED", "Die Anfragequelle ist nicht erlaubt.");
  } catch (error) {
    if (error instanceof PublicFormError) throw error;
    throw new PublicFormError(403, "ORIGIN_NOT_ALLOWED", "Die Anfragequelle ist nicht erlaubt.");
  }
}

export function requiredString(body: UnknownRecord, key: string, label: string, maxLength: number): string {
  const value = body[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new PublicFormError(400, "INVALID_INPUT", `${label} ist erforderlich.`);
  }
  const result = value.trim();
  if (result.length > maxLength) {
    throw new PublicFormError(400, "INVALID_INPUT", `${label} ist zu lang.`);
  }
  return result;
}

export function optionalString(body: UnknownRecord, key: string, label: string, maxLength: number): string | null {
  const value = body[key];
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") {
    throw new PublicFormError(400, "INVALID_INPUT", `${label} ist ungültig.`);
  }
  const result = value.trim();
  if (result.length > maxLength) {
    throw new PublicFormError(400, "INVALID_INPUT", `${label} ist zu lang.`);
  }
  return result || null;
}

export function requiredEmail(body: UnknownRecord): string {
  const email = requiredString(body, "email", "E-Mail-Adresse", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u.test(email)) {
    throw new PublicFormError(400, "INVALID_EMAIL", "Bitte gib eine gültige E-Mail-Adresse an.");
  }
  return email;
}

export function optionalPrice(body: UnknownRecord, key: string): number | null {
  const value = body[key];
  if (value === undefined || value === null || value === "") return null;
  if ((typeof value !== "number" && typeof value !== "string") || typeof value === "boolean") {
    throw new PublicFormError(400, "INVALID_PRICE", "Der Preis ist ungültig.");
  }
  const normalized = typeof value === "string" ? value.trim().replace(",", ".") : value;
  const price = typeof normalized === "number" ? normalized : Number(normalized);
  if (!Number.isFinite(price) || price <= 0 || price > 1_000_000 || Math.round(price * 100) !== price * 100) {
    throw new PublicFormError(400, "INVALID_PRICE", "Der Preis muss positiv sein und maximal zwei Nachkommastellen haben.");
  }
  return price;
}

/** Eine Karte der Vormerkliste — und **nur** eine solche.
 *
 * **`kind === 'PRELISTED'` allein reicht dafür nicht mehr.** Seit `0006` tragen
 * von Hand eingestellte Karten dasselbe `kind`, weil die CHECK-Bedingung auf
 * `products.kind` auf D1 unveränderlich ist (Begründung im Kopf der Migration).
 * Die Vormerkliste erkennt man erst an **beidem**: `origin = 'EBAY'` und
 * `kind = 'PRELISTED'`.
 *
 * **Hier nichts über `kind` reparieren.** Wer die Spalte „aufräumt", zerstört
 * den Katalog. Siehe docs/pruefbericht-2026-08-09.md, S-06.
 */
function istVormerkliste(product: { kind: string; origin: string }) {
  return product.origin === "EBAY" && product.kind === "PRELISTED";
}

export async function existingProduct(productId: string, prelistedOnly = false) {
  if (!/^[a-f0-9]{32}$/iu.test(productId)) {
    throw new PublicFormError(400, "INVALID_PRODUCT", "Die Produktreferenz ist ungültig.");
  }
  let db;
  try {
    db = getDb();
  } catch {
    throw new PublicFormError(503, "DATABASE_UNAVAILABLE", "Der Dienst ist momentan nicht verfügbar.");
  }
  const result = await db.select().from(products).where(eq(products.id, productId)).limit(1);
  const product = result[0];
  // `prelistedOnly` bedient `/api/prelisted-interest` — „Vormerken" auf eine
  // Karte, die man sofort kaufen kann, ist keine Vormerkung, sondern eine
  // Anfrage ins Leere.
  if (!product || product.status !== "ACTIVE" || (prelistedOnly && !istVormerkliste(product))) {
    throw new PublicFormError(404, "PRODUCT_NOT_FOUND", "Die angegebene Karte ist nicht verfügbar.");
  }
  return { db, product };
}

export function formMetadata(title: string, message: string | null, extra: Record<string, unknown> = {}) {
  return JSON.stringify({ title, message, ...extra });
}

export function jsonError(error: unknown) {
  if (error instanceof RateLimitError) {
    return NextResponse.json({ ok: false, error: { code: error.code, message: error.message } }, { status: error.status, headers: { "retry-after": String(error.retryAfterSeconds) } });
  }
  if (error instanceof PublicFormError) {
    return NextResponse.json({ ok: false, error: { code: error.code, message: error.message } }, { status: error.status });
  }
  if (error instanceof Error && error.message.includes("D1 binding")) {
    return NextResponse.json({ ok: false, error: { code: "DATABASE_UNAVAILABLE", message: "Der Dienst ist momentan nicht verfügbar." } }, { status: 503 });
  }
  return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: "Die Anfrage konnte nicht verarbeitet werden." } }, { status: 500 });
}
