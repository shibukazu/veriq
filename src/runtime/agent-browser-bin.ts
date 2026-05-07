import { createRequire } from "node:module";
import { delimiter, dirname, join } from "node:path";

const require = createRequire(import.meta.url);

/**
 * Resolves the directory containing the `agent-browser` shim that npm/pnpm
 * exposes on PATH for the peer-installed package. Used by `ccqa trace` to
 * prepend this directory to PATH so the Claude subprocess can invoke
 * `agent-browser ...` without requiring a global install.
 *
 * Returns null if agent-browser cannot be resolved (peer not installed).
 */
export function resolveAgentBrowserBinDir(): string | null {
  let pkgJsonPath: string;
  try {
    pkgJsonPath = require.resolve("agent-browser/package.json");
  } catch {
    return null;
  }
  const pkgDir = dirname(pkgJsonPath);
  // pnpm puts the shim under <pkg>/node_modules/.bin/agent-browser; npm/yarn
  // flat layouts put it at the parent .bin (sibling of the package dir).
  return join(pkgDir, "node_modules", ".bin");
}

/**
 * Returns a PATH string with the agent-browser shim directory prepended,
 * so `agent-browser ...` resolves without a global install. Falls back to
 * the original PATH when the package can't be resolved.
 */
export function pathWithAgentBrowserShim(currentPath: string | undefined): string {
  const path = currentPath ?? "";
  const dir = resolveAgentBrowserBinDir();
  if (!dir) return path;
  if (path.split(delimiter).includes(dir)) return path;
  return dir + delimiter + path;
}
