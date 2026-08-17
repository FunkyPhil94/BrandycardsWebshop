import { NextResponse } from "next/server";
import { inquiries } from "../../../db/schema";
import {
  assertHumanSubmission,
  existingProduct,
  formMetadata,
  jsonError,
  optionalString,
  publicDb,
  readJsonBody,
  requiredEmail,
  requiredString,
} from "../../../lib/public-form";
import { notifyInquiryReceived, notifySellerEvent } from "../../../lib/email/notify.ts";
import { enforcePublicRateLimit } from "../../../lib/rate-limit";
import { localeFromRequest } from "../../../lib/i18n";

export async function POST(request: Request) {
  try {
    await enforcePublicRateLimit(request, "inquiries");
    const body = await readJsonBody(request);
    assertHumanSubmission(body);
    const email = requiredEmail(body);
    const title = requiredString(body, "title", "Kartentitel", 240);
    const message = requiredString(body, "message", "Nachricht", 4000);
    const name = optionalString(body, "name", "Name", 120);
    const productId = optionalString(body, "productId", "Produktreferenz", 64);
    const db = productId ? (await existingProduct(productId)).db : publicDb();
    const [row] = await db.insert(inquiries).values({
      productId,
      guestEmail: email,
      name,
      message: formMetadata(title, message),
    }).returning({ id: inquiries.id });
    // Nach dem Speichern, nie davor: Die Anfrage ist auch dann angekommen,
    // wenn die Bestätigung nicht hinausgeht.
    await notifyInquiryReceived(email, title, localeFromRequest(request));
    await notifySellerEvent("Kartenanfrage", title, [
      { label: "Von", wert: name ? `${name} · ${email}` : email },
      { label: "Nachricht", wert: message },
    ], `inquiry:${row?.id ?? "unbekannt"}`);
    return NextResponse.json({ ok: true, inquiryId: row?.id }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
