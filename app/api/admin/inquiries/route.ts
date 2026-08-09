import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../../db";
import { inquiries, inquiryStatusValues, products } from "../../../../db/schema";
import { requireAdmin } from "../../../../lib/admin-access";

const PAGE_SIZE = 30;

/** Der Titel und der Fließtext stecken als JSON in `inquiries.message`
 *  (`formMetadata` in `lib/public-form.ts`). Defensiv gelesen: Eine ältere oder
 *  kaputte Zeile darf die ganze Liste nicht unbrauchbar machen. */
function inhalt(wert: unknown): { title: string; message: string | null } {
  if (typeof wert !== "string") return { title: "Anfrage", message: null };
  try {
    const geparst = JSON.parse(wert) as { title?: unknown; message?: unknown };
    return {
      title: typeof geparst.title === "string" && geparst.title.trim() ? geparst.title : "Anfrage",
      message: typeof geparst.message === "string" && geparst.message.trim() ? geparst.message : null,
    };
  } catch {
    // Kein JSON: dann ist das Feld der Fließtext selbst.
    return { title: "Anfrage", message: wert };
  }
}

export async function GET(request: Request) {
  const guard = await requireAdmin(request);
  if (guard.response) return guard.response;

  try {
    const db = getDb();
    const rows = await db.select({
      id: inquiries.id,
      email: inquiries.guestEmail,
      name: inquiries.name,
      message: inquiries.message,
      status: inquiries.status,
      createdAt: inquiries.createdAt,
      respondedAt: inquiries.respondedAt,
      productTitle: products.title,
      productId: inquiries.productId,
    }).from(inquiries)
      // Eine Anfrage kann sich auf eine Karte beziehen, muss aber nicht —
      // deshalb `leftJoin`, sonst verschwänden die allgemeinen Anfragen.
      .leftJoin(products, eq(products.id, inquiries.productId))
      .orderBy(desc(inquiries.createdAt))
      .limit(PAGE_SIZE);

    return NextResponse.json({
      inquiries: rows.map(({ message, ...row }) => {
        const { title, message: text } = inhalt(message);
        return { ...row, title, text };
      }),
      statuses: [...inquiryStatusValues],
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("admin inquiry list failed", error);
    return NextResponse.json({ error: "Anfragen konnten nicht geladen werden." }, { status: 503 });
  }
}

/** Setzt den Bearbeitungsstand einer Anfrage.
 *
 * **`respondedAt` wird mitgeführt, nicht nur der Status.** Ohne Zeitstempel
 * beantwortet die Liste die eigentliche Frage nicht — „seit wann liegt das
 * hier?" — und genau die stellt sich, wenn mehrere Anfragen offen sind. */
export async function PATCH(request: Request) {
  const guard = await requireAdmin(request);
  if (guard.response) return guard.response;

  try {
    const body = await request.json() as { id?: unknown; status?: unknown };
    const id = typeof body.id === "string" && /^[a-f0-9]{32}$/iu.test(body.id) ? body.id : null;
    const status = (inquiryStatusValues as readonly string[]).includes(String(body.status))
      ? String(body.status) as (typeof inquiryStatusValues)[number] : null;
    if (!id || !status) return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });

    const now = new Date().toISOString();
    const result = await getDb().update(inquiries)
      .set({ status, updatedAt: now, ...(status === "RESPONDED" ? { respondedAt: now } : {}) })
      .where(eq(inquiries.id, id));
    if (result.meta.changes !== 1) return NextResponse.json({ error: "Unbekannte Anfrage." }, { status: 404 });
    return NextResponse.json({ ok: true, status });
  } catch (error) {
    console.error("admin inquiry update failed", error);
    return NextResponse.json({ error: "Der Stand konnte nicht gespeichert werden." }, { status: 503 });
  }
}
