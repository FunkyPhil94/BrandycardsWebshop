import { and, eq } from "drizzle-orm";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { getDb } from "../db";
import { users } from "../db/schema";
import { getSupabaseUser } from "./supabase-server";
import { changed, isUniqueViolation } from "./user-profile";

export type AppUser = typeof users.$inferSelect;

const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,30}$/;

export function normalizeUsername(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const username = value.trim();
  return USERNAME_PATTERN.test(username) ? username : null;
}

export function normalizeDisplayName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const displayName = value.trim();
  return displayName.length >= 1 && displayName.length <= 120 ? displayName : null;
}

function isConfiguredAdmin(authUser: SupabaseUser, email: string) {
  if (!authUser.email_confirmed_at) return false;
  const configuredEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return configuredEmails.includes(email);
}

export async function findOrCreateAppUser(authUser: SupabaseUser, requestedUsername?: unknown, requestedDisplayName?: unknown): Promise<AppUser> {
  if (!authUser.email) throw new Error("Authenticated Supabase user has no email.");
  const db = getDb();
  const email = authUser.email.trim().toLowerCase();
  const emailVerified = Boolean(authUser.email_confirmed_at);
  const verifiedAt = emailVerified ? authUser.email_confirmed_at ?? null : null;
  const configuredAdmin = isConfiguredAdmin(authUser, email);
  const username = normalizeUsername(requestedUsername ?? authUser.user_metadata?.username);
  const displayName = normalizeDisplayName(requestedDisplayName ?? authUser.user_metadata?.displayName);
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
    const next = {
      email: emailVerified ? email : existing.email,
      ...(username ? { username } : {}),
      ...(displayName ? { displayName } : {}),
      authProvider: "supabase" as const,
      authSubject: authUser.id,
      emailVerifiedAt: emailVerified ? verifiedAt : existing.emailVerifiedAt,
      ...(configuredAdmin && existing.role === "CUSTOMER" ? { role: "ADMIN" as const } : {}),
    };
    const merged = { ...existing, ...next };
    // Every authenticated request lands here, including plain reads such as
    // GET /api/price-offers. Writing unconditionally turned each one into a
    // D1 write; now the row is only touched when something actually differs.
    // See docs/security-findings.md, SEC-09.
    if (changed(existing, next)) {
      try {
        await db.update(users).set({ ...next, updatedAt: new Date().toISOString() }).where(eq(users.id, existing.id));
      } catch (error) {
        // `username` comes from Supabase user_metadata, which the customer can
        // write themselves. Picking a name someone else already has violates
        // users_username_unique — and because this runs on *every* request,
        // letting it through would lock the account out of the whole shop over
        // a display detail. The name simply does not change.
        if (!username || !isUniqueViolation(error)) throw error;
        console.warn("Benutzername bereits vergeben, Profil bleibt unverändert.", { userId: existing.id });
        return { ...merged, username: existing.username };
      }
    }
    return merged;
  }

  const [created] = await db.insert(users).values({
    email,
    username,
    displayName,
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
