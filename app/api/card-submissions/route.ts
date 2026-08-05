import { NextResponse } from "next/server";
import { cardSubmissions } from "../../../db/schema";
import {
  formMetadata,
  jsonError,
  optionalPrice,
  optionalString,
  publicDb,
  PublicFormError,
  readJsonBody,
  requiredEmail,
  requiredString,
} from "../../../lib/public-form";

export async function POST(request: Request) {
  try {
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
