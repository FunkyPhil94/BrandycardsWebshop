import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getAssetBucket, getDb } from "../../../../db";
import { cardSubmissionAssets, cardSubmissions } from "../../../../db/schema";
import { requireAdmin } from "../../../../lib/admin-access";

export async function DELETE(request: Request) {
  const access = await requireAdmin(request);
  if (access.response) return access.response;
  const submissionId = new URL(request.url).searchParams.get("submissionId");
  if (!submissionId || !/^[a-f0-9]{32}$/iu.test(submissionId)) return NextResponse.json({ error: "Ungültige Angebotsreferenz." }, { status: 400 });
  try {
    const db = getDb();
    const assets = await db.select({ storageKey: cardSubmissionAssets.storageKey }).from(cardSubmissionAssets).where(eq(cardSubmissionAssets.submissionId, submissionId));
    await Promise.all(assets.map((asset) => getAssetBucket().delete(asset.storageKey)));
    await db.delete(cardSubmissions).where(eq(cardSubmissions.id, submissionId));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Admin submission deletion failed", error);
    return NextResponse.json({ error: "Das Kartenangebot konnte nicht gelöscht werden." }, { status: 503 });
  }
}
