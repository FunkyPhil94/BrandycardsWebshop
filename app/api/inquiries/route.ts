import { NextResponse } from "next/server";
import { inquiries } from "../../../db/schema";
import {
  existingProduct,
  formMetadata,
  jsonError,
  optionalString,
  publicDb,
  readJsonBody,
  requiredEmail,
  requiredString,
} from "../../../lib/public-form";

export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request);
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
    return NextResponse.json({ ok: true, inquiryId: row?.id }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
