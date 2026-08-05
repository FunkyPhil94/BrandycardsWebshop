import { and, eq, or } from "drizzle-orm";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { getDb } from "../db";
import { users } from "../db/schema";
import { getSupabaseUser } from "./supabase-server";

export type AppUser = typeof users.$inferSelect;

export async function findOrCreateAppUser(authUser: SupabaseUser): Promise<AppUser> {
  if (!authUser.email) throw new Error("Authenticated Supabase user has no email.");
  const db = getDb();
  const email = authUser.email.trim().toLowerCase();
  const existing = await db.query.users.findFirst({
    where: or(
      and(eq(users.authProvider, "supabase"), eq(users.authSubject, authUser.id)),
      eq(users.email, email),
    ),
  });

  if (existing) {
    await db.update(users).set({
      email,
      authProvider: "supabase",
      authSubject: authUser.id,
      emailVerifiedAt: authUser.email_confirmed_at ?? null,
      updatedAt: new Date().toISOString(),
    }).where(eq(users.id, existing.id));
    return { ...existing, email, authProvider: "supabase", authSubject: authUser.id, emailVerifiedAt: authUser.email_confirmed_at ?? null };
  }

  const [created] = await db.insert(users).values({
    email,
    authProvider: "supabase",
    authSubject: authUser.id,
    emailVerifiedAt: authUser.email_confirmed_at ?? null,
  }).returning();
  if (!created) throw new Error("Could not create application user.");
  return created;
}

export async function getAuthenticatedAppUser(request: Request): Promise<AppUser | null> {
  const authUser = await getSupabaseUser(request);
  if (!authUser) return null;
  return findOrCreateAppUser(authUser);
}
