import { and, eq, or } from "drizzle-orm";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { getDb } from "../db";
import { users } from "../db/schema";
import { getSupabaseUser } from "./supabase-server";

export type AppUser = typeof users.$inferSelect;

function isConfiguredAdmin(authUser: SupabaseUser, email: string) {
  if (!authUser.email_confirmed_at) return false;
  const configuredEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return configuredEmails.includes(email);
}

export async function findOrCreateAppUser(authUser: SupabaseUser): Promise<AppUser> {
  if (!authUser.email) throw new Error("Authenticated Supabase user has no email.");
  const db = getDb();
  const email = authUser.email.trim().toLowerCase();
  const configuredAdmin = isConfiguredAdmin(authUser, email);
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
      ...(configuredAdmin && existing.role === "CUSTOMER" ? { role: "ADMIN" as const } : {}),
      updatedAt: new Date().toISOString(),
    }).where(eq(users.id, existing.id));
    return { ...existing, email, authProvider: "supabase", authSubject: authUser.id, emailVerifiedAt: authUser.email_confirmed_at ?? null, role: configuredAdmin && existing.role === "CUSTOMER" ? "ADMIN" as const : existing.role };
  }

  const [created] = await db.insert(users).values({
    email,
    role: configuredAdmin ? "ADMIN" : "CUSTOMER",
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
