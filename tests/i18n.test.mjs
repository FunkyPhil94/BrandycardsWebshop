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
  assert.match(provider, /syncAccountLocale/);
  assert.match(messages, /localeFromRequest/);
  assert.match(messages, /ENGLISH_EXTRA/);
  assert.match(chrome, /<LanguageSwitch \/>/);
});

test("account language is stored and restored through the profile route", async () => {
  // Die Sprache des Kontos wird seit der Aufteilung am 2026-08-17 im
  // Profilbereich gesetzt, nicht mehr auf der Einstiegsseite.
  const [provider, account, profileRoute, schema, migration] = await Promise.all([
    read("app/i18n.tsx"),
    read("app/account/profil/page.tsx"),
    read("app/api/account/profile/route.ts"),
    read("db/schema.ts"),
    read("drizzle/0008_user_preferred_locale.sql"),
  ]);

  assert.match(provider, /\/api\/account\/profile/);
  assert.match(account, /preferredLocale/);
  assert.match(profileRoute, /preferredLocale/);
  assert.match(schema, /preferredLocale: text\("preferred_locale"/);
  assert.match(migration, /preferred_locale/);
  assert.match(migration, /'de'/);
  assert.match(migration, /'en'/);
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

test("öffentliche Texte verwenden keine Gedankenstriche und Vorverkauf bleibt im Fließtext", async () => {
  const [anfragen, home, cards, offer, preSale, account, kontoHuelle, kontoBestellungen, kontoProfil, kontoDaten, privacy, shipping, styles] = await Promise.all([
    read("app/anfragen/page.tsx"),
    read("app/page.tsx"),
    read("app/karten/page.tsx"),
    read("app/karten/[id]/offer-form.tsx"),
    read("app/vorverkauf/page.tsx"),
    read("app/account/page.tsx"),
    read("app/account/account-shell.tsx"),
    read("app/account/bestellungen/page.tsx"),
    read("app/account/profil/page.tsx"),
    read("app/account/daten/page.tsx"),
    read("app/datenschutz/page.tsx"),
    read("app/versand-zahlung/page.tsx"),
    read("app/globals.css"),
  ]);

  for (const source of [anfragen, home, cards, offer, preSale, account, kontoHuelle, kontoBestellungen, kontoProfil, kontoDaten, privacy, shipping]) {
    for (const match of source.matchAll(/\bt\("([^"]*)"/gu)) {
      assert.doesNotMatch(match[1], /[—–]/u, `Gedankenstrich in sichtbarem Text: ${match[1]}`);
    }
  }
  assert.match(anfragen, /text-link text-link-inline/u);
  assert.match(styles, /\.text-link-inline \{[^}]*min-width:0/u);
});
