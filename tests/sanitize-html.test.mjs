import assert from "node:assert/strict";
import test from "node:test";

const { sanitizeHtml } = await import("../lib/sanitize-html.ts");

// eBay descriptions are seller-authored HTML pasted into eBay's editor. They
// are not our markup and must never be trusted on our own origin.

test("script and style blocks are removed with their contents", () => {
  const out = sanitizeHtml('<p>Karte</p><script>alert(1)</script><style>p{color:red}</style>');
  assert.equal(out, "<p>Karte</p>");
  assert.ok(!out.includes("alert"));
});

test("an unclosed script tag cannot survive as re-openable text", () => {
  const out = sanitizeHtml("<p>a</p><script>alert(1)");
  assert.ok(!/<script/i.test(out));
  assert.ok(!out.includes("alert(1)") || !out.includes("<script"));
});

test("iframes, forms and embeds are dropped entirely", () => {
  for (const evil of [
    '<iframe src="https://evil.test"></iframe>',
    '<form action="/x"><input name="a"></form>',
    '<object data="x.swf"></object>',
    '<svg onload="alert(1)"></svg>',
  ]) {
    const out = sanitizeHtml(`<p>ok</p>${evil}`);
    assert.equal(out, "<p>ok</p>", `not neutralised: ${evil}`);
  }
});

test("event handler and style attributes are stripped", () => {
  const out = sanitizeHtml('<p onclick="alert(1)" style="color:red" class="x">Text</p>');
  assert.equal(out, "<p>Text</p>");
});

test("javascript and data URLs are refused, http links survive", () => {
  assert.equal(sanitizeHtml('<a href="javascript:alert(1)">x</a>'), "<a>x</a>");
  // Control characters are a classic filter bypass: java\tscript:
  assert.equal(sanitizeHtml('<a href="java\tscript:alert(1)">x</a>'), "<a>x</a>");
  assert.match(sanitizeHtml('<a href="https://www.ebay.de/itm/1">eBay</a>'), /href="https:\/\/www\.ebay\.de\/itm\/1"/);
  assert.match(sanitizeHtml('<a href="https://x.test">y</a>'), /rel="noopener noreferrer nofollow"/);
});

test("images keep their source but lose everything else", () => {
  const out = sanitizeHtml('<img src="https://i.ebayimg.com/a.jpg" alt="Karte" onerror="alert(1)" width="500">');
  assert.match(out, /src="https:\/\/i\.ebayimg\.com\/a\.jpg"/);
  assert.match(out, /alt="Karte"/);
  assert.match(out, /width="500"/);
  assert.ok(!out.includes("onerror"));
  assert.equal(sanitizeHtml('<img src="javascript:alert(1)">'), "<img />");
});

test("ordinary formatting is preserved", () => {
  const out = sanitizeHtml("<h2>Zustand</h2><ul><li>Near <strong>Mint</strong></li></ul><table><tr><td colspan=\"2\">x</td></tr></table>");
  assert.match(out, /<h2>Zustand<\/h2>/);
  assert.match(out, /<li>Near <strong>Mint<\/strong><\/li>/);
  assert.match(out, /colspan="2"/);
});

test("unknown tags lose their markup but keep the text", () => {
  assert.equal(sanitizeHtml("<marquee>Achtung</marquee>"), "Achtung");
  assert.equal(sanitizeHtml("<custom-el>Text</custom-el>"), "Text");
});

test("unbalanced markup is closed and cannot break out of the page", () => {
  const out = sanitizeHtml("<div><p>offen");
  assert.equal(out, "<div><p>offen</p></div>");
  const stray = sanitizeHtml("</div></body></html><p>x</p>");
  assert.equal(stray, "<p>x</p>");
});

test("comments cannot smuggle markup past the scanner", () => {
  const out = sanitizeHtml("<!-- <script>alert(1)</script> --><p>ok</p>");
  assert.equal(out, "<p>ok</p>");
});

test("bare text is escaped rather than interpreted", () => {
  assert.equal(sanitizeHtml("5 < 7 & 8 > 3"), "5 &lt; 7 &amp; 8 &gt; 3");
});

test("oversized input is truncated", () => {
  const out = sanitizeHtml("<p>" + "a".repeat(5000) + "</p>", 100);
  assert.ok(out.length < 400, `expected truncation, got ${out.length}`);
});
