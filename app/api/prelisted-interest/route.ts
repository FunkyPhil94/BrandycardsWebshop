import { NextResponse } from "next/server";
import { inquiries } from "../../../db/schema";
import {
  existingProduct,
  formMetadata,
  jsonError,
  optionalString,
  readJsonBody,
  requiredEmail,
  requiredString,
} from "../../../lib/public-form";

export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request);
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
