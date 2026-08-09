import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getAssetBucket, getDb } from "../../../../db";
import { cardSubmissionAssets, cardSubmissions, submissionStatusValues } from "../../../../db/schema";
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

/** Setzt den Bearbeitungsstand eines Kartenangebots.
 *
 * Bis zum 2026-08-09 gab es hier nur „löschen" — dazwischen lag nichts. Wer ein
 * Angebot prüfte, konnte das nirgends festhalten, und beim nächsten Blick in
 * die Liste stand alles wieder auf `NEW`.
 *
 * **Der Status entscheidet zusätzlich über die Löschfrist:** Der geplante Lauf
 * räumt abgeschlossene Angebote nach 90 Tagen ab
 * (`DELETABLE_SUBMISSION_STATUSES` in `lib/retention.ts`). Ein Angebot auf
 * `REJECTED` oder `CLOSED` zu setzen, startet also die Uhr — deshalb steht das
 * auch in der Oberfläche daneben.
 */
export async function PATCH(request: Request) {
  const access = await requireAdmin(request);
  if (access.response) return access.response;

  try {
    const body = await request.json() as { submissionId?: unknown; status?: unknown };
    const submissionId = typeof body.submissionId === "string" && /^[a-f0-9]{32}$/iu.test(body.submissionId) ? body.submissionId : null;
    const status = (submissionStatusValues as readonly string[]).includes(String(body.status))
      ? String(body.status) as (typeof submissionStatusValues)[number] : null;
    if (!submissionId || !status) return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });

    const result = await getDb().update(cardSubmissions)
      .set({ status, updatedAt: new Date().toISOString() })
      .where(eq(cardSubmissions.id, submissionId));
    if (result.meta.changes !== 1) return NextResponse.json({ error: "Unbekanntes Kartenangebot." }, { status: 404 });
    return NextResponse.json({ ok: true, status });
  } catch (error) {
    console.error("Admin submission update failed", error);
    return NextResponse.json({ error: "Der Stand konnte nicht gespeichert werden." }, { status: 503 });
  }
}
