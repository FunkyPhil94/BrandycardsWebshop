import { and, eq } from "drizzle-orm";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { getDb } from "../db";
import { users } from "../db/schema";
import { getSupabaseUser } from "./supabase-server";
import { changed } from "./user-profile";
import { normalizeLocale } from "./i18n";

export type AppUser = typeof users.$inferSelect;

/** Am 2026-08-17 entfernt: `normalizeUsername` und `normalizeDisplayName`.
 *
 * Benutzer- und Anzeigename wurden nirgends angezeigt — nicht in E-Mails,
 * nicht in Bestellungen, nicht im Adminbereich. Sie kosteten dafuer zweierlei:
 * personenbezogene Daten ohne Zweck, und ein Sperr-Risiko am laufenden Betrieb,
 * weil der Benutzername aus `user_metadata` kam, das der Kunde selbst
 * beschreiben kann, und gegen einen eindeutigen Index lief. Siehe U5 in
 * docs/ai-todo.md. */

function isConfiguredAdmin(authUser: SupabaseUser, email: string) {
  if (!authUser.email_confirmed_at) return false;
  const configuredEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return configuredEmails.includes(email);
}

export async function findOrCreateAppUser(authUser: SupabaseUser, requestedPreferredLocale?: unknown): Promise<AppUser> {
  if (!authUser.email) throw new Error("Authenticated Supabase user has no email.");
  const db = getDb();
  const email = authUser.email.trim().toLowerCase();
  const emailVerified = Boolean(authUser.email_confirmed_at);
  const verifiedAt = emailVerified ? authUser.email_confirmed_at ?? null : null;
  const configuredAdmin = isConfiguredAdmin(authUser, email);
  const preferredLocale = normalizeLocale(requestedPreferredLocale);
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
      ...(preferredLocale ? { preferredLocale } : {}),
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
      await db.update(users).set({ ...next, updatedAt: new Date().toISOString() }).where(eq(users.id, existing.id));
    }
    return merged;
  }

  const [created] = await db.insert(users).values({
    email,
    preferredLocale: preferredLocale ?? normalizeLocale(authUser.user_metadata?.preferredLocale) ?? "de",
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
