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
    return NextResponse.json({ ok: true, inquiryId: row?.id }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
