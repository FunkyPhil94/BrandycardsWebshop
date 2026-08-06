import { NextResponse } from "next/server";
import { findOrCreateAppUser } from "../../../../lib/app-user";
import { getSupabaseUser } from "../../../../lib/supabase-server";

export async function POST(request: Request) {
  const authUser = await getSupabaseUser(request);
  if (!authUser?.id || !authUser.email) {
    return NextResponse.json({ error: "Nicht authentifiziert." }, { status: 401 });
  }

  try {
    let requestedUsername: unknown;
    if ((request.headers.get("content-type") ?? "").includes("application/json")) {
      requestedUsername = (await request.json() as { username?: unknown }).username;
    }
    const appUser = await findOrCreateAppUser(authUser, requestedUsername);
    return NextResponse.json({ ok: true, userId: appUser.id, role: appUser.role, username: appUser.username });
  } catch (error) {
    console.error("Account profile sync failed", error);
    return NextResponse.json({ error: "Profil konnte nicht synchronisiert werden." }, { status: 503 });
  }
}
