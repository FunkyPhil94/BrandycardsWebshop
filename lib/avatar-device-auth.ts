import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "../db";
import { avatarDeviceTokens, type AvatarDeviceScope } from "../db/schema";
import { parseDbTimestamp } from "./retention.ts";
import { getBearerToken } from "./supabase-server";

const DEVICE_TOKEN_PREFIX = "bcav_";

export function normalizeAvatarPairingCode(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().toUpperCase().replaceAll(/[^A-Z0-9]/gu, "").slice(0, 32);
}

export function createAvatarPairingCode() {
  const raw = crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase();
  return `${raw.slice(0, 6)}-${raw.slice(6)}`;
}

export function createAvatarDeviceToken() {
  return `${DEVICE_TOKEN_PREFIX}${crypto.randomUUID().replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "")}`;
}

export async function hashAvatarCredential(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function deviceScopes(value: unknown): AvatarDeviceScope[] {
  if (!Array.isArray(value)) return [];
  return value.filter((scope): scope is AvatarDeviceScope => scope === "EVENTS" || scope === "ASSISTANT_READ");
}

export async function authenticateAvatarDevice(request: Request, requiredScope: AvatarDeviceScope = "EVENTS") {
  const token = getBearerToken(request);
  if (!token?.startsWith(DEVICE_TOKEN_PREFIX)) return null;
  const tokenHash = await hashAvatarCredential(token);
  const db = getDb();
  const record = await db.query.avatarDeviceTokens.findFirst({ where: and(
    eq(avatarDeviceTokens.tokenHash, tokenHash),
    isNull(avatarDeviceTokens.revokedAt),
  ) });
  if (!record || !deviceScopes(record.scopes).includes(requiredScope)) return null;
  const expiresAt = parseDbTimestamp(record.expiresAt);
  if (record.expiresAt && (expiresAt === null || expiresAt <= Date.now())) return null;
  return record;
}
