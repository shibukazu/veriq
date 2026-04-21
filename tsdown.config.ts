import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "tsdown";

// ccqa has two public surfaces:
//   1. the `ccqa` CLI binary (bin/ccqa.ts) — fully bundled into dist/bin/ccqa.js
//   2. the `ccqa/test-helpers` subpath export — shipped as dist/runtime/test-helpers.js + .d.ts
// plus the vitest config used at runtime by `ccqa run --config <this>`, kept
// as a separate emitted file so it stays loadable by vitest (not bundled in).
export default defineConfig({
  entry: {
    "bin/ccqa": "./bin/ccqa.ts",
    "runtime/test-helpers": "./src/runtime/test-helpers.ts",
    "runtime/vitest.config": "./src/runtime/vitest.config.ts",
  },
  format: "esm",
  platform: "node",
  target: "node20",
  dts: true,
  clean: true,
  outDir: "dist",
  // Everything runtime (peer + real deps) stays external. The CLI binary
  // imports these at runtime from the consumer's node_modules.
  external: [
    "commander",
    "gray-matter",
    "zod",
    "@anthropic-ai/claude-agent-sdk",
    "@anthropic-ai/claude-code",
    "vitest",
    "vitest/config",
    "agent-browser",
  ],
  // Emit a shebang only into the CLI entry so `./dist/bin/ccqa.js` is
  // directly executable. Other entries stay plain ESM modules.
  outputOptions: {
    banner(chunk) {
      return chunk.name === "bin/ccqa" ? "#!/usr/bin/env node" : "";
    },
  },
  hooks: {
    "build:done": () => {
      // Copy a trimmed package.json into dist/ so:
      //   - CLI's own version lookup (readFileSync(new URL("../package.json", import.meta.url)))
      //     resolves correctly from dist/cli/index.js.
      //   - Downstream tooling that peeks at the package via dist/package.json sees real metadata.
      const root = process.cwd();
      const pkg = JSON.parse(
        readFileSync(resolve(root, "package.json"), "utf8"),
      ) as Record<string, unknown>;
      delete pkg.devDependencies;
      delete pkg.scripts;
      delete pkg.packageManager;
      delete pkg.devEngines;
      writeFileSync(
        resolve(root, "dist/package.json"),
        JSON.stringify(pkg, null, 2) + "\n",
        "utf8",
      );
      chmodSync(resolve(root, "dist/bin/ccqa.js"), 0o755);
    },
  },
});
