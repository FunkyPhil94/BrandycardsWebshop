import { NextResponse } from "next/server";
import { findOrCreateAppUser } from "../../../../lib/app-user";
import { getSupabaseUser } from "../../../../lib/supabase-server";

export async function POST(request: Request) {
  const authUser = await getSupabaseUser(request);
  if (!authUser?.id || !authUser.email) {
    return NextResponse.json({ error: "Nicht authentifiziert." }, { status: 401 });
  }

  try {
    const appUser = await findOrCreateAppUser(authUser);
    return NextResponse.json({ ok: true, userId: appUser.id, role: appUser.role });
  } catch (error) {
    console.error("Account profile sync failed", error);
    return NextResponse.json({ error: "Profil konnte nicht synchronisiert werden." }, { status: 503 });
  }
}
