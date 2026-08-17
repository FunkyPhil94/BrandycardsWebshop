import { NextResponse } from "next/server";
import { cardSubmissionAssets, cardSubmissions } from "../../../db/schema";
import { getAssetBucket, getDb } from "../../../db";
import { eq } from "drizzle-orm";
import { notifyCardSubmissionReceived, notifySellerEvent } from "../../../lib/email/notify.ts";
import { enforcePublicRateLimit } from "../../../lib/rate-limit";
import { localeFromRequest } from "../../../lib/i18n";
import { HONEYPOT_FIELD, RENDERED_AT_FIELD } from "../../../lib/form-bot-guard";
import {
  assertHumanSubmission,
  formMetadata,
  jsonError,
  optionalPrice,
  optionalString,
  publicDb,
  PublicFormError,
  assertSameOrigin,
  readJsonBody,
  requiredEmail,
  requiredString,
} from "../../../lib/public-form";

export async function POST(request: Request) {
  try {
    await enforcePublicRateLimit(request, "card-submissions", "strict");
    if (request.headers.get("content-type")?.startsWith("multipart/form-data")) {
      return await handleMultipartSubmission(request);
    }
    const body = await readJsonBody(request);
    assertHumanSubmission(body);
    const email = requiredEmail(body);
    const title = requiredString(body, "title", "Kartentitel", 240);
    const name = optionalString(body, "name", "Name", 120);
    const message = optionalString(body, "message", "Nachricht", 4000);
    const requestedAmount = optionalPrice(body, "price");
    const imageMetadata = validateImageMetadata(body.images);
    const db = publicDb();
    const [row] = await db.insert(cardSubmissions).values({
      guestEmail: email,
      name,
      requestedAmountCents: requestedAmount === null ? null : Math.round(requestedAmount * 100),
      message: formMetadata(title, message, { imageMetadata }),
    }).returning({ id: cardSubmissions.id });
    await notifySellerEvent("Kartenangebot", title, [
      { label: "Von", wert: name ? `${name} · ${email}` : email },
      { label: "Preisvorstellung", wert: preistext(requestedAmount) },
      { label: "Bilder", wert: `${imageMetadata.length} (nur Angaben, ohne Dateien)` },
      ...(message ? [{ label: "Nachricht", wert: message }] : []),
    ], `card-submission:${row?.id ?? "unbekannt"}`);
    return NextResponse.json({ ok: true, cardSubmissionId: row?.id, uploads: "METADATA_ONLY" }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

async function handleMultipartSubmission(request: Request) {
  assertSameOrigin(request);
  // A missing Content-Length used to read as 0 and sail past the ceiling —
  // and `formData()` below buffers the whole body before any per-file check
  // runs, so a chunked request could push the isolate over its memory limit.
  // Demanding the header costs a legitimate upload nothing: every browser
  // sends it for multipart. See docs/security-findings.md, SEC-08.
  const declaredLength = request.headers.get("content-length");
  if (declaredLength === null) throw new PublicFormError(411, "LENGTH_REQUIRED", "Die Anfrage muss ihre Größe angeben.");
  const contentLength = Number(declaredLength);
  if (!Number.isFinite(contentLength) || contentLength < 0) throw new PublicFormError(400, "INVALID_LENGTH", "Die angegebene Anfragegröße ist ungültig.");
  if (contentLength > 52_000_000) throw new PublicFormError(413, "UPLOAD_TOO_LARGE", "Die gesamte Upload-Anfrage ist zu groß.");
  const form = await request.formData();
  assertHumanSubmission({ [HONEYPOT_FIELD]: form.get(HONEYPOT_FIELD), [RENDERED_AT_FIELD]: form.get(RENDERED_AT_FIELD) });
  const email = requiredEmail({ email: form.get("email") });
  const title = requiredString({ title: form.get("title") }, "title", "Kartentitel", 240);
  const name = optionalString({ name: form.get("name") }, "name", "Name", 120);
  const message = optionalString({ message: form.get("message") }, "message", "Nachricht", 4000);
  const rawPrice = form.get("price");
  const requestedAmount = optionalPrice({ price: typeof rawPrice === "string" ? rawPrice : undefined }, "price");
  const files = form.getAll("images").filter((value): value is File => value instanceof File);
  if (files.length > 5) throw new PublicFormError(400, "TOO_MANY_UPLOADS", "Maximal fünf Bilder sind erlaubt.");
  const declaredFileBytes = files.reduce((total, file) => total + file.size, 0);
  if (declaredFileBytes > 50_000_000) throw new PublicFormError(413, "UPLOAD_TOO_LARGE", "Die Bilder sind zusammen zu groß.");
  const uploads = await Promise.all(files.map(validateAndReadImage));
  if (uploads.reduce((total, upload) => total + upload.bytes.byteLength, 0) > 50_000_000) throw new PublicFormError(413, "UPLOAD_TOO_LARGE", "Die Bilder sind zusammen zu groß.");
  const db = getDb();
  const bucket = getAssetBucket();
  const [submission] = await db.insert(cardSubmissions).values({
    guestEmail: email,
    name,
    requestedAmountCents: requestedAmount === null ? null : Math.round(requestedAmount * 100),
    message: formMetadata(title, message),
  }).returning({ id: cardSubmissions.id });
  if (!submission) throw new PublicFormError(503, "SUBMISSION_FAILED", "Das Angebot konnte nicht gespeichert werden.");
  const storedKeys: string[] = [];
  try {
    for (const upload of uploads) {
      const storageKey = `card-submissions/${submission.id}/${crypto.randomUUID()}.${upload.extension}`;
      await bucket.put(storageKey, upload.bytes, { httpMetadata: { contentType: upload.mimeType } });
      storedKeys.push(storageKey);
      await db.insert(cardSubmissionAssets).values({ submissionId: submission.id, storageKey, originalName: upload.originalName, mimeType: upload.mimeType, byteSize: upload.bytes.byteLength });
    }
  } catch (error) {
    console.error("Card submission upload failed", error);
    await Promise.allSettled(storedKeys.map((storageKey) => bucket.delete(storageKey)));
    await db.delete(cardSubmissionAssets).where(eq(cardSubmissionAssets.submissionId, submission.id));
    await db.delete(cardSubmissions).where(eq(cardSubmissions.id, submission.id));
    throw new PublicFormError(503, "UPLOAD_FAILED", "Die Bilder konnten nicht sicher gespeichert werden.");
  }
  // Erst hier, nachdem auch die Bilder sicher liegen: Der Pfad darüber räumt
  // das Angebot bei einem Uploadfehler wieder ab — eine Bestätigung für etwas,
  // das gleich wieder gelöscht wird, wäre schlimmer als keine.
  await notifyCardSubmissionReceived(email, title, localeFromRequest(request));
  await notifySellerEvent("Kartenangebot", title, [
    { label: "Von", wert: name ? `${name} · ${email}` : email },
    { label: "Preisvorstellung", wert: preistext(requestedAmount) },
    { label: "Bilder", wert: `${uploads.length}` },
    ...(message ? [{ label: "Nachricht", wert: message }] : []),
  ], `card-submission:${submission.id}`);
  return NextResponse.json({ ok: true, cardSubmissionId: submission.id, uploads: uploads.length }, { status: 201 });
}

/** Die Preisvorstellung für die Betreibernachricht.
 *
 * „Keine genannt" muss ausgeschrieben dastehen: Das Feld ist freiwillig, und
 * eine leere Zeile wäre in einer E-Mail nicht von einem Fehler zu unterscheiden.
 */
function preistext(betrag: number | null) {
  return betrag === null ? "keine genannt" : new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(betrag);
}

async function validateAndReadImage(file: File) {
  if (file.size < 1 || file.size > 10_000_000) throw new PublicFormError(400, "INVALID_UPLOAD", "Jedes Bild muss zwischen 1 Byte und 10 MB groß sein.");
  const mimeType = file.type.toLowerCase();
  if (!/^image\/(jpeg|png|webp)$/u.test(mimeType)) throw new PublicFormError(400, "INVALID_UPLOAD", "Nur JPG-, PNG- und WebP-Bilder sind erlaubt.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const valid = mimeType === "image/jpeg"
    ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    : mimeType === "image/png"
      ? bytes.slice(0, 8).every((value, index) => value === [137, 80, 78, 71, 13, 10, 26, 10][index])
      : new TextDecoder().decode(bytes.slice(0, 12)).startsWith("RIFF") && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
  if (!valid) throw new PublicFormError(400, "INVALID_UPLOAD", "Der tatsächliche Bildtyp stimmt nicht mit der Dateiendung überein.");
  const originalName = file.name.split(/[\\/]/u).pop()?.replace(/[^a-zA-Z0-9._-]/gu, "_").slice(0, 180) || "bild";
  return { bytes, mimeType, originalName, extension: mimeType === "image/jpeg" ? "jpg" : mimeType.slice("image/".length) };
}

function validateImageMetadata(value: unknown) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 5) {
    throw new PublicFormError(400, "INVALID_UPLOAD_METADATA", "Maximal fünf Bild-Metadaten sind erlaubt.");
  }
  return value.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new PublicFormError(400, "INVALID_UPLOAD_METADATA", "Die Bild-Metadaten sind ungültig.");
    }
    const record = item as Record<string, unknown>;
    const name = typeof record.name === "string" ? record.name.trim() : "";
    const mimeType = typeof record.mimeType === "string" ? record.mimeType.trim().toLowerCase() : "";
    const size = record.size;
    if (!name || name.length > 180 || !/^image\/(jpeg|png|webp)$/u.test(mimeType) || typeof size !== "number" || !Number.isInteger(size) || size < 1 || size > 10_000_000) {
      throw new PublicFormError(400, "INVALID_UPLOAD_METADATA", "Die Bild-Metadaten sind ungültig.");
    }
    return { name, mimeType, size };
  });
}
