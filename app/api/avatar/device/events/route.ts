import { and, asc, eq, gt, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../../../db";
import { avatarEvents } from "../../../../../db/schema";
import { authenticateAvatarDevice } from "../../../../../lib/avatar-device-auth";

const DEFAULT_LOOKBACK_MS = 5 * 60_000;
const MAX_EVENTS_PER_POLL = 50;

function safeCursor(value: string | null, fallback: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return fallback;
  return new Date(value).toISOString();
}

export async function GET(request: Request) {
  try {
    const device = await authenticateAvatarDevice(request, "EVENTS");
    if (!device) return NextResponse.json({ error: "Desktop-Avatar ist nicht gekoppelt." }, { status: 401 });

    const url = new URL(request.url);
    const fallbackSince = new Date(Date.now() - DEFAULT_LOOKBACK_MS).toISOString();
    const since = safeCursor(url.searchParams.get("since"), fallbackSince);
    const afterId = url.searchParams.get("afterId")?.trim() ?? "";
    const db = getDb();
    const eventTimestamp = sql`datetime(${avatarEvents.createdAt})`;
    const cursorTimestamp = sql`datetime(${since})`;
    const cursor = afterId
      ? or(gt(eventTimestamp, cursorTimestamp), and(eq(eventTimestamp, cursorTimestamp), gt(avatarEvents.id, afterId)))
      : sql`${eventTimestamp} >= ${cursorTimestamp}`;
    const events = await db.select({
      id: avatarEvents.id,
      eventType: avatarEvents.eventType,
      aggregateType: avatarEvents.aggregateType,
      aggregateId: avatarEvents.aggregateId,
      createdAt: avatarEvents.createdAt,
    }).from(avatarEvents)
      .where(cursor)
      .orderBy(asc(avatarEvents.createdAt), asc(avatarEvents.id))
      .limit(MAX_EVENTS_PER_POLL);
    const last = events.at(-1);
    return NextResponse.json({
      events,
      nextCursor: last ? { since: last.createdAt, afterId: last.id } : { since, afterId },
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("desktop avatar event polling failed", error);
    return NextResponse.json({ error: "Desktop-Avatar-Ereignisse konnten nicht geladen werden." }, { status: 503 });
  }
}
