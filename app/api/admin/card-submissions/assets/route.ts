import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getAssetBucket, getDb } from "../../../../../db";
import { cardSubmissionAssets } from "../../../../../db/schema";
import { requireAdmin } from "../../../../../lib/admin-access";

export async function GET(request: Request) {
  const access = await requireAdmin(request);
  if (access.response) return access.response;
  const assetId = new URL(request.url).searchParams.get("assetId");
  if (!assetId || !/^[a-f0-9]{32}$/iu.test(assetId)) return NextResponse.json({ error: "Ungültige Bildreferenz." }, { status: 400 });
  try {
    const db = getDb();
    const [asset] = await db.select().from(cardSubmissionAssets).where(eq(cardSubmissionAssets.id, assetId)).limit(1);
    if (!asset) return NextResponse.json({ error: "Bild nicht gefunden." }, { status: 404 });
    const object = await getAssetBucket().get(asset.storageKey);
    if (!object) return NextResponse.json({ error: "Bild nicht verfügbar." }, { status: 404 });
    return new Response(object.body, {
      headers: {
        "content-type": asset.mimeType,
        "content-length": String(asset.byteSize),
        "cache-control": "private, no-store, max-age=0",
        "content-disposition": `inline; filename="${asset.id}.${asset.mimeType === "image/jpeg" ? "jpg" : asset.mimeType.slice(6)}"`,
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Admin asset access failed", error);
    return NextResponse.json({ error: "Bild konnte nicht geladen werden." }, { status: 503 });
  }
}
