/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { runEbaySync } from "../lib/ebay-sync";
import { getDb } from "../db";
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
    ctx.waitUntil(
      Promise.all([
        runEbaySync(),
        releaseExpiredReservations(getDb(), now),
        processEbayOutbox(getDb()),
        expireLapsedOffers(getDb(), now),
        // Aufbewahrungsfrist für abgeschlossene Kartenangebote. Gehört in den
        // geplanten Lauf, nicht in eine Admin-Schaltfläche: eine Löschfrist,
        // die jemand von Hand auslösen muss, ist keine.
        deleteExpiredCardSubmissions(),
      ]).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Unbekannter Fehler";
        console.error("[scheduled-ebay-sync] eBay-Synchronisierung fehlgeschlagen:", message);
      }),
    );
  },
};

export default worker;
