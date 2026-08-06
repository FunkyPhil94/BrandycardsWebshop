import { NextResponse } from "next/server";
import { priceOffers } from "../../../db/schema";
import {
  PublicFormError,
  existingProduct,
  formMetadata,
  jsonError,
  optionalPrice,
  optionalString,
  readJsonBody,
  requiredEmail,
  requiredString,
} from "../../../lib/public-form";
import { enforcePublicRateLimit } from "../../../lib/rate-limit";

export async function POST(request: Request) {
  try {
    await enforcePublicRateLimit(request, "price-offers");
    const body = await readJsonBody(request);
    const email = requiredEmail(body);
    const productId = requiredString(body, "productId", "Produktreferenz", 64);
    const title = requiredString(body, "title", "Kartentitel", 240);
    const proposedAmount = optionalPrice(body, "price");
    if (proposedAmount === null) {
      throw new PublicFormError(400, "INVALID_PRICE", "Der Preis ist erforderlich.");
    }
    const message = optionalString(body, "message", "Nachricht", 4000);
    const { db } = await existingProduct(productId, true);
    const inserted = await db.insert(priceOffers).values({
      productId,
      guestEmail: email,
      proposedAmountCents: Math.round(proposedAmount * 100),
      message: formMetadata(title, message),
    }).returning({ id: priceOffers.id });
    return NextResponse.json({ ok: true, priceOfferId: inserted[0]?.id }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
