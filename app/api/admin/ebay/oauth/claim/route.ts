import { eq, lte, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../../../../db";
import { ebayOauthClaims } from "../../../../../../db/schema";
import { recordAdminAudit } from "../../../../../../lib/admin-audit";
import { requireAdmin } from "../../../../../../lib/admin-access";

/** Holt den bei der eBay-Rückkehr geparkten Refresh-Token ab (SEC-12).
 *
 * **Hier liegt die eigentliche Absicherung.** Die Rückseite
 * (`../callback/route.ts`) kann keine Anmeldung prüfen — eBay schickt den
 * Browser dorthin, und eine Navigation trägt keinen `Authorization`-Header.
 * Diese Route dagegen wird aus dem angemeldeten Adminbereich heraus gerufen und
 * ist deshalb ganz gewöhnlich adminpflichtig.
 *
 * **`POST`, nicht `GET`, und die Zeile wird gelöscht statt markiert.** Ein
 * `GET` landete in Verlauf und Protokollen; eine markierte Zeile trüge den
 * Token weiter, obwohl er schon abgeholt ist. Beides wäre genau die Sorte
 * Rest, die SEC-12 überhaupt erst ausgelöst hat.
 */
export async function POST(request: Request) {
  const guard = await requireAdmin(request, { recentAuthSeconds: 600 });
  if (guard.response) return guard.response;

  try {
    const body = await request.json() as { claimId?: unknown };
    const claimId = typeof body.claimId === "string" && /^[a-f0-9]{32}$/iu.test(body.claimId) ? body.claimId : null;
    if (!claimId) return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });

    const db = getDb();
    const jetzt = new Date().toISOString();
    // Abgelaufene Zeilen zuerst weg: Dann kann die Abfrage darunter nicht
    // versehentlich einen Token herausgeben, dessen Frist verstrichen ist.
    await db.delete(ebayOauthClaims).where(lte(ebayOauthClaims.expiresAt, jetzt));

    const claim = await db.query.ebayOauthClaims.findFirst({
      where: sql`${ebayOauthClaims.id} = ${claimId} AND datetime(${ebayOauthClaims.expiresAt}) > datetime(${jetzt})`,
    });
    if (!claim) return NextResponse.json({ error: "Dieser Token wurde bereits abgeholt oder ist abgelaufen. Bitte „eBay OAuth verbinden“ erneut starten." }, { status: 404 });

    await db.delete(ebayOauthClaims).where(eq(ebayOauthClaims.id, claim.id));
    await recordAdminAudit({ request, actorUserId: guard.user.id, action: "ebay.oauth_claim", entityType: "ebay_oauth_claim", entityId: claim.id });
    return NextResponse.json({ refreshToken: claim.refreshToken }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("eBay OAuth claim konnte nicht eingelöst werden", error);
    return NextResponse.json({ error: "Der Token konnte nicht abgeholt werden." }, { status: 503 });
  }
}
