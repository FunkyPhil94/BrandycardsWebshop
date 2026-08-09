/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { lte } from "drizzle-orm";
import { runEbaySync } from "../lib/ebay-sync";
import { getDb } from "../db";
import { ebayOauthClaims } from "../db/schema";
import { deleteExpiredCardSubmissions } from "../lib/card-submission-cleanup";
import { releaseExpiredReservations } from "../lib/paypal/settle-order";
import { processEbayOutbox } from "../lib/ebay-outbox";
import { expireLapsedOffers } from "../lib/price-offers";
import { createNonce, isHtmlResponse, withSecurityHeaders } from "../lib/security-headers";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

interface ScheduledController {
  scheduledTime: number;
  cron: string;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Every response leaves through here, so this is the one place where the
    // security headers reach server-rendered pages, API answers and assets
    // alike. `public/_headers` would only cover the last of the three.
    // See docs/security-findings.md, SEC-06.
    //
    // Seit dem 2026-08-08 entsteht hier zusätzlich der Zufallswert für die
    // Inline-Skripte. Er muss **je Antwort** neu sein und **dieselbe** Antwort
    // an zwei Stellen erreichen: die Kopfzeile und jedes `<script>` im Markup.
    // Deshalb steht beides in einer Funktion — auseinandergezogen wäre es der
    // Fehler, der die ganze Seite leer lässt.
    const harden = (response: Response) => {
      const nonce = isHtmlResponse(response) ? createNonce() : undefined;
      const hardened = withSecurityHeaders(response, process.env.NEXT_PUBLIC_SUPABASE_URL, nonce);
      if (!nonce) return hardened;
      // `HTMLRewriter` schreibt im Strom mit, hält also die Auslieferung nicht
      // an. Er trifft **jedes** `<script>`, nicht nur die ohne `src`: Ein Tag
      // ohne Zufallswert wäre unter dieser Regel stillgelegt, und der Ausfall
      // wäre still.
      return new HTMLRewriter().on("script", {
        element(element) { element.setAttribute("nonce", nonce); },
      }).transform(hardened);
    };

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return harden(await handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths));
    }

    return harden(await handler.fetch(request, env, ctx));
  },

  scheduled(_controller: ScheduledController, _env: Env, ctx: ExecutionContext): void {
    const now = new Date().toISOString();
    // **`allSettled`, nicht `all` — und das ist kein Stilfrage.**
    //
    // `Promise.all` lehnt ab, sobald die **erste** Zusage ablehnt. Die Zusage,
    // die hier an `waitUntil` geht, wäre damit erledigt, während die übrigen
    // fünf noch laufen — und die Laufzeitumgebung darf den Vorgang dann
    // abräumen. `runEbaySync` lehnt regelmäßig ab (eBay antwortet nicht, Token
    // abgelaufen, Zeitgrenze; in `sync_runs` stehen 24 solcher Läufe), und die
    // Aufgabe, die dabei mitgerissen würde, ist ausgerechnet
    // `processEbayOutbox`: die Rücknahme verkaufter Karten bei eBay. Ein
    // abgebrochener Auftrag heißt, dass eine im Shop verkaufte Karte dort
    // weiter im Angebot steht — der Doppelverkauf, gegen den die halbe
    // Maschinerie gebaut ist.
    //
    // Mit `allSettled` läuft jede Aufgabe zu Ende, und **jeder** Fehlschlag
    // wird einzeln protokolliert statt vom ersten verdeckt. Die alte Zeile
    // meldete zudem jeden Fehler als „eBay-Synchronisierung fehlgeschlagen",
    // auch wenn in Wahrheit die Löschfrist gerissen war.
    //
    // Siehe docs/pruefbericht-2026-08-09.md, S-01.
    const aufgaben = [
      ["eBay-Synchronisierung", runEbaySync()],
      ["Freigabe abgelaufener Reservierungen", releaseExpiredReservations(getDb(), now)],
      ["eBay-Rücknahmen", processEbayOutbox(getDb())],
      ["Ablauf angenommener Preisvorschläge", expireLapsedOffers(getDb(), now)],
      // Aufbewahrungsfrist für abgeschlossene Kartenangebote. Gehört in den
      // geplanten Lauf, nicht in eine Admin-Schaltfläche: eine Löschfrist,
      // die jemand von Hand auslösen muss, ist keine.
      ["Aufbewahrungsfrist für Kartenangebote", deleteExpiredCardSubmissions()],
      // Abgelaufene eBay-OAuth-Ansprüche (SEC-12). Die Abholroute räumt zwar
      // selbst auf, aber nur wenn sie gerufen wird — ein abgebrochener
      // Anschlussversuch ruft sie nie, und die Zeile trüge weiter einen
      // gültigen Refresh-Token.
      ["Abgelaufene eBay-OAuth-Ansprüche", getDb().delete(ebayOauthClaims).where(lte(ebayOauthClaims.expiresAt, now))],
    ] as const satisfies ReadonlyArray<readonly [string, PromiseLike<unknown>]>;

    ctx.waitUntil(
      Promise.allSettled(aufgaben.map(([, zusage]) => zusage)).then((ergebnisse) => {
        ergebnisse.forEach((ergebnis, index) => {
          if (ergebnis.status !== "rejected") return;
          const grund = ergebnis.reason;
          const message = grund instanceof Error ? grund.message : String(grund);
          console.error(`[scheduled] ${aufgaben[index][0]} fehlgeschlagen:`, message);
        });
      }),
    );
  },
};

export default worker;
