import assert from "node:assert/strict";
import test from "node:test";

const { sanitizeHtml } = await import("../lib/sanitize-html.ts");
const { parseEbayDescription } = await import("../lib/ebay-description.ts");

// The real BrandyCards listing template, shortened but structurally identical:
// branded masthead, title block, a two-column detail table and three prose
// sections, then a footer line.
const TEMPLATE = `<div style="background:#000; border:1px solid #c9a44c;">
  <div style="padding:26px; text-align:center;">
    <img src="https://funkyphil94.github.io/BrandyCards_Logo.png" alt="BrandyCards Logo" style="max-width:280px;">
    <div style="color:#d9c07a;">Original Trading Cards &middot; Sport &middot; Non-Sport &middot; Displays</div>
  </div>
  <div style="padding:24px; text-align:center;">
    <h1 style="color:#c9a44c;">Antoine Griezmann &middot; Atletico Madrid</h1>
    <p style="color:#fff;">Topps UCC Chrome &middot; 24/25 &middot; Raywave &middot; 096/175</p>
  </div>
  <div style="padding:18px;"><div style="border:1px solid #c9a44c;">
    <h2 style="color:#c9a44c;">Kartendetails</h2>
    <table style="width:100%;">
      <tr><td style="font-weight:bold;">Set</td><td>Topps UCC Chrome</td></tr>
      <tr><td style="font-weight:bold;">Saison</td><td>24/25</td></tr>
      <tr><td style="font-weight:bold;">Spieler</td><td>Antoine Griezmann</td></tr>
      <tr><td style="font-weight:bold;">Variante</td><td>Raywave</td></tr>
      <tr><td style="font-weight:bold;">Nummerierung</td><td>096/175</td></tr>
    </table>
  </div></div>
  <div style="padding:18px;"><div>
    <h2>Beschreibung</h2>
    <p>Es handelt sich um eine originale <strong>Topps UCC Chrome</strong> Karte aus der Saison <strong>24/25</strong>.</p>
    <p>Es handelt sich um die Variante <strong>Raywave</strong> mit der Nummerierung <strong>096/175</strong>.</p>
  </div></div>
  <div style="padding:18px;"><div>
    <h2>Zustand &amp; Hinweise</h2>
    <p>Die Karte befindet sich in einem nahezu neuwertigen oder besseren Zustand (Near Mint or better).</p>
  </div></div>
  <div style="padding:18px;"><div>
    <h2>Versand &amp; Verpackung</h2>
    <p>Der Versand erfolgt sicher verpackt in <strong>Sleeve und Toploader</strong>.</p>
  </div></div>
  <div style="background:#000; text-align:center;">BrandyCards &middot; Original Trading Cards &middot; Faire Preise &middot; Sicher verpackt</div>
</div>`;

const parsed = parseEbayDescription(sanitizeHtml(TEMPLATE));

test("the card details table becomes label/value pairs", () => {
  assert.deepEqual(parsed.specs, [
    { label: "Set", value: "Topps UCC Chrome" },
    { label: "Saison", value: "24/25" },
    { label: "Spieler", value: "Antoine Griezmann" },
    { label: "Variante", value: "Raywave" },
    { label: "Nummerierung", value: "096/175" },
  ]);
});

test("the prose sections survive with their headings and formatting", () => {
  const headings = parsed.sections.map((section) => section.heading);
  assert.ok(headings.includes("Beschreibung"), `missing Beschreibung in ${headings}`);
  assert.ok(headings.includes("Zustand & Hinweise"), `entities must be decoded, got ${headings}`);
  assert.ok(headings.includes("Versand & Verpackung"));

  const description = parsed.sections.find((section) => section.heading === "Beschreibung");
  assert.match(description.html, /<strong>Topps UCC Chrome<\/strong>/, "inline emphasis must survive");
  assert.match(description.html, /<p>/, "paragraphs must survive");
});

test("the title block is dropped, the page already shows the card name", () => {
  const headings = parsed.sections.map((section) => section.heading);
  assert.ok(!headings.some((h) => h.includes("Antoine Griezmann")), `h1 title block must not repeat, got ${headings}`);
  const all = JSON.stringify(parsed.sections);
  assert.ok(!all.includes("Topps UCC Chrome &middot; 24/25"), "the h1 subtitle repeats the specs table");
});

