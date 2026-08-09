import { getDb } from "../db";
import { auditEvents } from "../db/schema";

type AuditValue = string | number | boolean | null;

export type AdminAuditInput = {
  request: Request;
  actorUserId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, AuditValue>;
};

async function hashIp(request: Request): Promise<string | null> {
  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim();
  const salt = process.env.AUDIT_IP_HASH_SALT;
  if (!ip || !salt) return null;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:${ip}`));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Writes a privacy-preserving record of a privileged mutation. */
export async function recordAdminAudit(input: AdminAuditInput) {
  await getDb().insert(auditEvents).values({
    actorUserId: input.actorUserId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    metadata: input.metadata ?? null,
    ipHash: await hashIp(input.request),
    createdAt: new Date().toISOString(),
  });
}
