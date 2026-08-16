import { NextResponse } from "next/server";
import { getDb } from "../../../../../db";
import { avatarDevicePairings } from "../../../../../db/schema";
import { requireAdmin } from "../../../../../lib/admin-access";
import { createAvatarPairingCode, hashAvatarCredential } from "../../../../../lib/avatar-device-auth";

export async function POST(request: Request) {
  const guard = await requireAdmin(request, { recentAuthSeconds: 600 });
  if (guard.response) return guard.response;

  try {
    const now = new Date();
    const createdAt = now.toISOString();
    const expiresAt = new Date(now.getTime() + 10 * 60_000).toISOString();
    const code = createAvatarPairingCode();
    const db = getDb();
    await db.insert(avatarDevicePairings).values({
      codeHash: await hashAvatarCredential(code.replaceAll("-", "")),
      createdByUserId: guard.user.id,
      expiresAt,
      createdAt,
    });
    return NextResponse.json({ ok: true, code, expiresAt }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("avatar device pairing creation failed", error);
    return NextResponse.json({ error: "Desktop-Avatar-Kopplung konnte nicht erstellt werden." }, { status: 503 });
  }
}