test("the template masthead, logo and footer are dropped", () => {
  const all = JSON.stringify(parsed);
  assert.ok(!all.includes("BrandyCards_Logo"), "the logo image must not be repeated in the shop");
  assert.ok(!/Faire Preise/.test(all), "the eBay footer line must be dropped");
  assert.ok(!/<img/i.test(all), "no template images may remain");
});

test("the details table is not repeated as prose", () => {
  const kartendetails = parsed.sections.find((section) => section.heading === "Kartendetails");
  assert.ok(!kartendetails, "the table section becomes specs, not a prose section");
});

test("no inline styles or wrappers leak into the shop", () => {
  for (const section of parsed.sections) {
    assert.ok(!/style=/i.test(section.html), "styles must be gone");
    assert.ok(!/<div/i.test(section.html), "layout wrappers must be gone");
  }
});

test("descriptions without structure yield nothing, so the caller can fall back", () => {
  assert.deepEqual(parseEbayDescription(sanitizeHtml("<p>Nur ein Satz ohne Überschrift.</p>")), { specs: [], sections: [] });
  assert.deepEqual(parseEbayDescription(""), { specs: [], sections: [] });
});

test("a table with more than two columns is not misread as specs", () => {
  const wide = sanitizeHtml("<h2>Tabelle</h2><table><tr><td>a</td><td>b</td><td>c</td></tr></table><p>Text</p>");
  assert.deepEqual(parseEbayDescription(wide).specs, []);
});

// --- SEC-01 -----------------------------------------------------------------
// The parser runs on the sanitiser's output and hands its result to
// dangerouslySetInnerHTML. Its text() helper decodes entities, so any branch
// that puts text back into markup must escape it again — otherwise the
// sanitiser's work is undone one layer later. See docs/security-findings.md.
//
// The trigger is ordinary eBay markup: a heading followed by a <div>, with no
// <p>/<ul>/<ol> block underneath, takes the fallback branch.

/** Every route by which a section's html reaches the browser as live markup. */
function executableMarkup(sections) {
  return sections.filter((section) => /<\w+[^>]*\son[a-z]+\s*=/i.test(section.html) || /<script\b/i.test(section.html));
}

test("entity-encoded markup in a description stays inert", () => {
  const attack = "<h2>Zustand</h2><div>Karte ist top &lt;img src=x onerror=alert(1)&gt; Ende</div>";
  const result = parseEbayDescription(sanitizeHtml(attack));

  assert.equal(executableMarkup(result.sections).length, 0,
    `sanitised markup came back alive: ${JSON.stringify(result.sections)}`);
  const section = result.sections.find((entry) => entry.heading === "Zustand");
  assert.ok(section, "the section itself must survive, only its markup must not");
  assert.ok(section.html.includes("&lt;img"), `the tag must stay escaped, got ${section.html}`);
  assert.ok(section.html.includes("Karte ist top"), "the readable text must survive");
});

test("uppercase entities are no way around it either", () => {
  // decode() matches case-insensitively, so &LT; must be treated like &lt;.
  const attack = "<h2>Info</h2><div>&LT;img src=x onerror=alert(1)&GT;</div>";
  const result = parseEbayDescription(sanitizeHtml(attack));
  assert.equal(executableMarkup(result.sections).length, 0,
    `uppercase entities slipped through: ${JSON.stringify(result.sections)}`);
});

test("an entity-encoded script block stays text", () => {
  const attack = "<h2>Info</h2><div>&lt;script&gt;alert(1)&lt;/script&gt; Rest</div>";
  const result = parseEbayDescription(sanitizeHtml(attack));
  for (const section of result.sections) {
    assert.ok(!/<script/i.test(section.html), `script tag rebuilt: ${section.html}`);
  }
});

test("a bare ampersand in the fallback branch is escaped, not left dangling", () => {
  const result = parseEbayDescription(sanitizeHtml("<h2>Titel</h2><div>Sleeve &amp; Toploader</div>"));
  const section = result.sections.find((entry) => entry.heading === "Titel");
  assert.ok(section, "section expected");
  assert.equal(section.html, "<p>Sleeve &amp; Toploader</p>",
    "the text must render as 'Sleeve & Toploader', so the ampersand needs re-encoding");
});
