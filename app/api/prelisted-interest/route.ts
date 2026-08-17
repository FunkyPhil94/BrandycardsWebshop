import { NextResponse } from "next/server";
import { inquiries } from "../../../db/schema";
import {
  assertHumanSubmission,
  existingProduct,
  formMetadata,
  jsonError,
  optionalString,
  readJsonBody,
  requiredEmail,
  requiredString,
} from "../../../lib/public-form";
import { enforcePublicRateLimit } from "../../../lib/rate-limit";
import { notifySellerEvent } from "../../../lib/email/notify.ts";

export async function POST(request: Request) {
  try {
    await enforcePublicRateLimit(request, "prelisted-interest");
    const body = await readJsonBody(request);
    assertHumanSubmission(body);
    const email = requiredEmail(body);
    const productId = requiredString(body, "productId", "Produktreferenz", 64);
    const message = optionalString(body, "message", "Nachricht", 4000) ?? "Interesse an dieser Karte.";
    const { db, product } = await existingProduct(productId, true);
    const [row] = await db.insert(inquiries).values({
      productId,
      guestEmail: email,
      message: formMetadata(product.title, message),
    }).returning({ id: inquiries.id });
    // Auch eine Vormerkung ist eine Anfrage: Sie landet in derselben Liste im
    // Adminbereich und bliebe ohne diesen Hinweis genauso still liegen.
    await notifySellerEvent("Kartenanfrage", product.title, [
      { label: "Von", wert: email },
      { label: "Anlass", wert: "Vormerkung für eine Vorverkaufskarte" },
      { label: "Nachricht", wert: message },
    ], `prelisted:${row?.id ?? "unbekannt"}`);
    return NextResponse.json({ ok: true, inquiryId: row?.id }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
