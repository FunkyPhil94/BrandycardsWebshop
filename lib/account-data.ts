import { and, eq, inArray, or, sql } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";
import type { getAssetBucket, getDb } from "../db";
import {
  cardSubmissionAssets,
  cardSubmissions,
  inquiries,
  orderItems,
  orders,
  payments,
  priceOffers,
  reservations,
  users,
} from "../db/schema";

type Db = ReturnType<typeof getDb>;
type Bucket = ReturnType<typeof getAssetBucket>;

/** Zustände, in denen ein Konto nicht gelöscht werden darf.
 *
 * `PENDING` heißt: Der Kunde steht gerade im Checkout, Bestand ist für ihn
 * zurückgelegt. `PROCESSING` heißt: Bei PayPal läuft ein Einzug. In beiden
 * Fällen würde eine Löschung mitten in einen Geldvorgang schneiden. */
export const BLOCKING_ORDER_STATUSES = ["PENDING", "PROCESSING"] as const;

/** Was zu einem Konto gehört — und warum die Kontokennung allein nicht reicht.
 *
 * Am 2026-08-08 an echten Daten aufgefallen: `/anfragen` und `/verkaufen` sind
 * **öffentliche** Formulare. Sie schreiben `guest_email` und lassen `user_id`
 * leer, auch wenn der Absender angemeldet ist. Eine Auskunft nur über `user_id`
 * verschwieg die Anfrage, und eine Löschung nur über `user_id` ließ die
 * E-Mail-Adresse stehen — beides sah dabei erfolgreich aus.
 *
 * Die Adresse ist hier ein zulässiger Schlüssel: Ein Konto entsteht erst nach
 * bestätigter E-Mail (`findOrCreateAppUser`), wer also unter einer Adresse
 * angemeldet ist, hat den Zugriff auf dieses Postfach nachgewiesen. Verglichen
 * wird über `lower()` auf beiden Seiten, weil die Kontoadresse normalisiert
 * gespeichert wird, die Formularadresse aber so, wie sie getippt wurde.
 */
/** Was zu einem Konto gehört: alles mit seiner Id **oder** seiner E-Mail-Adresse.
 *
 * Der zweite Teil ist keine Bequemlichkeit. Anfragen und Kartenangebote lassen
 * sich als Gast absenden; wer sich später mit derselben Adresse registriert,
 * würde seine eigenen Vorgänge sonst nicht wiederfinden — weder im Datenexport
 * noch in den Ansichten seines Kontos.
 *
 * **Exportiert, damit sie nicht abgeschrieben wird.** Seit dem 2026-08-17 nutzt
 * auch das Kundenkonto diese Regel. Zwei Fassungen davon wären ein
 * Datenschutzfehler mit Ansage: Die eine zeigte zu wenig, die andere zu viel.
 */
export function kontoZuordnung(userId: string, email: string) {
  return (spalteUserId: SQLiteColumn, spalteGuestEmail: SQLiteColumn) =>
    or(eq(spalteUserId, userId), sql`lower(${spalteGuestEmail}) = lower(${email})`);
}

const zuordnung = kontoZuordnung;

/** Alles, was der Shop über einen angemeldeten Kunden weiß.
 *
 * Bewusst aus den Tabellen zusammengesucht statt aus einer Sicht: Wer später
 * eine Tabelle mit `user_id` ergänzt und diese Funktion nicht anfasst, liefert
 * eine unvollständige Auskunft. Der Test in `tests/account-data.test.mjs` hält
 * die Liste der Tabellen deshalb gegen das Schema.
 */
export async function collectAccountData(db: Db, userId: string) {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) return null;
  const gehoertZu = zuordnung(user.id, user.email);

  const [orderRows, offerRows, inquiryRows, submissionRows] = await Promise.all([
    db.select().from(orders).where(gehoertZu(orders.userId, orders.guestEmail)),
    db.select().from(priceOffers).where(gehoertZu(priceOffers.userId, priceOffers.guestEmail)),
    db.select().from(inquiries).where(gehoertZu(inquiries.userId, inquiries.guestEmail)),
    db.select().from(cardSubmissions).where(gehoertZu(cardSubmissions.userId, cardSubmissions.guestEmail)),
  ]);

  const orderIds = orderRows.map((order) => order.id);
  // Zwei Nachladeabfragen statt einer je Bestellung: `inArray` bindet einen
  // Parameter je Id, und ein Konto hat realistisch keine 100 Bestellungen.
  // Falls doch, greift die Aufteilung in `chunk`.
  const items = orderIds.length ? await inChunks(orderIds, (ids) => db.select().from(orderItems).where(inArray(orderItems.orderId, ids))) : [];
  // Spalten einzeln statt `select()`: `payments.raw_data` enthält die
  // vollständige Antwort von PayPal. Die gehört nicht in eine Kundenauskunft —
  // sie ist Abwicklung mit einem Dritten und enthält Felder, die niemandem
  // etwas sagen. Sie wird hier gar nicht erst gelesen.
  const paymentRows = orderIds.length ? await inChunks(orderIds, (ids) => db.select({
    orderId: payments.orderId,
    provider: payments.provider,
    status: payments.status,
    providerOrderId: payments.providerOrderId,
    providerCaptureId: payments.providerCaptureId,
    amountCents: payments.amountCents,
    currency: payments.currency,
    createdAt: payments.createdAt,
  }).from(payments).where(inArray(payments.orderId, ids))) : [];

  const submissionIds = submissionRows.map((submission) => submission.id);
  const assets = submissionIds.length
    ? await inChunks(submissionIds, (ids) => db.select({
        submissionId: cardSubmissionAssets.submissionId,
        originalName: cardSubmissionAssets.originalName,
        mimeType: cardSubmissionAssets.mimeType,
        byteSize: cardSubmissionAssets.byteSize,
        createdAt: cardSubmissionAssets.createdAt,
      }).from(cardSubmissionAssets).where(inArray(cardSubmissionAssets.submissionId, ids)))
    : [];

  return {
    erstelltAm: new Date().toISOString(),
    hinweis: "Diese Datei enthält alle personenbezogenen Daten, die der BrandyCards-Shop zu deinem Konto gespeichert hat. Dein Passwort liegt beim Anmeldedienst Supabase und ist auch uns nicht bekannt.",
    konto: {
      id: user.id,
      email: user.email,
      benutzername: user.username,
      anzeigename: user.displayName,
      bevorzugteSprache: user.preferredLocale,
      rolle: user.role,
      emailBestaetigtAm: user.emailVerifiedAt,
      angelegtAm: user.createdAt,
      zuletztGeaendertAm: user.updatedAt,
    },
    bestellungen: orderRows.map((order) => ({
      ...order,
      positionen: items.filter((item) => item.orderId === order.id),
      zahlungen: paymentRows.filter((payment) => payment.orderId === order.id),
    })),
    preisvorschlaege: offerRows,
    anfragen: inquiryRows,
    kartenangebote: submissionRows.map((submission) => ({
      ...submission,
      bilder: assets.filter((asset) => asset.submissionId === submission.id),
    })),
  };
}

