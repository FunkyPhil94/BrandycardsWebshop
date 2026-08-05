import { count } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../../db";
import { cardSubmissions, inquiries, orders, products } from "../../../../db/schema";
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

    return NextResponse.json({
      ok: true,
      user: { email: appUser.email, role: appUser.role },
      counts: {
        products: productCount?.count ?? 0,
        inquiries: inquiryCount?.count ?? 0,
        cardSubmissions: submissionCount?.count ?? 0,
        orders: orderCount?.count ?? 0,
      },
    });
  } catch (error) {
    console.error("Admin dashboard failed", error);
    return NextResponse.json({ error: "Administrationsbereich ist derzeit nicht verfügbar." }, { status: 503 });
  }
}
