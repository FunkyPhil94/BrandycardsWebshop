/** Small decisions around the local user row, kept apart from `app-user.ts`
 *  so they can be tested without pulling in the database module. */

/** True when any field in `next` differs from what is already stored.
 *
 * `getAuthenticatedAppUser` runs on every authenticated request, including
 * plain reads. Writing the row unconditionally turned each of those into a D1
 * write. See docs/security-findings.md, SEC-09.
 */
export function changed(existing: Record<string, unknown>, next: Record<string, unknown>) {
  return Object.entries(next).some(([key, value]) => existing[key] !== value);
}

/** D1 surfaces a unique index violation as a plain error message. */
export function isUniqueViolation(error: unknown) {
  return error instanceof Error && /UNIQUE constraint failed/i.test(error.message);
}
