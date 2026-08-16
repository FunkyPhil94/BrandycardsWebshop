import { getDb } from "../db";
import { avatarEvents, type AvatarEventType } from "../db/schema";

export type AvatarEventInput = {
  eventType: AvatarEventType;
  aggregateType: string;
  aggregateId: string;
  dedupeKey: string;
  payload?: Record<string, unknown> | null;
  createdAt?: string;
};

export function avatarEventInsert(
  db: ReturnType<typeof getDb>,
  input: AvatarEventInput,
) {
  return db
    .insert(avatarEvents)
    .values({
      eventType: input.eventType,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      dedupeKey: input.dedupeKey,
      payload: input.payload ?? null,
      createdAt: input.createdAt ?? new Date().toISOString(),
    })
    .onConflictDoNothing({ target: avatarEvents.dedupeKey });
}

export async function enqueueAvatarEvent(
  db: ReturnType<typeof getDb>,
  input: AvatarEventInput,
) {
  await avatarEventInsert(db, input);
}

export async function tryEnqueueAvatarEvent(
  db: ReturnType<typeof getDb>,
  input: AvatarEventInput,
) {
  try {
    await enqueueAvatarEvent(db, input);
    return true;
  } catch (error) {
    console.error("avatar event enqueue failed", error);
    return false;
  }
}
