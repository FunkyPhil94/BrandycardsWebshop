import { count, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../../db";
import { cardSubmissionAssets, cardSubmissions, inquiries, orders, products } from "../../../../db/schema";
import { getAuthenticatedAppUser } from "../../../../lib/app-user";

export async function GET(request: Request) {
  try {
    const appUser = await getAuthenticatedAppUser(request);
    if (!appUser) return NextResponse.json({ error: "Nicht authentifiziert." }, { status: 401 });
    if (appUser.role !== "ADMIN") return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });

    const db = getDb();
    const [[productCount], [inquiryCount], [submissionCount], [orderCount]] = await Promise.all([
      db.select({ count: count() }).from(products),
      db.select({ count: count() }).from(inquiries),
      db.select({ count: count() }).from(cardSubmissions),
      db.select({ count: count() }).from(orders),
    ]);
    const recentRows = await db.select({ id: cardSubmissions.id, email: cardSubmissions.guestEmail, name: cardSubmissions.name, message: cardSubmissions.message, status: cardSubmissions.status, createdAt: cardSubmissions.createdAt }).from(cardSubmissions).orderBy(desc(cardSubmissions.createdAt)).limit(20);
    const recentSubmissions = await Promise.all(recentRows.map(async (submission) => {
      const assets = await db.select({ id: cardSubmissionAssets.id, originalName: cardSubmissionAssets.originalName, mimeType: cardSubmissionAssets.mimeType, byteSize: cardSubmissionAssets.byteSize }).from(cardSubmissionAssets).where(eq(cardSubmissionAssets.submissionId, submission.id));
      let title = "Kartenangebot";
      try { title = typeof submission.message === "string" ? (JSON.parse(submission.message) as { title?: string }).title ?? title : title; } catch { /* keep safe fallback */ }
      return { id: submission.id, email: submission.email, name: submission.name, title, status: submission.status, createdAt: submission.createdAt, assets };
    }));

    return NextResponse.json({
      ok: true,
      user: { email: appUser.email, role: appUser.role },
      counts: {
        products: productCount?.count ?? 0,
        inquiries: inquiryCount?.count ?? 0,
        cardSubmissions: submissionCount?.count ?? 0,
        orders: orderCount?.count ?? 0,
      },
      recentSubmissions,
    });
  } catch (error) {
    console.error("Admin dashboard failed", error);
    return NextResponse.json({ error: "Administrationsbereich ist derzeit nicht verfügbar." }, { status: 503 });
  }
}
