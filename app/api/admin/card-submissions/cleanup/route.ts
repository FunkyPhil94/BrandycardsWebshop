import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/admin-access";
import { cleanupOrphanedCardSubmissionAssets, deleteExpiredCardSubmissions } from "../../../../../lib/card-submission-cleanup";

/** Beide Aufräumläufe von Hand auslösbar. Der geplante Lauf macht dasselbe —
 *  das hier ist für den Fall, dass man nicht bis zur nächsten Stunde warten
 *  will. */
export async function POST(request: Request) {
  const access = await requireAdmin(request, { recentAuthSeconds: 600 });
  if (access.response) return access.response;
  try {
    const retention = await deleteExpiredCardSubmissions();
    const orphans = await cleanupOrphanedCardSubmissionAssets();
    return NextResponse.json({ ok: true, ...orphans, retention });
  } catch (error) {
    console.error("Card submission cleanup failed", error);
    return NextResponse.json({ error: "Bereinigung fehlgeschlagen." }, { status: 503 });
  }
}
