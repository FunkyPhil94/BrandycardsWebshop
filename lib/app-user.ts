import { and, eq } from "drizzle-orm";
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
  const emailVerified = Boolean(authUser.email_confirmed_at);
  const verifiedAt = emailVerified ? authUser.email_confirmed_at ?? null : null;
  const configuredAdmin = isConfiguredAdmin(authUser, email);
  const linked = await db.query.users.findFirst({ where: and(eq(users.authProvider, "supabase"), eq(users.authSubject, authUser.id)) });
  if (linked && emailVerified && linked.email !== email) {
    const emailOwner = await db.query.users.findFirst({ where: eq(users.email, email) });
    if (emailOwner && emailOwner.id !== linked.id) throw new Error("Diese E-Mail-Adresse ist bereits einem anderen Konto zugeordnet.");
  }
  const existing = linked ?? (emailVerified ? await db.query.users.findFirst({ where: eq(users.email, email) }) : undefined);

  if (!linked && !emailVerified) {
    throw new Error("Die E-Mail-Adresse muss vor der Kontoerstellung bestätigt werden.");
  }

  if (existing) {
    await db.update(users).set({
      email: emailVerified ? email : existing.email,
      authProvider: "supabase",
      authSubject: authUser.id,
      emailVerifiedAt: emailVerified ? verifiedAt : existing.emailVerifiedAt,
      ...(configuredAdmin && existing.role === "CUSTOMER" ? { role: "ADMIN" as const } : {}),
      updatedAt: new Date().toISOString(),
    }).where(eq(users.id, existing.id));
    return { ...existing, email: emailVerified ? email : existing.email, authProvider: "supabase", authSubject: authUser.id, emailVerifiedAt: emailVerified ? verifiedAt : existing.emailVerifiedAt, role: configuredAdmin && existing.role === "CUSTOMER" ? "ADMIN" as const : existing.role };
  }

  const [created] = await db.insert(users).values({
    email,
    role: configuredAdmin ? "ADMIN" : "CUSTOMER",
    authProvider: "supabase",
    authSubject: authUser.id,
    emailVerifiedAt: verifiedAt,
  }).returning();
  if (!created) throw new Error("Could not create application user.");
  return created;
}

export async function getAuthenticatedAppUser(request: Request): Promise<AppUser | null> {
  const authUser = await getSupabaseUser(request);
  if (!authUser) return null;
  return findOrCreateAppUser(authUser);
}
