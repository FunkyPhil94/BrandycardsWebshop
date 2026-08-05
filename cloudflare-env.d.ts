/**
 * Local type declarations for the bindings injected by the Vinext/Cloudflare
 * runtime. Wrangler can replace these with generated bindings later; keeping
 * the declarations here makes the repository's standalone TypeScript check
 * work without requiring a production Cloudflare configuration.
 */
declare type D1PreparedStatement = {
  bind(...args: unknown[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
  run(): Promise<unknown>;
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

declare module "cloudflare:workers" {
  export const env: {
    ASSETS?: Fetcher;
    DB: D1Database;
    UPLOADS: R2Bucket;
    RATE_LIMITER?: { limit(input: { key: string }): Promise<{ success: boolean }> };
    [key: string]: string | Fetcher | D1Database | R2Bucket | { limit(input: { key: string }): Promise<{ success: boolean }> } | undefined;
  };
}
