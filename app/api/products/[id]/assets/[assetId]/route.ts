import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getAssetBucket, getDb } from "../../../../../../db";
import { productAssets, products } from "../../../../../../db/schema";

export async function GET(_request: Request, context: { params: Promise<{ id: string; assetId: string }> }) {
  const { id, assetId } = await context.params;
  if (!/^[a-f0-9]{32}$/iu.test(id) || !/^[a-f0-9]{32}$/iu.test(assetId)) {
    return NextResponse.json({ error: "Ungültige Bildreferenz." }, { status: 404 });
  }

  try {
    const [asset] = await getDb().select({
      storageKey: productAssets.storageKey,
      mimeType: productAssets.mimeType,
      byteSize: productAssets.byteSize,
    }).from(productAssets)
      .innerJoin(products, eq(products.id, productAssets.productId))
      .where(and(
        eq(productAssets.id, assetId),
        eq(productAssets.productId, id),
        eq(productAssets.isPublic, true),
        eq(products.origin, "MANUAL"),
        eq(products.status, "ACTIVE"),
      ))
      .limit(1);

    if (!asset) return NextResponse.json({ error: "Bild nicht gefunden." }, { status: 404 });
    const object = await getAssetBucket().get(asset.storageKey);
    if (!object) return NextResponse.json({ error: "Bild nicht verfügbar." }, { status: 404 });

    return new Response(object.body, {
      headers: {
        "content-type": asset.mimeType ?? "application/octet-stream",
        ...(asset.byteSize ? { "content-length": String(asset.byteSize) } : {}),
        "cache-control": "public, max-age=31536000, immutable",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Product asset access failed", error);
    return NextResponse.json({ error: "Bild konnte nicht geladen werden." }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
