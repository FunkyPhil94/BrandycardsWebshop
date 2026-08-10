# BrandyCards Webshop

Der öffentliche BrandyCards-Shop läuft mit vinext (Next.js/React) auf einem
Cloudflare Worker. D1 speichert Katalog, Bestand und Bestellungen, R2 hält
Uploads; Supabase, PayPal und eBay sind als serverseitige Integrationen
angebunden. Die kanonische Produktion ist `https://shop.brandycards.de`.

## Prerequisites

- Node.js `>=22.13.0`

## Quick Start

```bash
npm install
npm run dev
npm run build
```

This project is a custom BrandyCards webshop. It does not use a shop builder.
The production Worker bindings are declared in `wrangler.toml`; `.openai/hosting.json`
only describes the separate Sites preview/hosting project and must not be
treated as the production data source.

## Authentication and administration

Customer authentication uses Supabase email/password authentication. The
application verifies the Supabase access token server-side and maintains its
own `users` record in D1. New accounts always receive the `CUSTOMER` role.

The `/admin` page and `/api/admin/dashboard` endpoint require both a valid
Supabase session and the server-side `ADMIN` role. Admin users must be promoted
through the server-only `ADMIN_EMAILS` allowlist or a controlled D1 maintenance
procedure; there is no public role-changing form. Only confirmed email
addresses in the allowlist are promoted, and existing admin roles are never
automatically downgraded by removing an address.

## eBay synchronization

To create the production refresh token, set the eBay app's OAuth accepted URL to
`https://shop.brandycards.de/api/admin/ebay/oauth/callback`, then use the admin
button **eBay OAuth verbinden / Refresh-Token erstellen**. The callback exchanges
the one-time authorization code for a refresh token; the API Explorer token is
not suitable for `EBAY_REFRESH_TOKEN`. Store the displayed refresh token only as
the Cloudflare secret `EBAY_REFRESH_TOKEN` and never commit or paste it into chat.

The three-minute sync reads seller inventory and offers through the Sell
Inventory API. After a paid webshop order, local settlement records an
idempotent outbox job to withdraw the corresponding eBay offer. The scheduled
Worker processes it with a lease, exponential retry delay and a permanent
failure state for manual review. The production configuration currently has
`EBAY_WRITE_ENABLED=true`; the OAuth token must carry the `sell.inventory`
write scope.

Checkout and local inventory reservation do not fail merely because eBay is
temporarily unavailable. The read sync remains the safety net. Seller-side
order events are accepted through `/api/ebay/notifications` only after eBay's
signature and topic checks; duplicate notifications are idempotent.

The versioned `wrangler.toml` contains the non-secret production bindings for
the Cloudflare account, D1 database, R2 bucket, Images, static Assets, rate
limits, the `shop.brandycards.de` custom domain and the three-minute cron. It
contains no secrets.

Before the first production deployment:

1. Run `npm run build` so the client assets exist in `dist/client`.
   **`.env.local` must be present in the directory you build from.** The
   `NEXT_PUBLIC_SUPABASE_*` values are inlined into the client bundle at build
   time, not read at runtime. Building without them produces a bundle that
   fails with "Supabase ist noch nicht konfiguriert" on every page that needs a
   session — `/account` and `/admin` — while the rest of the site looks healthy.
   Setting the values as Cloudflare secrets does not help; only the build sees
   them. This bites especially in a git worktree, which does not inherit the
   ignored `.env.local` from the main checkout. Verify after building:
   `grep -rl "supabase.co" dist/client/assets` must return the Supabase chunk.
2. Log in with `npx wrangler login` using an account that can deploy Workers
   and access the configured D1/R2 resources.
3. Apply the committed D1 migrations in order. For a fresh or newly updated
   production database, the latest schema migration is
   `npx wrangler d1 execute brandycards-production --remote --file=drizzle/0008_user_preferred_locale.sql`.
4. Add the server-only eBay, Supabase, admin, and PayPal values with
   `npx wrangler secret put NAME`. Never put those values in `wrangler.toml`,
   `.env.example`, GitHub, or the frontend.

