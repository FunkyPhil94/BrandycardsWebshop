import { and, eq, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../../db";
import { users } from "../../../../db/schema";
import { getSupabaseUser } from "../../../../lib/supabase-server";

export async function POST(request: Request) {
  const authUser = await getSupabaseUser(request);
  if (!authUser?.id || !authUser.email) {
    return NextResponse.json({ error: "Nicht authentifiziert." }, { status: 401 });
  }

  try {
    const db = getDb();
    const email = authUser.email.trim().toLowerCase();
    const existing = await db.query.users.findFirst({
      where: or(
        and(eq(users.authProvider, "supabase"), eq(users.authSubject, authUser.id)),
        eq(users.email, email),
      ),
      columns: { id: true },
    });

    if (existing) {
      await db.update(users).set({
        email,
        authProvider: "supabase",
        authSubject: authUser.id,
        emailVerifiedAt: authUser.email_confirmed_at ?? null,
        updatedAt: new Date().toISOString(),
      }).where(eq(users.id, existing.id));
      return NextResponse.json({ ok: true, userId: existing.id });
    }

    const [created] = await db.insert(users).values({
      email,
      authProvider: "supabase",
      authSubject: authUser.id,
      emailVerifiedAt: authUser.email_confirmed_at ?? null,
    }).returning({ id: users.id });
    return NextResponse.json({ ok: true, userId: created?.id }, { status: 201 });
  } catch (error) {
    console.error("Account profile sync failed", error);
    return NextResponse.json({ error: "Profil konnte nicht synchronisiert werden." }, { status: 503 });
  }
}
