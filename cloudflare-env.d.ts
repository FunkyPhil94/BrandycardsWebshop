/**
 * Local type declarations for the bindings injected by the Vinext/Cloudflare
 * runtime. Wrangler can replace these with generated bindings later; keeping
 * the declarations here makes the repository's standalone TypeScript check
 * work without requiring a production Cloudflare configuration.
 */
declare type D1PreparedStatement = {
  bind(...args: unknown[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<{ results: T[]; success: boolean }>;
  run(): Promise<{ success: boolean; meta: { changes: number } }>;
};
declare type D1Database = {
  prepare(...args: unknown[]): D1PreparedStatement;
  batch(...args: unknown[]): Promise<unknown>;
  exec(...args: unknown[]): Promise<unknown>;
  dump(...args: unknown[]): Promise<unknown>;
};
declare type R2Bucket = {
  put(key: string, value: ArrayBuffer | ArrayBufferView | ReadableStream | string | Blob, options?: Record<string, unknown>): Promise<unknown>;
  delete(key: string): Promise<void>;
  get(key: string): Promise<{ body: ReadableStream } | null>;
  list(options?: { prefix?: string; cursor?: string; limit?: number }): Promise<{ objects: Array<{ key: string; uploaded?: Date }>; truncated: boolean; cursor?: string }>;
};
declare type Fetcher = { fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> };

/** Nur so viel von `HTMLRewriter`, wie `worker/index.ts` benutzt.
 *
 * Er hängt den Zufallswert der CSP an jedes `<script>` (ai-todo Punkt 4a).
 * Wie der Rest dieser Datei von Hand erklärt, damit `npx tsc --noEmit` ohne
 * Cloudflare-Konfiguration durchläuft. */
declare type HTMLRewriterElement = {
  setAttribute(name: string, value: string): void;
  getAttribute(name: string): string | null;
  removeAttribute(name: string): void;
};
declare class HTMLRewriter {
  on(selector: string, handlers: { element?(element: HTMLRewriterElement): void }): HTMLRewriter;
  transform(response: Response): Response;
}

declare module "cloudflare:workers" {
  export const env: {
    ASSETS?: Fetcher;
    DB: D1Database;
    UPLOADS: R2Bucket;
    RATE_LIMITER?: { limit(input: { key: string }): Promise<{ success: boolean }> };
    RATE_LIMITER_STRICT?: { limit(input: { key: string }): Promise<{ success: boolean }> };
    [key: string]: string | Fetcher | D1Database | R2Bucket | { limit(input: { key: string }): Promise<{ success: boolean }> } | undefined;
  };
}
