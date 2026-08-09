import { NextResponse } from "next/server";
import { findOrCreateAppUser } from "../../../../lib/app-user";
import { enforcePublicRateLimit, RateLimitError } from "../../../../lib/rate-limit";
import { getSupabaseUser } from "../../../../lib/supabase-server";

export async function POST(request: Request) {
  try {
    await enforcePublicRateLimit(request, "account-profile");
    const authUser = await getSupabaseUser(request);
    if (!authUser?.id || !authUser.email) {
      return NextResponse.json({ error: "Nicht authentifiziert." }, { status: 401 });
    }

    let requestedUsername: unknown;
    let requestedDisplayName: unknown;
    if ((request.headers.get("content-type") ?? "").includes("application/json")) {
      const body = await request.json() as { username?: unknown; displayName?: unknown };
      requestedUsername = body.username;
      requestedDisplayName = body.displayName;
    }
    const appUser = await findOrCreateAppUser(authUser, requestedUsername, requestedDisplayName);
    return NextResponse.json({ ok: true, userId: appUser.id, role: appUser.role, username: appUser.username, displayName: appUser.displayName });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: error.message }, { status: error.status, headers: { "retry-after": String(error.retryAfterSeconds) } });
    }
    console.error("Account profile sync failed", error);
    return NextResponse.json({ error: "Profil konnte nicht synchronisiert werden." }, { status: 503 });
  }
}
