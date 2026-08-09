import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const {
  HONEYPOT_FIELD,
  RENDERED_AT_FIELD,
  MIN_FILL_MILLISECONDS,
  MAX_FORM_AGE_MILLISECONDS,
  inspectSubmission,
} = await import("../lib/form-bot-guard.ts");
const { securityHeaders, contentSecurityPolicy, CSP_HEADER_NAME, withSecurityHeaders, createNonce, isHtmlResponse } = await import("../lib/security-headers.ts");
const { changed, isUniqueViolation } = await import("../lib/user-profile.ts");

// --- E-2, bot deterrence ----------------------------------------------------

test("a filled honeypot is refused, an empty one is not", () => {
  const now = Date.now();
  assert.equal(inspectSubmission("http://spam.example", now - 10_000, now).human, false);
  assert.equal(inspectSubmission("", now - 10_000, now).human, true);
  assert.equal(inspectSubmission("   ", now - 10_000, now).human, true, "whitespace is not a fill");
});

test("a form submitted faster than a human could type is refused", () => {
  const now = Date.now();
  assert.equal(inspectSubmission("", now, now).human, false, "instant submission is a script");
  assert.equal(inspectSubmission("", now - (MIN_FILL_MILLISECONDS - 1), now).human, false);
  assert.equal(inspectSubmission("", now - (MIN_FILL_MILLISECONDS + 1), now).human, true);
});

test("a stale stamp is refused, so a captured request cannot be replayed for days", () => {
  const now = Date.now();
  assert.equal(inspectSubmission("", now - (MAX_FORM_AGE_MILLISECONDS + 1), now).human, false);
});

test("a missing stamp is not held against the sender", () => {
  // An old cached page or a browser without scripting must still reach us.
  const now = Date.now();
  for (const missing of [undefined, null, "", "nonsense", 0, -1]) {
    assert.equal(inspectSubmission("", missing, now).human, true, `rejected on renderedAt=${JSON.stringify(missing)}`);
  }
});

