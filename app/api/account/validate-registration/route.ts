import { NextResponse } from "next/server";
import { normalizeUsername } from "../../../../lib/app-user";
import { jsonError } from "../../../../lib/public-form";
import { enforcePublicRateLimit } from "../../../../lib/rate-limit";
import { localeFromRequest, translate } from "../../../../lib/i18n";

/** Checks the one registration field the browser cannot decide on its own.
 *
 * This route used to receive the password as well, purely to compare it
 * against its own confirmation and count to eight — neither of which needs a
 * server. A password that travels to a server with no use for it is a password
 * one logging change away from ending up in a log file, so it no longer
 * travels. The browser enforces length and equality; Supabase enforces the
 * real policy. See docs/security-findings.md, SEC-07.
 */
export async function POST(request: Request) {
  try {
    await enforcePublicRateLimit(request, "validate-registration");
    const body = await request.json() as { username?: unknown; password?: unknown };
    if ("password" in body) {
      return NextResponse.json({ error: "Diese Prüfung nimmt kein Passwort entgegen." }, { status: 400 });
    }
    if (!normalizeUsername(body.username)) {
      return NextResponse.json({ error: translate(localeFromRequest(request), "Der Benutzername muss 3 bis 30 Zeichen enthalten: Buchstaben, Zahlen oder Unterstriche.") }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Ungültige Registrierungsdaten." }, { status: 400 });
    return jsonError(error);
  }
}
