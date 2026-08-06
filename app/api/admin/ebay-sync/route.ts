import { NextResponse } from "next/server";
import { getAuthenticatedAppUser } from "../../../../lib/app-user";
import { runEbaySync } from "../../../../lib/ebay-sync";

export async function POST(request: Request) {
  try {
    const appUser = await getAuthenticatedAppUser(request);
    if (!appUser) return NextResponse.json({ error: "Nicht authentifiziert." }, { status: 401 });
    if (appUser.role !== "ADMIN") return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
    const result = await runEbaySync();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("eBay sync failed", error);
    const message = error instanceof Error ? error.message : "Unbekannter eBay-Fehler.";
    return NextResponse.json({
      error: "eBay-Synchronisierung fehlgeschlagen.",
      detail: message.slice(0, 300),
    }, { status: 503 });
  }
}
