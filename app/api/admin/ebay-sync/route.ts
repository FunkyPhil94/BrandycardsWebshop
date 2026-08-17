import { NextResponse } from "next/server";
import { recordAdminAudit } from "../../../../lib/admin-audit";
import { requireAdmin } from "../../../../lib/admin-access";
import { runEbaySync } from "../../../../lib/ebay-sync";

export async function POST(request: Request) {
  try {
    const access = await requireAdmin(request);
    if (access.response) return access.response;
    const result = await runEbaySync();
    await recordAdminAudit({ request, actorUserId: access.user.id, action: "ebay.sync", entityType: "ebay_sync", metadata: { imported: result.importedCount ?? 0, updated: result.updatedCount ?? 0, skipped: result.skippedCount ?? 0 } });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("eBay sync failed", error);
    const message = error instanceof Error ? error.message : "Unbekannter eBay-Fehler.";
    return NextResponse.json({
      error: "eBay-Synchronisierung fehlgeschlagen.",
      detail: message.slice(0, 300),
    }, { status: 503 });
  }
}
