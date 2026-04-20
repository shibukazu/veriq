import { defineConfig } from "vitest/config";

// Project-root vitest config for E2E tests only.
// NOTE: this is NOT the bundled runtime config (that one lives in
// src/runtime/vitest.config.ts and is passed to user-facing `ccqa run`
// via --config). This file is the config used when *we* run our own
// E2E suite via `bunx vitest run tests/e2e`.
export default defineConfig({
  test: {
    include: ["tests/e2e/**/*.test.ts"],
    environment: "node",
    testTimeout: 60_000,
    hookTimeout: 60_000,
    pool: "forks",
  },
});
