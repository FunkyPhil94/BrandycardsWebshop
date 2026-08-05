import { NextResponse } from "next/server";
import { getAuthenticatedAppUser } from "../../../../../lib/app-user";
import { cleanupOrphanedCardSubmissionAssets } from "../../../../../lib/card-submission-cleanup";

export async function POST(request: Request) {
  const user = await getAuthenticatedAppUser(request);
  if (!user) return NextResponse.json({ error: "Nicht authentifiziert." }, { status: 401 });
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
  try {
    return NextResponse.json({ ok: true, ...(await cleanupOrphanedCardSubmissionAssets()) });
  } catch (error) {
    console.error("Card submission orphan cleanup failed", error);
    return NextResponse.json({ error: "Bereinigung fehlgeschlagen." }, { status: 503 });
  }
}
