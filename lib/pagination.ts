/** Blättern über den Kartenbestand.
 *
 *  Reine Rechnung ohne React und ohne DOM, damit die Randfälle prüfbar sind:
 *  letzte Seite unvollständig, Trefferzahl schrumpft während der Suche,
 *  Seitengröße wechselt, unsinnige Werte aus der URL.
 */

/** Angeboten werden nur diese vier. Ein freies Zahlenfeld lädt zu `?pro=99999`
 *  ein, und das wäre wieder die Liste mit allen 294 Karten. */
export const PAGE_SIZES = [10, 20, 50, 100] as const;

export type PageSize = (typeof PAGE_SIZES)[number];

export const DEFAULT_PAGE_SIZE: PageSize = 20;

/** Nimmt an, was in `PAGE_SIZES` steht — alles andere fällt auf die Vorgabe
 *  zurück. Quelle ist die URL, also unkontrollierte Eingabe. */
export function toPageSize(value: unknown): PageSize {
  const zahl = Number(value);
  return (PAGE_SIZES as readonly number[]).includes(zahl) ? (zahl as PageSize) : DEFAULT_PAGE_SIZE;
}

/** Wie viele Seiten es gibt. Bei null Treffern **eine** Seite, keine null —
 *  sonst stünde „Seite 1 von 0" da. */
export function pageCount(total: number, size: number): number {
  if (!Number.isFinite(total) || total < 1) return 1;
  return Math.max(1, Math.ceil(total / Math.max(1, size)));
}

/** Hält die Seitenzahl im gültigen Bereich.
 *
 *  Gebraucht, sobald die Trefferzahl kleiner wird: Wer auf Seite 12 steht und
 *  dann sucht, hätte sonst eine leere Ansicht vor sich und müsste raten,
 *  woran es liegt. */
export function clampPage(page: unknown, total: number, size: number): number {
  const zahl = Math.floor(Number(page));
  if (!Number.isFinite(zahl) || zahl < 1) return 1;
  return Math.min(zahl, pageCount(total, size));
}

/** Der Ausschnitt für eine Seite, samt der Zahlen für „21–40 von 294". */
export function pageSlice<T>(items: readonly T[], page: number, size: number) {
  const seite = clampPage(page, items.length, size);
  const von = (seite - 1) * size;
  const sichtbar = items.slice(von, von + size);
  return {
    page: seite,
    items: sichtbar,
    // Bei null Treffern soll „0 von 0" herauskommen, nicht „1 von 0".
    first: sichtbar.length ? von + 1 : 0,
    last: von + sichtbar.length,
    total: items.length,
    pages: pageCount(items.length, size),
  };
}

/** Die Schaltflächen der Blätterleiste: erste und letzte Seite immer, dazu ein
 *  Fenster um die aktuelle. `null` steht für eine Auslassung („…").
 *
 *  Bei 294 Karten zu je 10 sind das 30 Seiten — alle nebeneinander sprengen
 *  auf dem Handy jede Leiste.
 *
 *  `umgebung = 2` ist gemessen, nicht geraten: Mit 1 zeigt die Leiste bei fünf
 *  Seiten `1 2 … 5` und versteckt damit zwei Seiten hinter einem Zeichen, das
 *  genauso breit ist. Mit 2 stehen bis sieben Seiten vollständig da, und bei
 *  15 Seiten bleiben es höchstens neun Schaltflächen. */
export function pageNumbers(current: number, pages: number, umgebung = 2): (number | null)[] {
  const gezeigt = new Set<number>([1, pages]);
  for (let n = current - umgebung; n <= current + umgebung; n += 1) {
    if (n >= 1 && n <= pages) gezeigt.add(n);
  }

  const sortiert = [...gezeigt].sort((a, b) => a - b);
  const ausgabe: (number | null)[] = [];
  let vorherige = 0;
  for (const n of sortiert) {
    // Genau eine Seite Lücke wird ausgeschrieben statt mit „…" verdeckt — ein
    // Auslassungszeichen für eine einzige Zahl kostet mehr Platz, als es spart.
    if (vorherige && n - vorherige === 2) ausgabe.push(vorherige + 1);
    else if (vorherige && n - vorherige > 2) ausgabe.push(null);
    ausgabe.push(n);
    vorherige = n;
  }
  return ausgabe;
}
