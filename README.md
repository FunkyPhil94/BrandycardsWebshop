# BrandyCards Webshop

A clean full-stack starter running on
[vinext](https://github.com/cloudflare/vinext), with optional Cloudflare D1 and
Drizzle support.

## Prerequisites

- Node.js `>=22.13.0`

## Quick Start

```bash
npm install
npm run dev
npm run build
```

This project is a custom BrandyCards webshop. It does not use a shop builder.
The public storefront is built with vinext and Cloudflare bindings are declared
in `.openai/hosting.json`.

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

The hourly sync reads seller inventory and offers through the Sell Inventory
API. After a paid webshop order, the local settlement records an idempotent
outbox job to withdraw the corresponding eBay offer. The job is processed by
the scheduled Worker with a lease, exponential retry delay, and a permanent
failure state for manual review. The write path is deliberately disabled by
default; set `EBAY_WRITE_ENABLED=true` only after the eBay OAuth refresh token
has the `sell.inventory` write scope and the withdrawal flow has been tested.

This is intentionally asynchronous: checkout and local inventory reservation
do not fail merely because eBay is temporarily unavailable. The hourly read
sync remains the safety net. eBay Notification API integration for seller-side
order events is a separate next step and must use eBay's signed notification
payloads before it can change local stock.

The Worker also exposes a Cloudflare Scheduled Handler for the hourly eBay
sync. The versioned `wrangler.toml` contains the non-secret production
bindings for the Cloudflare account, D1 database, R2 bucket, Images binding,
static Assets binding, and the cron expression `0 * * * *`. It intentionally
contains no domain routes and no secrets. The custom domain can be attached
later in Cloudflare without changing this file.

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
3. Apply the committed D1 migrations in order. For this repository, use
   `npx wrangler d1 execute brandycards-production --remote --file=drizzle/0005_add_ebay_outbox.sql`
   for the current outbox migration.
4. Add the server-only eBay, Supabase, admin, and PayPal values with
   `npx wrangler secret put NAME`. Never put those values in `wrangler.toml`,
   `.env.example`, GitHub, or the frontend.
5. Deploy with `npx wrangler deploy`.
6. Attach the custom domain in Cloudflare under the Worker’s **Domains &
   Routes** settings. Do not add a route until the Worker deployment exists.
7. Confirm that the cron trigger appears under the Worker’s **Triggers** and
   inspect the first scheduled execution in the Worker logs.

For another Cloudflare account, copy `wrangler.toml.example` to
`wrangler.toml` and replace only its account/database placeholders. The
scheduled handler queues the sync with `waitUntil`; its errors are logged
without affecting the normal HTTP `fetch` handler.

## Included Shape

- edit site code under `app/`
- `.openai/hosting.json` declares the Sites binding names for compatible previews
- `wrangler.toml` is the deployable source for the Worker’s D1, R2, Assets, and
  Images bindings
- `db/schema.ts` starts intentionally empty
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
- `npm test`: build the starter and verify its rendered loading skeleton
- `npm run db:generate`: generate Drizzle migrations after schema changes

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)
