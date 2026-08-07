import vinext from "vinext";
import { defineConfig } from "vite";
import { sites } from "./build/sites-vite-plugin";

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

// `compatibility_flags` is deliberately absent: wrangler.toml already declares
// `nodejs_compat`, and the Cloudflare plugin merges the two configs by
// concatenation. Declaring it here as well produced
// `["nodejs_compat", "nodejs_compat"]`, which the Workers runtime rejects with
// "Compatibility flag specified multiple times" — `npm run dev` would not start
// at all. wrangler.toml stays the single source of truth for the deployed
// Worker, as the README says.
const localBindingConfig = {
  main: "./worker/index.ts",
};

export default defineConfig(async () => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";
  // Local development does not need Cloudflare's live Request.cf sample.
  // Disabling the fetch keeps Windows/offline development deterministic.
  process.env.CLOUDFLARE_CF_FETCH_ENABLED ??= "false";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    server: isCodexSeatbeltSandbox
      ? { watch: { useFsEvents: false, usePolling: true } }
      : undefined,
    plugins: [
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        config: localBindingConfig,
      }),
    ],
  };
});
