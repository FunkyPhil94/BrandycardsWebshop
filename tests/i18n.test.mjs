import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("language switch persists DE/EN and exposes both flags", async () => {
  const [provider, messages, chrome] = await Promise.all([
    read("app/i18n.tsx"),
    read("lib/i18n.ts"),
    read("app/site-chrome.tsx"),
  ]);

  assert.match(provider, /localStorage\.setItem\(LOCALE_KEY, locale\)/);
  assert.match(provider, /document\.cookie = .*LOCALE_KEY/);
  assert.match(provider, /x1F1E9;.*x1F1EA/);
  assert.match(provider, /x1F1EC;.*x1F1E7/);
  assert.match(provider, /aria-pressed=\{locale === "de"\}/);
  assert.match(provider, /aria-pressed=\{locale === "en"\}/);
  assert.match(messages, /localeFromRequest/);
  assert.match(messages, /ENGLISH_EXTRA/);
  assert.match(chrome, /<LanguageSwitch \/>/);
});

test("customer-facing pages keep card data untranslated while translating the shell", async () => {
  const pages = await Promise.all([
    read("app/page.tsx"),
    read("app/karten/page.tsx"),
    read("app/karten/[id]/page.tsx"),
    read("app/checkout/page.tsx"),
    read("app/agb/page.tsx"),
  ]);

  for (const page of pages) assert.match(page, /useI18n/);
  assert.match(pages[1], /\{product\.title\}/);
  assert.match(pages[2], /\{card\.title\}/);
});
