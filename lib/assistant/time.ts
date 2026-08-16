import { parseDbTimestamp } from "../retention.ts";

/** Normalisiert beide im Projekt vorkommenden D1-Zeitformate auf ISO-8601. */
export function assistantTimestamp(value: string | null): string | null {
  const timestamp = parseDbTimestamp(value);
  return timestamp === null ? null : new Date(timestamp).toISOString();
}

export function assistantTimestampValue(value: string | null): number {
  return parseDbTimestamp(value) ?? Number.NEGATIVE_INFINITY;
}
