import { and, asc, eq, gt, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../../../db";
import { avatarEvents } from "../../../../../db/schema";
import { requireAdmin } from "../../../../../lib/admin-access";

const DEFAULT_LOOKBACK_MS = 5 * 60_000;
const MAX_EVENTS_PER_POLL = 50;

function safeCursor(value: string | null, fallback: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return fallback;
  return new Date(value).toISOString();
}

export async function GET(request: Request) {
  const guard = await requireAdmin(request);
  if (guard.response) return guard.response;

  const url = new URL(request.url);
  const fallbackSince = new Date(Date.now() - DEFAULT_LOOKBACK_MS).toISOString();
  const since = safeCursor(url.searchParams.get("since"), fallbackSince);
  const afterId = url.searchParams.get("afterId")?.trim() ?? "";

  try {
    const db = getDb();
    // D1 stores CURRENT_TIMESTAMP as `YYYY-MM-DD HH:MM:SS`, while the client
    // sends ISO timestamps. Compare normalized SQLite datetimes instead of
    // comparing the raw text values, otherwise the space-versus-T ordering
    // silently hides every event from the current day.
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
      payload: avatarEvents.payload,
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
    console.error("avatar event polling failed", error);
    return NextResponse.json({ error: "Avatar-Ereignisse konnten nicht geladen werden." }, { status: 503 });
  }
}
