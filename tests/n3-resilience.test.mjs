import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const { readTextBody, RequestBodyError } = await import("../lib/request-body.ts");

test("request bodies stop at the byte limit even without Content-Length", async () => {
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("12345"));
      controller.close();
    },
  });
  await assert.rejects(
    readTextBody(new Request("https://shop.test/api", { method: "POST", body, duplex: "half" }), 4),
    (error) => error instanceof RequestBodyError && error.status === 413,
  );
});

test("invalid and oversized declared lengths are rejected before reading", async () => {
  await assert.rejects(
    readTextBody(new Request("https://shop.test/api", { headers: { "content-length": "not-a-number" } }), 64),
    (error) => error instanceof RequestBodyError && error.status === 400,
  );
  await assert.rejects(
    readTextBody(new Request("https://shop.test/api", { headers: { "content-length": "65" } }), 64),
    (error) => error instanceof RequestBodyError && error.status === 413,
  );
});

test("external identity and OAuth calls have finite deadlines", async () => {
  const [supabase, admin, ebay, worker] = await Promise.all([
    readFile(new URL("../lib/supabase-server.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/supabase-admin.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/ebay/oauth/callback/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../worker/index.ts", import.meta.url), "utf8"),
  ]);
  assert.match(supabase, /AbortSignal\.timeout\(10_000\)/u);
  assert.match(admin, /AbortSignal\.timeout\(10_000\)/u);
  assert.match(ebay, /AbortSignal\.timeout\(10_000\)/u);
  assert.match(worker, /content-length/u);
  assert.match(worker, /status: 411/u);
});

test("no React style attribute remains outside email templates", async () => {
  const forms = await readFile(new URL("../app/forms.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(forms, /style=\{\{/u);
});
