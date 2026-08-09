import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/admin-access";

/** AAL1 is enough for the one route that lets an existing admin enroll MFA. */
export async function GET(request: Request) {
  const access = await requireAdmin(request, { requireMfa: false });
  if (access.response) return access.response;
  return NextResponse.json({
    mfaRequired: true,
    currentLevel: access.claims?.aal ?? "aal1",
    requiredLevel: "aal2",
  }, { headers: { "cache-control": "no-store" } });
}
