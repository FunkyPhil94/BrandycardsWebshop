import { and, eq, isNull, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../../../db";
import { avatarDevicePairings, avatarDeviceTokens } from "../../../../../db/schema";
import { createAvatarDeviceToken, hashAvatarCredential, normalizeAvatarPairingCode } from "../../../../../lib/avatar-device-auth";
import { enforcePublicRateLimit, RateLimitError } from "../../../../../lib/rate-limit";

export async function POST(request: Request) {
  try {
    await enforcePublicRateLimit(request, "avatar-device-pairing", "strict");
    const body = await request.json() as { code?: unknown };
    const code = normalizeAvatarPairingCode(body.code);
    if (code.length !== 12) return NextResponse.json({ error: "Der Pairing-Code ist ungültig." }, { status: 400 });

    const db = getDb();
    const now = new Date().toISOString();
    const codeHash = await hashAvatarCredential(code);
    const pairing = await db.query.avatarDevicePairings.findFirst({ where: and(
      eq(avatarDevicePairings.codeHash, codeHash),
      isNull(avatarDevicePairings.claimedAt),
      sql`datetime(${avatarDevicePairings.expiresAt}) > datetime(${now})`,
    ) });
    if (!pairing) return NextResponse.json({ error: "Der Pairing-Code ist unbekannt, abgelaufen oder bereits verwendet." }, { status: 409 });

    const claimedAt = new Date().toISOString();
    const claim = await db.update(avatarDevicePairings).set({ claimedAt }).where(and(
      eq(avatarDevicePairings.id, pairing.id),
      isNull(avatarDevicePairings.claimedAt),
      sql`datetime(${avatarDevicePairings.expiresAt}) > datetime(${claimedAt})`,
    ));
    if (claim.meta.changes !== 1) return NextResponse.json({ error: "Der Pairing-Code wurde gerade von einem anderen Gerät verwendet." }, { status: 409 });

    const deviceToken = createAvatarDeviceToken();
    const deviceExpiresAt = new Date(Date.now() + 90 * 24 * 60 * 60_000).toISOString();
    await db.insert(avatarDeviceTokens).values({
      tokenHash: await hashAvatarCredential(deviceToken),
      label: "BrandyCards Desktop Avatar",
      scopes: ["EVENTS", "ASSISTANT_READ"],
      pairingId: pairing.id,
      createdByUserId: pairing.createdByUserId,
      expiresAt: deviceExpiresAt,
      createdAt: claimedAt,
    });
    return NextResponse.json({ ok: true, deviceToken, expiresAt: deviceExpiresAt }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof RateLimitError) return NextResponse.json({ error: error.message }, { status: error.status, headers: { "retry-after": String(error.retryAfterSeconds) } });
    console.error("avatar device pairing claim failed", error);
    return NextResponse.json({ error: "Desktop-Avatar konnte nicht gekoppelt werden." }, { status: 503 });
  }
}
