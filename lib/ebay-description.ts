/** Turns an eBay item description into structured content.
 *
 * The listing template is authored for eBay's page: a dark branded box with its
 * own header, logo and footer. Embedding that inside the shop looks pasted in,
 * and the sanitiser strips its inline styles anyway. So instead of rendering
 * eBay's markup we read the *structure* out of it and re-render in the shop's
 * own design.
 *
 * Works on already-sanitised HTML (see lib/sanitize-html.ts), so it never has
 * to deal with scripts or attributes beyond the allowlist.
 *
 * Deliberately structural rather than keyed to German headings: any `<h1>`/`<h2>`
 * starts a section, and a two-column table inside one becomes label/value pairs.
 * Unrecognised input falls back to the plain sanitised HTML at the call site.
 */

export type CardSpec = { label: string; value: string };
export type CardSection = { heading: string; html: string };
export type ParsedDescription = { specs: CardSpec[]; sections: CardSection[] };

const stripTags = (html: string) => html.replace(/<[^>]*>/g, " ");

function decode(text: string) {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

const text = (html: string) => decode(stripTags(html)).replace(/\s+/g, " ").trim();

/** Puts plain text back into markup safely.
 *
 * `text()` deliberately decodes entities — headings and spec values are handed
 * to React, which escapes them again. The one branch that builds HTML from a
 * `text()` result must undo that decoding itself: without this, an eBay
 * description containing `&lt;img src=x onerror=…&gt;` would leave the
 * sanitiser correctly escaped and come back out of this parser as a live tag,
 * straight into `dangerouslySetInnerHTML`. See docs/security-findings.md,
 * SEC-01.
 *
 * Unconditional, unlike the sanitiser's `escapeText`: the input here is fully
 * decoded, so a bare `&` is a literal ampersand and never an entity prefix.
 */
function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Rows of a two-column table read as label/value pairs. */
function tableSpecs(html: string): CardSpec[] {
  const specs: CardSpec[] = [];
  for (const row of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => text(cell[1]));
    if (cells.length !== 2) continue;
    const [label, value] = cells;
    if (!label || !value) continue;
    specs.push({ label, value });
  }
  return specs;
}

/** The template's closing brand line, which carries no product information. */
function isBoilerplate(heading: string, body: string) {
  const combined = `${heading} ${text(body)}`.trim().toLowerCase();
  if (!combined) return true;
  return /^brandycards\s*[·|•\-]/.test(combined) || /^original trading cards\s*[·|•\-]/.test(combined);
}

export function parseEbayDescription(sanitizedHtml: string): ParsedDescription {
  const empty: ParsedDescription = { specs: [], sections: [] };
  if (!sanitizedHtml) return empty;

  // Everything before the first heading is the template's masthead: logo image
  // and tagline. The shop already shows its own branding above.
  const headingPattern = /<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi;
  const headings = [...sanitizedHtml.matchAll(headingPattern)];
  if (!headings.length) return empty;

  const specs: CardSpec[] = [];
  const sections: CardSection[] = [];

  headings.forEach((match, index) => {
    const heading = text(match[1]);
    // A description's <h1> is the template's own title block, repeating the card
    // name and its set line. The page already shows both above the description.
    const isTitleBlock = /^<h1\b/i.test(match[0]);
    const from = (match.index ?? 0) + match[0].length;
    const to = index + 1 < headings.length ? headings[index + 1].index ?? sanitizedHtml.length : sanitizedHtml.length;
    let body = sanitizedHtml.slice(from, to);

    const table = body.match(/<table\b[\s\S]*?<\/table>/i);
    if (table) {
      const parsed = tableSpecs(table[0]);
      if (parsed.length) {
        specs.push(...parsed);
        body = body.replace(table[0], "");
      }
    }

    // Images inside the description are template decoration; the card's own
    // photos are shown by the gallery above.
    body = body.replace(/<img\b[^>]*\/?>/gi, "");

    // Collect real block elements instead of unwrapping the layout divs. Loose
    // text between them — the template's closing "BrandyCards · …" line, which
    // trails the final section — is dropped along with the wrappers.
    const blocks = [...body.matchAll(/<(p|ul|ol|blockquote|pre|h[3-6])\b[^>]*>[\s\S]*?<\/\1>/gi)]
      .map((block) => block[0])
      .filter((block) => text(block) && !isBoilerplate("", block));

    const html = blocks.length
      // Verbatim slices of the sanitised input — already safe, keep as markup.
      ? blocks.join("\n")
      // No block markup at all: keep the prose so nothing is silently lost.
      // This is text, not markup, and has to be escaped on the way back in.
      : text(body) && !isBoilerplate(heading, body) ? `<p>${escapeHtml(text(body))}</p>` : "";

    if (!text(html) || isTitleBlock) return;
    sections.push({ heading, html });
  });

  // A lone heading that merely repeats the title carries no information.
  const meaningful = sections.filter((section) => text(section.html).length > 0);
  return { specs, sections: meaningful };
}
