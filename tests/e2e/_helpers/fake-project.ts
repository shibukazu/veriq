import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const FIXTURES_ROOT = resolve(__dirname, "..", "fixtures");
const REPO_ROOT = resolve(__dirname, "..", "..", "..");

export type FakeProject = {
  cwd: string;
  cleanup: () => Promise<void>;
};

// Packages we symlink from the repo's node_modules into the fixture so vitest
// can resolve its own runtime (and transitive deps) when executing specs
// inside the fixture cwd. We rely on bun's flat node_modules layout here.
const SHARED_DEPS = [
  "vitest",
  "vite",
  "vite-node",
  "@vitest",
  "@vite",
  "@rollup",
  "@esbuild",
  "@esbuild-kit",
  "esbuild",
  "rollup",
  "rolldown",
  "tinyexec",
  "tinypool",
  "tinyrainbow",
  "tinybench",
  "tinyspy",
  "tinyglobby",
  "magic-string",
  "chai",
  "expect-type",
  "pathe",
  "picomatch",
  "std-env",
  "why-is-node-running",
  "loupe",
  "@types",
  "strip-literal",
  "cac",
  "birpc",
];

// Copies a fixture directory into a fresh temp dir so each test runs in
// isolation. When `linkCcqa` is true we also symlink:
//   - node_modules/ccqa → repo root (so fixture specs can import ccqa/test-helpers)
//   - node_modules/<shared dep> → repo's installed copy (so vitest runs)
export async function makeFakeProject(
  fixtureName: string,
  opts: { linkCcqa?: boolean } = {},
): Promise<FakeProject> {
  const src = join(FIXTURES_ROOT, fixtureName);
  const cwd = await mkdtemp(join(tmpdir(), `ccqa-e2e-${fixtureName}-`));
  await cp(src, cwd, { recursive: true });

  if (opts.linkCcqa) {
    const nm = join(cwd, "node_modules");
    const binDir = join(nm, ".bin");
    await mkdir(binDir, { recursive: true });
    // Symlink vitest + transitive deps from the repo's node_modules so vitest
    // can run inside the fixture's cwd without a full install.
    for (const dep of SHARED_DEPS) {
      await symlink(
        join(REPO_ROOT, "node_modules", dep),
        join(nm, dep),
        "dir",
      ).catch(() => {});
    }
    // Materialize ccqa as a real (non-symlink) package inside the fixture
    // so Node's module resolution looks up peer deps (agent-browser) from
    // the fixture's node_modules rather than the repo's node_modules. A
    // symlink would be resolved to the repo and peer lookup would walk up
    // from there, bypassing any fakes we install under <fixture>/node_modules.
    await materializeCcqaPackage(join(nm, "ccqa"));
    // .bin/vitest so `bunx vitest` / `npx vitest` resolves without hitting
    // the network. Without this, bunx will silently download vitest again.
    await symlink(
      join(REPO_ROOT, "node_modules", ".bin", "vitest"),
      join(binDir, "vitest"),
      "file",
    ).catch(() => {});
  }

  return {
    cwd,
    cleanup: async () => {
      await rm(cwd, { recursive: true, force: true });
    },
  };
}

export function fixturePath(fixtureName: string): string {
  return join(FIXTURES_ROOT, fixtureName);
}

// Copies the ccqa package contents that consumers actually import into a
// fresh directory under the fixture's node_modules. We copy the runtime
// source (needed for `ccqa/test-helpers`) plus package.json (so `exports`
// is honored), but nothing else — specifically NOT `node_modules`. This
// matches the layout after a real `pnpm add ccqa` install and makes Node's
// createRequire resolve peer packages from the fixture, not the repo.
async function materializeCcqaPackage(destDir: string): Promise<void> {
  await mkdir(destDir, { recursive: true });
  const pkgJson = JSON.parse(
    await readFile(join(REPO_ROOT, "package.json"), "utf8"),
  ) as Record<string, unknown>;
  // Strip dev-only fields and redirect to the copied src/
  delete pkgJson.devDependencies;
  delete pkgJson.scripts;
  await writeFile(
    join(destDir, "package.json"),
    JSON.stringify(pkgJson, null, 2),
    "utf8",
  );
  await cp(join(REPO_ROOT, "src"), join(destDir, "src"), { recursive: true });
  await cp(join(REPO_ROOT, "bin"), join(destDir, "bin"), { recursive: true });
}
