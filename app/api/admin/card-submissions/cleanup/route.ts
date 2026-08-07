import { NextResponse } from "next/server";
import { getAuthenticatedAppUser } from "../../../../../lib/app-user";
import { cleanupOrphanedCardSubmissionAssets, deleteExpiredCardSubmissions } from "../../../../../lib/card-submission-cleanup";

/** Beide Aufräumläufe von Hand auslösbar. Der geplante Lauf macht dasselbe —
 *  das hier ist für den Fall, dass man nicht bis zur nächsten Stunde warten
 *  will. */
export async function POST(request: Request) {
  const user = await getAuthenticatedAppUser(request);
  if (!user) return NextResponse.json({ error: "Nicht authentifiziert." }, { status: 401 });
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
  try {
    const retention = await deleteExpiredCardSubmissions();
    const orphans = await cleanupOrphanedCardSubmissionAssets();
    return NextResponse.json({ ok: true, ...orphans, retention });
  } catch (error) {
    console.error("Card submission cleanup failed", error);
    return NextResponse.json({ error: "Bereinigung fehlgeschlagen." }, { status: 503 });
  }
}
