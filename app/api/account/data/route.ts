import { NextResponse } from "next/server";
import { getDb } from "../../../../db";
import { collectAccountData } from "../../../../lib/account-data";
import { getAuthenticatedAppUser } from "../../../../lib/app-user";

/** Auskunft nach Art. 15 DSGVO, zur Selbstbedienung.
 *
 * Bis zum 2026-08-08 musste ein Kunde dafür eine E-Mail schreiben. Der Weg
 * bleibt zulässig, aber er skaliert nicht über den ersten Kunden hinaus, und er
 * setzt voraus, dass jemand mitliest. Siehe docs/security-findings.md, SEC-15.
 *
 * Bewusst ohne Ratenbegrenzung: Die Route braucht eine gültige Sitzung, und wer
 * seine eigenen Daten zehnmal herunterlädt, schadet niemandem.
 */
export async function GET(request: Request) {
  const appUser = await getAuthenticatedAppUser(request).catch(() => null);
  if (!appUser) return NextResponse.json({ error: "Nicht authentifiziert." }, { status: 401 });

  try {
    const data = await collectAccountData(getDb(), appUser.id);
    if (!data) return NextResponse.json({ error: "Zu diesem Konto liegen keine Daten vor." }, { status: 404 });
    return NextResponse.json(data, {
      headers: {
        // Eine vollständige Personenakte gehört in keinen Zwischenspeicher.
        "cache-control": "no-store",
        "content-disposition": `attachment; filename="brandycards-meine-daten.json"`,
      },
    });
  } catch (error) {
    console.error("Account data export failed", error);
    return NextResponse.json({ error: "Die Auskunft konnte nicht erstellt werden." }, { status: 503 });
  }
}
