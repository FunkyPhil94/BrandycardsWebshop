import { eq, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getAssetBucket, getDb } from "../../../../db";
import { orders } from "../../../../db/schema";
import { blockingOrders, deleteAccountData } from "../../../../lib/account-data";
import { getAuthenticatedAppUser } from "../../../../lib/app-user";
import { notifyAccountDeleted } from "../../../../lib/email/notify.ts";
import { enforcePublicRateLimit, RateLimitError } from "../../../../lib/rate-limit";
import { deleteSupabaseUser, hasSupabaseAdminAccess } from "../../../../lib/supabase-admin";
import { localeFromRequest, translate } from "../../../../lib/i18n";

/** Kontolöschung nach Art. 17 DSGVO, zur Selbstbedienung.
 *
 * **Diese Route ist unwiderruflich.** Deshalb steht vor dem ersten Schreibzugriff
 * eine Kette von Abbruchbedingungen — lieber gar nicht löschen als halb.
 *
 * Reihenfolge mit Absicht: **erst die Shopdaten, dann das Anmeldekonto.**
 * Andersherum stünde ein Kunde nach einem Fehlschlag ohne Login, aber mit
 * seinen Daten in unserer Datenbank da — und ohne Login käme er an den
 * Selbstbedienungsweg nicht mehr heran, um es erneut zu versuchen.
 *
 * Siehe docs/security-findings.md, SEC-15.
 */
/** Sagt der Oberfläche, ob die Selbstbedienungslöschung bereitsteht.
 *
 * Ohne diese Auskunft stünde im Konto ein Knopf, der erst nach dem Klick
 * gesteht, dass er nicht kann. Sobald das Secret hinterlegt ist, erscheint er
 * von selbst — es braucht kein zweites Deployment.
 */
export async function GET(request: Request) {
  try {
    await enforcePublicRateLimit(request, "account-delete");
    const appUser = await getAuthenticatedAppUser(request).catch(() => null);
    if (!appUser) return NextResponse.json({ error: "Nicht authentifiziert." }, { status: 401 });
    return NextResponse.json({ available: hasSupabaseAdminAccess() }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: error.message }, { status: error.status, headers: { "retry-after": String(error.retryAfterSeconds) } });
    }
    console.error("Account deletion availability failed", error);
    return NextResponse.json({ error: "Die Kontolöschung konnte gerade nicht geprüft werden." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    await enforcePublicRateLimit(request, "account-delete");
    const appUser = await getAuthenticatedAppUser(request).catch(() => null);
    if (!appUser) return NextResponse.json({ error: "Nicht authentifiziert." }, { status: 401 });

    // Ohne Service-Role-Key ließe sich nur die Hälfte löschen: Die Shopdaten wären
    // weg, die Anmeldung bliebe. Das ist ein schlechterer Zustand als der heutige,
    // deshalb wird hier abgebrochen, bevor irgendetwas geschrieben wurde.
    if (!hasSupabaseAdminAccess()) {
      console.error("[account] Löschung abgelehnt: SUPABASE_SERVICE_ROLE_KEY fehlt.");
      return NextResponse.json({ error: "Die Selbstbedienungslöschung ist noch nicht eingerichtet. Bitte schreib uns kurz an brandycards@gmx.de, dann löschen wir dein Konto von Hand." }, { status: 503 });
    }

    const db = getDb();
    const blocking = await blockingOrders(db, appUser.id, appUser.email);
    if (blocking.length) {
      return NextResponse.json({
        error: translate(localeFromRequest(request), "Zu deinem Konto läuft gerade eine Bestellung ({{orders}}). Warte bitte, bis sie abgeschlossen oder abgebrochen ist. Danach lässt sich das Konto löschen.", { orders: blocking.map((order) => order.orderNumber).join(", ") }),
      }, { status: 409 });
    }

    // Beides vor dem Löschen festhalten: Danach gibt es weder die Kontozeile
    // noch die Verknüpfung zu den Bestellungen.
    const empfaenger = appUser.email;
    const authSubject = appUser.authSubject;
    const bestellungen = await db.select({ id: orders.id }).from(orders)
      .where(or(eq(orders.userId, appUser.id), sql`lower(${orders.guestEmail}) = lower(${appUser.email})`));

    const geloescht = await deleteAccountData(db, getAssetBucket(), appUser.id, empfaenger);

    // Erst jetzt das Anmeldekonto. Schlägt es fehl, sind die Shopdaten bereits
    // weg — das ist der gewollte Teil; offen bleibt nur die Anmeldung, und
    // genau das muss der Kunde erfahren, statt ein „alles erledigt" zu lesen.
    const auth = authSubject ? await deleteSupabaseUser(authSubject) : { ok: true as const };
    if (!auth.ok) {
      console.error("[account] Shopdaten gelöscht, Anmeldekonto blieb stehen.", auth);
      return NextResponse.json({
        error: "Deine Daten im Shop sind gelöscht, deine Anmeldung konnten wir gerade nicht entfernen. Bitte schreib uns an brandycards@gmx.de, wir holen das nach.",
        partial: true,
      }, { status: 502 });
    }

    await notifyAccountDeleted(empfaenger, bestellungen.length, appUser.preferredLocale);
    console.warn("[account] Konto auf eigenen Wunsch gelöscht.", { ...geloescht, verbleibendeBestellungen: bestellungen.length });
    return NextResponse.json({ ok: true, geloescht, verbleibendeBestellungen: bestellungen.length });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: error.message }, { status: error.status, headers: { "retry-after": String(error.retryAfterSeconds) } });
    }
    console.error("Account deletion failed", error);
    return NextResponse.json({ error: "Das Konto konnte nicht gelöscht werden. Bitte versuch es später noch einmal." }, { status: 503 });
  }
}
