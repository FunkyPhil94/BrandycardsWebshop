import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Build output. The npm script also passes --ignore-pattern, but that only
    // matches at the root, so a nested copy would still be linted.
    "dist/**",
    "**/dist/**",
    ".wrangler/**",
    // Claude Code keeps its git worktrees here. Without this, running lint from
    // the main checkout walks into a worktree and reports errors from its
    // minified build output — results would depend on whether a worktree
    // happens to exist.
    ".claude/**",
  ]),
]);

export default eslintConfig;
