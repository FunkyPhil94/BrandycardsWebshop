import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getAssetBucket, getDb } from "../../../../db";
import { orders } from "../../../../db/schema";
import { blockingOrders, deleteAccountData } from "../../../../lib/account-data";
import { getAuthenticatedAppUser } from "../../../../lib/app-user";
import { notifyAccountDeleted } from "../../../../lib/email/notify.ts";
import { deleteSupabaseUser, hasSupabaseAdminAccess } from "../../../../lib/supabase-admin";

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
  const appUser = await getAuthenticatedAppUser(request).catch(() => null);
  if (!appUser) return NextResponse.json({ error: "Nicht authentifiziert." }, { status: 401 });
  return NextResponse.json({ available: hasSupabaseAdminAccess() }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  const appUser = await getAuthenticatedAppUser(request).catch(() => null);
  if (!appUser) return NextResponse.json({ error: "Nicht authentifiziert." }, { status: 401 });

  // Ohne Service-Role-Key ließe sich nur die Hälfte löschen: Die Shopdaten wären
  // weg, die Anmeldung bliebe. Das ist ein schlechterer Zustand als der heutige,
  // deshalb wird hier abgebrochen, bevor irgendetwas geschrieben wurde.
  if (!hasSupabaseAdminAccess()) {
    console.error("[account] Löschung abgelehnt: SUPABASE_SERVICE_ROLE_KEY fehlt.");
    return NextResponse.json({ error: "Die Selbstbedienungslöschung ist noch nicht eingerichtet. Bitte schreib uns kurz an brandycards@gmx.de, dann löschen wir dein Konto von Hand." }, { status: 503 });
  }

  try {
    const db = getDb();
    const blocking = await blockingOrders(db, appUser.id);
    if (blocking.length) {
      return NextResponse.json({
        error: `Zu deinem Konto läuft gerade eine Bestellung (${blocking.map((order) => order.orderNumber).join(", ")}). Warte bitte, bis sie abgeschlossen oder abgebrochen ist — danach lässt sich das Konto löschen.`,
      }, { status: 409 });
    }

    // Beides vor dem Löschen festhalten: Danach gibt es weder die Kontozeile
    // noch die Verknüpfung zu den Bestellungen.
    const empfaenger = appUser.email;
    const authSubject = appUser.authSubject;
    const bestellungen = await db.select({ id: orders.id }).from(orders).where(eq(orders.userId, appUser.id));

    const geloescht = await deleteAccountData(db, getAssetBucket(), appUser.id);

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

    await notifyAccountDeleted(empfaenger, bestellungen.length);
    console.warn("[account] Konto auf eigenen Wunsch gelöscht.", { ...geloescht, verbleibendeBestellungen: bestellungen.length });
    return NextResponse.json({ ok: true, geloescht, verbleibendeBestellungen: bestellungen.length });
  } catch (error) {
    console.error("Account deletion failed", error);
    return NextResponse.json({ error: "Das Konto konnte nicht gelöscht werden. Bitte versuch es später noch einmal." }, { status: 503 });
  }
}
