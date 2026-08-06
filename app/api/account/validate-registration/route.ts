import { NextResponse } from "next/server";
import { normalizeUsername } from "../../../../lib/app-user";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { password?: unknown; passwordConfirmation?: unknown; username?: unknown };
    if (typeof body.password !== "string" || body.password.length < 8) {
      return NextResponse.json({ error: "Das Passwort muss mindestens 8 Zeichen lang sein." }, { status: 400 });
    }
    if (body.password !== body.passwordConfirmation) {
      return NextResponse.json({ error: "Die Passwörter stimmen nicht überein." }, { status: 400 });
    }
    if (!normalizeUsername(body.username)) {
      return NextResponse.json({ error: "Der Benutzername muss 3–30 Zeichen enthalten: Buchstaben, Zahlen oder Unterstriche." }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Ungültige Registrierungsdaten." }, { status: 400 });
  }
}
