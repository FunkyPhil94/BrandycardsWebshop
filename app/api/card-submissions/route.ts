import { NextResponse } from "next/server";
import { cardSubmissionAssets, cardSubmissions } from "../../../db/schema";
import { getAssetBucket, getDb } from "../../../db";
import { eq } from "drizzle-orm";
import { enforcePublicRateLimit } from "../../../lib/rate-limit";
import {
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
    await enforcePublicRateLimit(request, "card-submissions", 3);
    if (request.headers.get("content-type")?.startsWith("multipart/form-data")) {
      return await handleMultipartSubmission(request);
    }
    const body = await readJsonBody(request);
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
    return NextResponse.json({ ok: true, cardSubmissionId: row?.id, uploads: "METADATA_ONLY" }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

async function handleMultipartSubmission(request: Request) {
  assertSameOrigin(request);
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 52_000_000) throw new PublicFormError(413, "UPLOAD_TOO_LARGE", "Die gesamte Upload-Anfrage ist zu groß.");
  const form = await request.formData();
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
  return NextResponse.json({ ok: true, cardSubmissionId: submission.id, uploads: uploads.length }, { status: 201 });
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
