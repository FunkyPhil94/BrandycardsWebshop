import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getAssetBucket, getDb } from "../../../../../db";
import { cardSubmissionAssets, cardSubmissions } from "../../../../../db/schema";
import { getAuthenticatedAppUser } from "../../../../../lib/app-user";
import { kontoZuordnung } from "../../../../../lib/account-data";
import { enforcePublicRateLimit, RateLimitError } from "../../../../../lib/rate-limit";

/** Ein eingesendetes Bild — **nur für den, der es eingesendet hat**.
 *
 * Der Aufbau folgt bewusst der Adminroute (`app/api/admin/card-submissions/assets`),
 * mit einem entscheidenden Unterschied: Dort genügt die Adminrolle, hier muss
 * die Einsendung dem angemeldeten Konto gehören. Die Prüfung passiert **in der
 * Abfrage** und nicht danach im Code — ein `if` hinter dem Laden wäre eine
 * Zeile, die man beim nächsten Umbau versehentlich entfernt.
 *
 * Die Bilder liegen nicht öffentlich in R2. Deshalb kommen sie durch diese
 * Route und nicht über eine Adresse, die man weitergeben könnte.
 */
export async function GET(request: Request) {
  try {
    await enforcePublicRateLimit(request, "account-card-submission-assets");
    const appUser = await getAuthenticatedAppUser(request);
    if (!appUser) return NextResponse.json({ error: "Nicht authentifiziert." }, { status: 401 });

    const assetId = new URL(request.url).searchParams.get("assetId");
    if (!assetId || !/^[a-f0-9]{32}$/iu.test(assetId)) return NextResponse.json({ error: "Ungültige Bildreferenz." }, { status: 400 });

    const db = getDb();
    const gehoertZu = kontoZuordnung(appUser.id, appUser.email);
    const [asset] = await db.select({
      storageKey: cardSubmissionAssets.storageKey,
      mimeType: cardSubmissionAssets.mimeType,
      byteSize: cardSubmissionAssets.byteSize,
    }).from(cardSubmissionAssets)
      .innerJoin(cardSubmissions, eq(cardSubmissions.id, cardSubmissionAssets.submissionId))
      .where(and(
        eq(cardSubmissionAssets.id, assetId),
        gehoertZu(cardSubmissions.userId, cardSubmissions.guestEmail),
      ))
      .limit(1);

    // Fremd und nicht vorhanden sind hier dieselbe Antwort. Ein eigener Status
    // für „gibt es, gehört dir aber nicht" verriete, welche Kennungen existieren.
    if (!asset) return NextResponse.json({ error: "Bild nicht gefunden." }, { status: 404 });

    const object = await getAssetBucket().get(asset.storageKey);
    if (!object) return NextResponse.json({ error: "Bild nicht verfügbar." }, { status: 404 });

    return new Response(object.body, {
      headers: {
        "content-type": asset.mimeType,
        "content-length": String(asset.byteSize),
        "cache-control": "private, no-store, max-age=0",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: error.message }, { status: error.status, headers: { "retry-after": String(error.retryAfterSeconds) } });
    }
    console.error("account asset access failed", error);
    return NextResponse.json({ error: "Bild konnte nicht geladen werden." }, { status: 503 });
  }
}
