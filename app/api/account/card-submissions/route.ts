import { desc, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../../db";
import { cardSubmissionAssets, cardSubmissions } from "../../../../db/schema";
import { getAuthenticatedAppUser } from "../../../../lib/app-user";
import { kontoZuordnung } from "../../../../lib/account-data";
import { readFormMetadata } from "../../../../lib/public-form";
import { enforcePublicRateLimit, RateLimitError } from "../../../../lib/rate-limit";

/** Die zum Ankauf eingesendeten Karten eines Kunden.
 *
 * Zuordnung über Konto-Id **oder** E-Mail-Adresse (`kontoZuordnung`): Das
 * Ankaufsformular lässt sich als Gast absenden, und wer sich danach mit
 * derselben Adresse registriert, soll seine Einsendungen wiederfinden.
 *
 * Ausgegeben werden nur Angaben, die der Kunde selbst geschickt hat, plus Stand
 * und Zeitpunkt. **Keine internen Notizen**, und die Bilder nur als Kennung —
 * die Datei selbst kommt über `./assets` und wird dort erneut geprüft.
 */
export async function GET(request: Request) {
  try {
    await enforcePublicRateLimit(request, "account-card-submissions");
    const appUser = await getAuthenticatedAppUser(request);
    if (!appUser) return NextResponse.json({ error: "Nicht authentifiziert." }, { status: 401 });

    const db = getDb();
    const gehoertZu = kontoZuordnung(appUser.id, appUser.email);
    const rows = await db.select({
      id: cardSubmissions.id,
      message: cardSubmissions.message,
      requestedAmountCents: cardSubmissions.requestedAmountCents,
      currency: cardSubmissions.currency,
      status: cardSubmissions.status,
      adminQuestion: cardSubmissions.adminQuestion,
      createdAt: cardSubmissions.createdAt,
      updatedAt: cardSubmissions.updatedAt,
    }).from(cardSubmissions)
      .where(gehoertZu(cardSubmissions.userId, cardSubmissions.guestEmail))
      .orderBy(desc(cardSubmissions.createdAt));

    // Eine Abfrage für alle Bilder statt einer je Einsendung: `inArray` bindet
    // einen Parameter je Id, und mehr als eine Handvoll Einsendungen hat ein
    // Konto realistisch nicht.
    const ids = rows.map((row) => row.id);
    const assets = ids.length
      ? await db.select({ id: cardSubmissionAssets.id, submissionId: cardSubmissionAssets.submissionId, originalName: cardSubmissionAssets.originalName })
        .from(cardSubmissionAssets).where(inArray(cardSubmissionAssets.submissionId, ids))
      : [];

    const submissions = rows.map((row) => {
      const { title, text } = readFormMetadata(row.message);
      return {
        id: row.id,
        title,
        text,
        requestedAmountCents: row.requestedAmountCents,
        currency: row.currency,
        status: row.status,
        adminQuestion: row.adminQuestion,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        assets: assets.filter((asset) => asset.submissionId === row.id).map((asset) => ({ id: asset.id, originalName: asset.originalName })),
      };
    });

    return NextResponse.json({ submissions });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: error.message }, { status: error.status, headers: { "retry-after": String(error.retryAfterSeconds) } });
    }
    console.error("account card submissions failed", error);
    return NextResponse.json({ error: "Deine Kartenangebote konnten nicht geladen werden." }, { status: 503 });
  }
}