test("all three public forms render the guard fields and all three routes check them", async () => {
  const [forms, anfragen, verkaufen, karten] = await Promise.all([
    read("app/forms.tsx"), read("app/anfragen/page.tsx"),
    read("app/verkaufen/page.tsx"), read("app/karten/page.tsx"),
  ]);
  assert.match(forms, new RegExp(`name=\\{${HONEYPOT_FIELD === "website" ? "HONEYPOT_FIELD" : HONEYPOT_FIELD}\\}`));
  assert.match(forms, /aria-hidden="true"/, "the honeypot must be hidden from assistive technology too");
  assert.match(forms, /autoComplete="off"/, "a password manager must not fill the honeypot");
  // useFormSubmit calls form.reset() on success, which restores defaultValue="0".
  // Without re-stamping, only the first submission from a page is ever timed.
  assert.match(forms, /addEventListener\("reset"/, "the stamp must be renewed after a form reset");
  for (const [name, page] of [["anfragen", anfragen], ["verkaufen", verkaufen], ["karten", karten]]) {
    assert.match(page, /<BotGuardFields \/>/, `${name} must render the guard fields`);
  }
  for (const route of ["app/api/inquiries/route.ts", "app/api/prelisted-interest/route.ts", "app/api/card-submissions/route.ts"]) {
    assert.match(await read(route), /assertHumanSubmission\(/, `${route} must check them`);
  }
});

test("the multipart upload path checks the guard too, not just the JSON one", async () => {
  const route = await read("app/api/card-submissions/route.ts");
  const multipart = route.slice(route.indexOf("async function handleMultipartSubmission"));
  assert.match(multipart, /assertHumanSubmission\(/, "uploads are the expensive path — they need it most");
  // Both fields have to be read out of the multipart form; the JSON body
  // helper cannot do it for this path.
  assert.match(multipart, /HONEYPOT_FIELD\]: form\.get\(HONEYPOT_FIELD\)/);
  assert.match(multipart, /RENDERED_AT_FIELD\]: form\.get\(RENDERED_AT_FIELD\)/);
  assert.equal(RENDERED_AT_FIELD, "renderedAt", "the client and the route must agree on the field name");
});

// --- SEC-06, security headers ----------------------------------------------

test("the four undisputed headers are set", () => {
  const headers = securityHeaders("https://project.supabase.co");
  assert.equal(headers["x-content-type-options"], "nosniff");
  assert.equal(headers["referrer-policy"], "strict-origin-when-cross-origin");
  assert.match(headers["permissions-policy"], /camera=\(\)/);
  assert.equal(headers["x-frame-options"], "DENY");
});

test("HSTS is set, and set cautiously", () => {
  const hsts = securityHeaders("https://project.supabase.co")["strict-transport-security"];
  assert.match(hsts, /max-age=\d+/, "without this a first request can still be downgraded to HTTP");
  assert.ok(Number(hsts.match(/max-age=(\d+)/)[1]) >= 31536000, "a year is the point at which this is worth having");
  // The two parts that are hard or impossible to take back stay out: one binds
  // sibling hosts this project knows nothing about, the other asks browser
  // vendors to remember the rule permanently.
  assert.ok(!/includeSubDomains/i.test(hsts), "not this project's call to make for other hosts under the domain");
  assert.ok(!/preload/i.test(hsts), "preload is the one step that cannot be undone by deploying again");
});

test("the CSP enforces rather than reports", () => {
  assert.equal(CSP_HEADER_NAME, "content-security-policy",
    "report-only was the first step; it collects violations and blocks nothing");
  const headers = securityHeaders("https://project.supabase.co");
  assert.ok(!("content-security-policy-report-only" in headers),
    "both headers at once would be confusing and the report-only one adds nothing here");
});

test("kein 'unsafe-inline' mehr für Skripte — in keiner Antwort", () => {
  // Der Kern von ai-todo Punkt 4a. Solange `'unsafe-inline'` dastand, waren
  // **Inline-Eventhandler erlaubt**: Ein eingeschleustes `<img onerror=…>`
  // wäre gelaufen, genau die Form von SEC-01. Ein Eventhandler in einem
  // Attribut kann keinen Zufallswert tragen — mit dieser Zeile ist er tot.
  for (const policy of [
    contentSecurityPolicy("https://project.supabase.co"),
    contentSecurityPolicy("https://project.supabase.co", "abc123"),
  ]) {
    const scriptSrc = policy.match(/script-src[^;]*/)[0];
    assert.ok(!scriptSrc.includes("'unsafe-inline'"), `zurückgefallen: ${scriptSrc}`);
    assert.match(scriptSrc, /'self'/, "ein Skript von fremder Herkunft muss weiter abgelehnt werden");
  }
});

test("mit Zufallswert nennt die Regel genau diesen", () => {
  const policy = contentSecurityPolicy("https://project.supabase.co", "abc123");
  assert.match(policy, /script-src 'self' 'nonce-abc123'/);
});

test("ohne Zufallswert bleibt nur 'self' übrig", () => {
  // Antworten, die kein HTML sind, bekommen keinen Zufallswert. Dort darf auch
  // keine Lücke aufgehen: kein `'unsafe-inline'` als Ersatz.
  const policy = contentSecurityPolicy("https://project.supabase.co");
  assert.match(policy, /script-src 'self'(;|$)/);
});

test("kein 'strict-dynamic' — es würde 'self' unwirksam machen", () => {
  // Bewusste Abweichung von der Aufgabenbeschreibung: Alles, was diese Seiten
  // nachladen, kommt von dieser Herkunft und ist von `'self'` gedeckt.
  // `'strict-dynamic'` ließe Browser `'self'` ignorieren — der Gewinn wäre
  // null, der Preis eine Abhängigkeit mehr. Begründung in ai-handover.md.
  assert.ok(!contentSecurityPolicy("https://project.supabase.co", "abc123").includes("strict-dynamic"));
});

test("style-src behält 'unsafe-inline', und das ist bekannt", () => {
  // Kein Versehen: React und vinext setzen Inline-Stile. Eigene Aufgabe. Der
  // Test hält fest, dass es eine Entscheidung war.
  assert.match(contentSecurityPolicy(undefined), /style-src [^;]*'unsafe-inline'/);
});

// --- PayPal läuft live, und das darf nicht still zurückfallen --------------

test("PayPal steht auf production, nicht auf sandbox", async () => {
  // Der teuerste Fehler, den dieses Projekt hatte: `PAYPAL_ENVIRONMENT` war
  // **nirgends** gesetzt, `lib/paypal/config.ts` fiel auf `sandbox` zurück, und
  // der Shop sprach zwei Tage lang mit `api-m.sandbox.paypal.com`. Nichts war
  // kaputt, nichts wurde gemeldet — es kam nur kein Geld an. Gefunden wurde es
  // erst beim Testkauf am 2026-08-08.
  //
  // Der Rückfall ist **still**, deshalb steht hier ein Test und kein Kommentar.
  const wrangler = await readFile(new URL("../wrangler.toml", import.meta.url), "utf8");
  const vars = wrangler.slice(wrangler.indexOf("[vars]"), wrangler.indexOf("[triggers]"));
  assert.match(vars, /^PAYPAL_ENVIRONMENT = "production"$/m,
    "Ohne diesen Wert nimmt der Shop kein echtes Geld ein, sieht dabei aber gesund aus.");
});

test("der eBay-Schreibpfad bleibt eingeschaltet", async () => {
  // Dasselbe Muster wie eine Zeile höher, nur andersherum gefährlich: Steht
  // `EBAY_WRITE_ENABLED` nicht auf `true`, kehrt `processEbayOutbox` **still**
  // mit 0 zurück. Aufträge entstehen weiter, werden aber nie ausgeführt — eine
  // im Shop verkaufte Karte bliebe bei eBay im Angebot, und das kostet bei
  // einem Storno den Verkäuferstatus.
  //
  // Am 2026-08-08 nach bestätigtem Schreibzugriff eingeschaltet.
  const wrangler = await readFile(new URL("../wrangler.toml", import.meta.url), "utf8");
  const vars = wrangler.slice(wrangler.indexOf("[vars]"), wrangler.indexOf("[triggers]"));
  assert.match(vars, /^EBAY_WRITE_ENABLED = "true"$/m,
    "Ohne diesen Wert bleiben verkaufte Karten bei eBay im Angebot — lautlos.");
});

test("die Zugangsdaten stehen nicht in der versionierten Konfiguration", async () => {
  // Die Umstellung auf Live ist der Moment, in dem jemand versucht sein könnte,
  // Client ID und Secret „kurz" hier abzulegen.
  const wrangler = await readFile(new URL("../wrangler.toml", import.meta.url), "utf8");
  for (const name of ["PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET", "PAYPAL_WEBHOOK_ID"]) {
    assert.ok(!new RegExp(`^\\s*${name}\\s*=`, "m").test(wrangler), `${name} gehört als Cloudflare-Secret hinterlegt, nicht ins Repository`);
  }
});

test("die Übertragungsziele bleiben eng begrenzt", () => {
  const policy = contentSecurityPolicy("https://project.supabase.co");
  assert.match(policy, /connect-src 'self' https:\/\/project\.supabase\.co(;|$)/,
    "this is the half that matters: a stolen token has nowhere to go");
  assert.ok(!/connect-src[^;]*\*/.test(policy), "a wildcard here would give the exfiltration path back");
});

test("der Zufallswert ist bei jeder Antwort ein anderer", () => {
  // Ein wiederverwendeter Wert wäre so gut wie `'unsafe-inline'` — er stünde
  // einem Angreifer genauso zur Verfügung.
  const werte = new Set(Array.from({ length: 200 }, () => createNonce()));
  assert.equal(werte.size, 200, "ein wiederholter Wert macht die ganze Maßnahme wertlos");
});

test("der Zufallswert ist lang genug und passt in die Kopfzeile", () => {
  const nonce = createNonce();
  // 16 Bytes Base64 = 24 Zeichen. 128 Bit ist die empfohlene Untergrenze.
  assert.equal(nonce.length, 24);
  assert.match(nonce, /^[A-Za-z0-9+/]+={0,2}$/, "nur Base64 — ein Anführungszeichen bräche die Regel auf");
});

test("umgeschrieben wird nur HTML, und nur mit Rumpf", () => {
  assert.equal(isHtmlResponse(new Response("<p>x</p>", { headers: { "content-type": "text/html; charset=utf-8" } })), true);
  assert.equal(isHtmlResponse(new Response("<p>x</p>", { headers: { "content-type": "TEXT/HTML" } })), true, "Groß- und Kleinschreibung darf nicht entscheiden");
  assert.equal(isHtmlResponse(new Response("{}", { headers: { "content-type": "application/json" } })), false);
  assert.equal(isHtmlResponse(new Response("x", { headers: { "content-type": "text/javascript" } })), false);
  assert.equal(isHtmlResponse(new Response("x")), false, "ohne Angabe wird nichts angefasst");
});

test("Antworten ohne Rumpf werden nicht umgeschrieben", () => {
  // Die 304 ist der heikle Fall: Der Rumpf käme aus dem Zwischenspeicher des
  // Browsers und trüge den **alten** Zufallswert, während die Kopfzeile einen
  // frischen nennt. Jedes Skript der Seite wäre dann stillgelegt.
  for (const status of [204, 304]) {
    assert.equal(isHtmlResponse(new Response(null, { status, headers: { "content-type": "text/html" } })), false, `Status ${status}`);
  }
});

test("the policy allows what the shop actually needs and forbids the rest", () => {
  const policy = contentSecurityPolicy("https://project.supabase.co");
  assert.match(policy, /img-src[^;]*i\.ebayimg\.com/, "card photos come from eBay's CDN");
  assert.match(policy, /img-src[^;]*data:/, "the sanitiser allows inline data: images");
  assert.match(policy, /connect-src[^;]*https:\/\/project\.supabase\.co/, "auth is called from the browser");
  assert.match(policy, /frame-ancestors 'none'/, "the shop does not belong in someone else's frame");
  assert.match(policy, /object-src 'none'/);
  assert.match(policy, /base-uri 'self'/);
});

test("a missing Supabase URL does not produce a broken connect-src", () => {
  const policy = contentSecurityPolicy(undefined);
  assert.match(policy, /connect-src 'self'(;|$)/, `dangling directive: ${policy}`);
  assert.ok(!policy.includes("undefined"));
});

test("headers are added without overwriting what a route set on purpose", async () => {
  const original = new Response("{}", { headers: { "cache-control": "no-store", "x-frame-options": "SAMEORIGIN" } });
  const hardened = withSecurityHeaders(original, "https://project.supabase.co");
  assert.equal(hardened.headers.get("cache-control"), "no-store", "the route's own header must survive");
  assert.equal(hardened.headers.get("x-frame-options"), "SAMEORIGIN", "a deliberate override must survive");
  assert.equal(hardened.headers.get("x-content-type-options"), "nosniff");
  assert.equal(await hardened.text(), "{}", "the body must come through unchanged");
});

test("a bodyless response survives hardening", () => {
  for (const status of [204, 304]) {
    const hardened = withSecurityHeaders(new Response(null, { status }), undefined);
    assert.equal(hardened.status, status);
    assert.equal(hardened.headers.get("x-content-type-options"), "nosniff");
  }
});

test("the worker actually applies them to every response", async () => {
  const worker = await read("worker/index.ts");
  assert.match(worker, /withSecurityHeaders/, "the headers must be wired up, not just written");
  assert.match(worker, /harden\(await handler\.fetch/, "server-rendered pages need them too");
  assert.match(worker, /harden\(await handleImageOptimization/, "so does the image endpoint");
});

// --- SEC-05, catalogue caching ---------------------------------------------

test("the catalogue is cacheable at the edge, failures are not", async () => {
  const route = await read("app/api/products/route.ts");
  // Untergrenze statt fester Wert. Am 2026-08-08 wurde die Frist von 60 auf 30
  // gesenkt, damit eine verkaufte Karte schneller aus dem Schaufenster
  // verschwindet — die Obergrenze prüft `tests/catalog-availability.test.mjs`.
  // **Hier geht es um die andere Richtung:** Ganz ohne Zwischenspeicher liest
  // jeder Aufruf ~1 725 Zeilen aus D1, bei 128 KB Antwort und ohne Anmeldung
  // davor. Das war SEC-05.
  const maxAge = Number(route.match(/max-age=(\d+)/)?.[1]);
  assert.ok(maxAge >= 15, `max-age=${maxAge} ist zu kurz: ~1 725 D1-Zeilen je Aufruf dürfen nicht bei jedem Seitenaufruf anfallen`);
  assert.match(route, /stale-while-revalidate/);
  const failure = route.slice(route.indexOf("catch (error)"));
  assert.match(failure, /"cache-control": "no-store"/, "a cached 503 turns one bad moment into a minute-long outage");
});

// --- SEC-04, eBay quota -----------------------------------------------------

test("the eBay description lookup is rate limited, the card is not", async () => {
  const route = await read("app/api/products/[id]/route.ts");
  assert.match(route, /enforcePublicRateLimit\(request, "ebay-description"\)/);
  assert.match(route, /withinEbayFetchBudget/, "running out of budget must cost the description, not the card");
  const guard = route.slice(route.indexOf("async function withinEbayFetchBudget"), route.indexOf("export async function GET"));
  assert.match(guard, /return false/, "the limit must not turn into a 500");
});

// --- S-04, authenticated routes -------------------------------------------

test("authenticated routes rate-limit expensive reads, writes and payments", async () => {
  const routes = [
    ["app/api/price-offers/route.ts", "price-offers"],
    ["app/api/account/data/route.ts", "account-data"],
    ["app/api/account/delete/route.ts", "account-delete"],
    ["app/api/account/profile/route.ts", "account-profile"],
    ["app/api/paypal/orders/route.ts", "paypal-orders"],
    ["app/api/paypal/capture/route.ts", "paypal-capture"],
  ];
  for (const [path, scope] of routes) {
    const route = await read(path);
    assert.match(route, /enforcePublicRateLimit\(request, /, `${path} must call the shared limiter`);
    assert.match(route, new RegExp(`enforcePublicRateLimit\\(request, "${scope}"\\)`), `${path} must use its own limiter scope`);
    assert.match(route, /RateLimitError/, `${path} must distinguish 429 from a service failure`);
    assert.match(route, /status: error\.status/, `${path} must preserve the limiter status`);
    assert.match(route, /retry-after/, `${path} must tell the client when to try again`);
  }
});

// --- SEC-07, no password on our own server ---------------------------------

test("the registration check neither expects nor accepts a password", async () => {
  const [route, page] = await Promise.all([read("app/api/account/validate-registration/route.ts"), read("app/account/page.tsx")]);
  assert.ok(!/body\.password/.test(route.replace(/"password" in body/, "")), "the route must not read a password");
  assert.match(route, /"password" in body/, "and must refuse one if it arrives anyway");
  const signup = page.slice(page.indexOf('mode === "signup"'), page.indexOf("supabase.auth.signUp"));
  assert.ok(!/body: JSON.stringify\(\{ username, password/.test(signup), "the browser must not send it");
  assert.match(signup, /password\.length < 8/, "length is checked in the browser instead");
  assert.match(signup, /password !== passwordConfirmation/);
});

// --- SEC-08, upload size ----------------------------------------------------

test("a multipart upload without Content-Length is refused before the body is buffered", async () => {
  const route = await read("app/api/card-submissions/route.ts");
  const multipart = route.slice(route.indexOf("async function handleMultipartSubmission"));
  const beforeFormData = multipart.slice(0, multipart.indexOf("await request.formData()"));
  assert.match(beforeFormData, /declaredLength === null/, "a missing header used to read as 0 and sail past the ceiling");
  assert.match(beforeFormData, /411/, "the right answer is Length Required, not a crash");
  assert.ok(!/Number\(request\.headers\.get\("content-length"\) \?\? 0\)/.test(route),
    "`?? 0` is exactly the bypass: no header means no limit");
});

// --- SEC-09, write amplification and username collisions -------------------

test("an unchanged profile is not written back on every request", () => {
  const existing = { email: "a@b.de", username: "alice", role: "CUSTOMER" };
  assert.equal(changed(existing, { email: "a@b.de", username: "alice" }), false);
  assert.equal(changed(existing, { email: "a@b.de", username: "alicia" }), true);
  assert.equal(changed(existing, { role: "ADMIN" }), true);
});

test("a taken username is recognised as a unique violation, not a crash", () => {
  assert.equal(isUniqueViolation(new Error("D1_ERROR: UNIQUE constraint failed: users.username")), true);
  assert.equal(isUniqueViolation(new Error("no such table: users")), false);
  assert.equal(isUniqueViolation("not an error"), false);
});

test("a taken username leaves the account usable instead of breaking every request", async () => {
  const appUser = await read("lib/app-user.ts");
  assert.match(appUser, /isUniqueViolation\(error\)/,
    "this runs on every authenticated request — an unhandled violation locks the account out of the shop");
  assert.match(appUser, /changed\(existing, next\)/);
});

// --- SEC-11, dead header-trusting auth --------------------------------------

test("the starter's header-trusting auth helper is gone", async () => {
  await assert.rejects(access(new URL("../app/chatgpt-auth.ts", import.meta.url)),
    "a module that reads identity straight out of a request header must not sit around waiting to be imported");
  const readme = await read("README.md");
  assert.ok(!/Import the ready-to-use helpers/.test(readme), "the README must not invite anyone to use it");
});

// --- Jede Adminroute prüft die Rolle ----------------------------------------

test("keine Route unter /api/admin ohne Rollenprüfung", async () => {
  // SEC-12 fiel auf, weil **eine** Adminroute die Prüfung nicht hatte — gefunden
  // durch Hinsehen, nicht durch eine Regel. Diese Regel gibt es jetzt: Wer eine
  // Adminroute hinzufügt und die Prüfung vergisst, bekommt einen roten Lauf
  // statt einer offenen Tür.
  const { readdir } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const wurzel = new URL("../app/api/admin/", import.meta.url);
  const eintraege = await readdir(wurzel, { recursive: true, withFileTypes: true });
  const routen = eintraege
    .filter((eintrag) => eintrag.isFile() && eintrag.name === "route.ts")
    .map((eintrag) => join(eintrag.parentPath ?? eintrag.path, eintrag.name).replaceAll("\\", "/"));

  assert.ok(routen.length >= 5, `zu wenige Adminrouten gefunden (${routen.length}) — der Scan greift ins Leere`);

  const ohnePruefung = [];
  for (const route of routen) {
    const quelle = await readFile(route, "utf8");
    // Zwei zulässige Schreibweisen: der Helfer `requireAdmin` (die Mehrheit)
    // und die ausgeschriebene Rollenprüfung. Beides schützt; auf nur eine
    // Schreibweise zu prüfen hätte vier gesunde Routen angeschwärzt.
    const geschuetzt = /requireAdmin\(/.test(quelle) || /\.role !== "ADMIN"/.test(quelle);
    if (!geschuetzt) ohnePruefung.push(route.split("/app/api/admin/")[1] ?? route);
  }

  // Die eBay-OAuth-Rückseite ist die eine begründete Ausnahme: eBay leitet den
  // *Browser* dorthin um, und eine Navigation trägt keinen Authorization-Header.
  // Eine Prüfung würde den eBay-Anschluss blockieren, ohne etwas zu sichern —
  // die Begründung steht als Kommentar an der Route (SEC-12).
  assert.deepEqual(ohnePruefung, ["ebay/oauth/callback/route.ts"],
    "eine Adminroute ohne Rollenprüfung ist eine offene Tür; die einzige zulässige Ausnahme ist die OAuth-Rückseite");
});

test("Adminrouten verlangen MFA, und die Einrichtung ist die einzige AAL1-Ausnahme", async () => {
  const access = await read("lib/admin-access.ts");
  assert.match(access, /claims\.aal !== "aal2"/u, "die Serverprüfung darf nicht nur auf Browserzustand vertrauen");
  assert.match(access, /MFA_REQUIRED/u);
  const mfaStatus = await read("app/api/admin/mfa/status/route.ts");
  assert.match(mfaStatus, /requireMfa: false/u, "nur der MFA-Einrichtungsstatus darf vor AAL2 erreichbar sein");
  const routes = [
    "app/api/admin/dashboard/route.ts",
    "app/api/admin/products/route.ts",
    "app/api/admin/orders/route.ts",
    "app/api/admin/offers/route.ts",
    "app/api/admin/ebay-sync/route.ts",
  ];
  for (const path of routes) assert.match(await read(path), /requireAdmin\(/u, `${path} muss die zentrale MFA-Prüfung verwenden`);
});

test("kritische Adminaktionen verlangen frische MFA und schreiben Auditspuren", async () => {
  const access = await read("lib/admin-access.ts");
  assert.match(access, /recentAuthSeconds/u);
  assert.match(access, /RECENT_MFA_REQUIRED/u);
  const audit = await read("lib/admin-audit.ts");
  assert.match(audit, /auditEvents/u);
  assert.match(audit, /ipHash/u, "IP-Adressen dürfen nur gehasht, nicht roh gespeichert werden");
  for (const path of [
    "app/api/admin/products/route.ts",
    "app/api/admin/orders/route.ts",
    "app/api/admin/offers/route.ts",
    "app/api/admin/card-submissions/route.ts",
    "app/api/admin/ebay-sync/route.ts",
    "app/api/admin/ebay/outbox/run/route.ts",
    "app/api/admin/ebay/oauth/start/route.ts",
  ]) {
    const route = await read(path);
    assert.match(route, /recentAuthSeconds: 600/u, `${path} muss vor kritischen Aktionen eine frische MFA verlangen`);
  }
  assert.match(await read("app/api/admin/ebay-sync/route.ts"), /recordAdminAudit/u);
  assert.match(await read("app/api/admin/offers/route.ts"), /recordAdminAudit/u);
});

// --- S-01, der geplante Lauf darf nicht am ersten Fehler abbrechen ----------

test("der geplante Lauf benutzt allSettled, nicht all", async () => {
  // `Promise.all` lehnt bei der ersten Ablehnung ab. Die Zusage an waitUntil
  // waere damit erledigt, waehrend die uebrigen Aufgaben noch laufen - und die
  // Laufzeitumgebung darf den Vorgang dann abraeumen. `runEbaySync` lehnt
  // regelmaessig ab (24 solcher Laeufe stehen in sync_runs), und mitgerissen
  // wuerde ausgerechnet processEbayOutbox: die Ruecknahme verkaufter Karten
  // bei eBay. Siehe docs/pruefbericht-2026-08-09.md, S-01.
  const worker = await read("worker/index.ts");
  const scheduled = worker.slice(worker.indexOf("scheduled("));
  assert.match(scheduled, /Promise\.allSettled\(/u);
  assert.ok(!/Promise\.all\(/u.test(scheduled),
    "ein einziger eBay-Fehler wuerde die eBay-Ruecknahme mitreissen");
});

test("jede Aufgabe des geplanten Laufs wird einzeln benannt", async () => {
  // Die alte Zeile meldete jeden Fehler als "eBay-Synchronisierung
  // fehlgeschlagen" - auch dann, wenn in Wahrheit die Loeschfrist gerissen war.
  // Ein Protokoll, das die falsche Ursache nennt, ist schlechter als keins.
  const worker = await read("worker/index.ts");
  const scheduled = worker.slice(worker.indexOf("scheduled("));
  for (const name of ["eBay-Synchronisierung", "eBay-Rücknahmen", "Freigabe abgelaufener Reservierungen"]) {
    assert.ok(scheduled.includes(name), `die Aufgabe "${name}" wird im Fehlerfall nicht beim Namen genannt`);
  }
  assert.match(scheduled, /ergebnis\.status !== "rejected"/u, "jeder Fehlschlag muss einzeln protokolliert werden");
});