/** Löscht alles, was der Shop selbst über den Kunden gespeichert hat.
 *
 * **Bestellungen bleiben stehen.** Rechnungs- und Zahlungsdaten unterliegen der
 * gesetzlichen Aufbewahrungspflicht; Art. 17 Abs. 3 lit. b DSGVO nimmt sie vom
 * Löschanspruch aus. Sie verlieren aber ihre Verknüpfung zum Konto: `user_id`
 * fällt durch `ON DELETE SET NULL` von selbst weg, sobald die Kontozeile
 * verschwindet. Die Lieferadresse in der Bestellung bleibt — sie *ist* der
 * Rechnungsbeleg.
 *
 * Reihenfolge wie im Aufräumlauf: erst die R2-Objekte, dann die Zeilen. Bricht
 * ein Objekt ab, ist es verwaist und wird binnen 24 Stunden eingesammelt;
 * andersherum bliebe ein Bild ohne Zeile für immer liegen.
 */
export async function deleteAccountData(db: Db, bucket: Bucket, userId: string, email: string) {
  // Dieselbe Zuordnung wie in der Auskunft. Über `user_id` allein blieben
  // Anfragen und Kartenangebote aus den öffentlichen Formularen stehen — siehe
  // die Begründung an `zuordnung`.
  const gehoertZu = zuordnung(userId, email);

  const submissionRows = await db.select({ id: cardSubmissions.id }).from(cardSubmissions)
    .where(gehoertZu(cardSubmissions.userId, cardSubmissions.guestEmail));
  let deletedObjects = 0;
  for (const submission of submissionRows) {
    const assets = await db.select({ storageKey: cardSubmissionAssets.storageKey })
      .from(cardSubmissionAssets).where(eq(cardSubmissionAssets.submissionId, submission.id));
    const results = await Promise.allSettled(assets.map((asset) => bucket.delete(asset.storageKey)));
    deletedObjects += results.filter((result) => result.status === "fulfilled").length;
  }

  const submissions = await db.delete(cardSubmissions).where(gehoertZu(cardSubmissions.userId, cardSubmissions.guestEmail));
  const offers = await db.delete(priceOffers).where(gehoertZu(priceOffers.userId, priceOffers.guestEmail));
  const inquiryResult = await db.delete(inquiries).where(gehoertZu(inquiries.userId, inquiries.guestEmail));
  // Freigegebene und abgelaufene Reservierungen halten keinen Bestand mehr;
  // aktive kann es hier nicht geben, die Route lehnt vorher ab.
  await db.delete(reservations).where(eq(reservations.userId, userId));
  await db.delete(users).where(eq(users.id, userId));

  return {
    kartenangebote: submissions.meta.changes,
    bilder: deletedObjects,
    preisvorschlaege: offers.meta.changes,
    anfragen: inquiryResult.meta.changes,
  };
}

/** Bestellungen, die eine Löschung blockieren. Leer heißt: Weg ist frei. */
export async function blockingOrders(db: Db, userId: string, email: string) {
  return db.select({ orderNumber: orders.orderNumber, status: orders.status })
    .from(orders)
    .where(and(zuordnung(userId, email)(orders.userId, orders.guestEmail), inArray(orders.status, [...BLOCKING_ORDER_STATUSES])));
}

/** D1 begrenzt gebundene Parameter je Statement — siehe lib/d1-limits.ts. */
async function inChunks<Row>(ids: string[], query: (ids: string[]) => Promise<Row[]>): Promise<Row[]> {
  const { D1_SAFE_ID_LIST } = await import("./d1-limits");
  const rows: Row[] = [];
  for (let index = 0; index < ids.length; index += D1_SAFE_ID_LIST) {
    rows.push(...await query(ids.slice(index, index + D1_SAFE_ID_LIST)));
  }
  return rows;
}
