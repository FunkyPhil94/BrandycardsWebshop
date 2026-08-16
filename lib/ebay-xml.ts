/** Die XML-Griffe für die eBay-Trading-API.
 *
 * Bis Phase 8 standen sie privat in `lib/ebay-client.ts`. Die Lesequellen für
 * Postfach und Preisvorschläge sprechen dieselbe Schnittstelle und brauchen
 * dieselben Griffe; eine zweite Abschrift wäre die Stelle gewesen, an der die
 * beiden Fassungen irgendwann auseinanderlaufen.
 *
 * Absichtlich reguläre Ausdrücke statt eines Parsers: Die Antworten sind flach,
 * das Ziel ist eine Handvoll Felder, und in der Workers-Laufzeit gibt es keinen
 * DOM. Was daran zu beachten ist, steht bei `xmlBlocks`.
 */

function decodeXml(value: string) {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&").trim();
}

export function xmlValues(xml: string, tag: string) {
  const pattern = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "gi");
  return [...xml.matchAll(pattern)].map((match) => decodeXml(match[1] ?? ""));
}

export function xmlValue(xml: string, tag: string) { return xmlValues(xml, tag)[0]; }

export function xmlAttribute(xml: string, tag: string, attribute: string) {
  const match = xml.match(new RegExp(`<${tag}\\b([^>]*)>`, "i"));
  return match?.[1]?.match(new RegExp(`${attribute}\\s*=\\s*["']([^"']*)["']`, "i"))?.[1];
}

/** Alle Vorkommen eines Elements **einschließlich** seiner Umhüllung.
 *
 * Zwei Eigenschaften, auf die sich die Aufrufer verlassen:
 *
 * 1. `\b` hinter dem Namen trennt Geschwister mit gemeinsamem Wortanfang.
 *    `xmlBlocks(xml, "Item")` trifft deshalb weder `<ItemID>` noch
 *    `<ItemBestOffers>` — in der `GetBestOffers`-Antwort stehen alle drei
 *    ineinander, und ohne diese Grenze läse man den Vater als Kind.
 * 2. Der Ausdruck ist genügsam (`*?`), hört also beim **ersten** passenden
 *    Schlusszeichen auf. Gleichnamige Verschachtelung (`<A><A/></A>`) kann er
 *    damit nicht — kommt in den hier gelesenen Antworten aber auch nicht vor.
 */
export function xmlBlocks(xml: string, tag: string) {
  const pattern = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "gi");
  return [...xml.matchAll(pattern)].map((match) => match[0]);
}

export function xmlBlock(xml: string, tag: string) { return xmlBlocks(xml, tag)[0]; }

/** eBay liefert ISO-Zeitstempel; unbrauchbare werden zu `null`, nicht zu heute. */
export function parseEbayDate(value: string | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/** Die Fehlernummern einer Trading-Antwort.
 *
 * eBay nennt den Grund in `<ErrorCode>`, und nur diese Nummer ist stabil —
 * `LongMessage` ist Fließtext und übersetzt.
 */
export function tradingErrorCodes(xml: string): string[] {
  return xmlValues(xml, "ErrorCode").map((code) => code.trim()).filter(Boolean);
}

/** Hat eBay den Aufruf abgelehnt? `PartialFailure` zählt mit. */
export function tradingFailed(xml: string): boolean {
  const ack = xmlValue(xml, "Ack")?.toUpperCase();
  return ack === "FAILURE" || ack === "PARTIAL_FAILURE" || ack === "PARTIALFAILURE";
}