### Customer emails (optional, off until configured)

Order confirmations and offer decisions are sent through
[Resend](https://resend.com). **The shop runs fine without it**: when
`RESEND_API_KEY` is absent the send step logs one line and returns, and no
customer-facing action fails because of it.

To switch it on:

1. Verify the sending domain at Resend. Skipping this makes every message
   bounce, which is worse than sending nothing.
2. `npx wrangler secret put RESEND_API_KEY`
3. Optionally override `EMAIL_FROM`, `EMAIL_REPLY_TO` and `SHOP_BASE_URL` in
   `wrangler.toml` — these are not secrets, only the API key is.

The wording lives in `lib/email/templates.ts` as plain functions, so it can be
changed and tested without sending anything (`tests/email.test.mjs`).

### Self-service account deletion (needed by `/account`)

`POST /api/account/delete` removes the customer's shop data **and** their
Supabase login. Deleting the login needs a Supabase **service-role key**:

1. Supabase dashboard → Project Settings → API → `service_role` secret.
2. `npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY`

**This key bypasses every row-level rule in Supabase.** It is used in exactly
one place (`lib/supabase-admin.ts`), never reaches the browser, and must never
appear in `wrangler.toml`, `.env.example`, or the repository.

Without it the route refuses with 503 **before deleting anything** — on purpose.
Shop data gone while the login still works is a worse state than the one before,
so the shop would rather do nothing and point the customer at the mailbox.

5. Deploy with `npx wrangler deploy`.
6. Confirm that `shop.brandycards.de` answers with HTTP 200, that `/robots.txt`
   references `/sitemap.xml`, and that the cron trigger appears under the
   Worker’s **Triggers**.
7. Inspect the first scheduled execution in the Worker logs. Do not paste
   tokens or customer data into tickets, commits or chat.

For another Cloudflare account, copy `wrangler.toml.example` to
`wrangler.toml` and replace only its account/database placeholders. The
scheduled handler queues the sync with `waitUntil`; its errors are logged
without affecting the normal HTTP `fetch` handler.

## SEO and public URLs

The public Worker emits canonical metadata for the main routes, dynamic
product metadata under `/karten/:id`, safe schema.org `Product` data for fixed
price cards, `robots.txt`, and a D1-backed `sitemap.xml` containing only cards
that are actually visible in the catalogue. Account, admin, checkout and API
paths are excluded from crawling.

## Included Shape

- edit site code under `app/`
- `.openai/hosting.json` declares the Sites project and logical bindings for a
  compatible preview
- `wrangler.toml` is the deployable source for the Worker’s D1, R2, Assets,
  Images, rate limits and production route
- `db/schema.ts` contains the production schema used by D1
- `examples/d1/` contains an optional D1 example surface
- `drizzle.config.ts` supports local migration generation when needed

## Workspace Auth Headers — bewusst nicht verwendet

Die Starter-Vorlage brachte Hilfsfunktionen mit, die die HTTP-Kopfzeilen
`oai-authenticated-user-id` und `oai-authenticated-user-email` als Identität
lesen. Sie sind **entfernt** (`app/chatgpt-auth.ts`), und dieser Shop darf sie
auch nicht wieder einführen: Diese Kopfzeilen werden nur von einer
vorgeschalteten Plattform gesetzt, die es hier nicht gibt. Wer sie direkt
schickt, wäre damit angemeldet — als beliebiger Nutzer.

Die Identität kommt ausschließlich aus einem Supabase-Zugriffstoken, das
serverseitig gegen die Projektinstanz geprüft wird (`lib/supabase-server.ts`).
Siehe [docs/security-findings.md](docs/security-findings.md), SEC-11.

## Useful Commands

- `npm run dev`: start local development
- `npm run build`: verify the vinext build output
- `npm test`: build the Worker bundle and run the complete regression suite
- `npm run lint`: run ESLint
- `npx tsc --noEmit`: run the TypeScript check
- `npm audit --omit=dev`: inspect production dependency advisories
- `npm run db:generate`: generate Drizzle migrations after schema changes

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)
