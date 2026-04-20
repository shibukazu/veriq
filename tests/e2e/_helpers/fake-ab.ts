import { chmod, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

// Writes a fake `agent-browser` npm package into <projectCwd>/node_modules/
// so that ccqa/test-helpers' `createRequire().resolve("agent-browser/...")`
// locates this stub instead of the real browser driver.
//
// The stub logs its argv (JSON-serialized, one line per invocation) to the
// path in $CCQA_FAKE_AB_LOG and exits with $CCQA_FAKE_AB_EXIT (default 0).
export async function installFakeAgentBrowser(projectCwd: string): Promise<void> {
  const pkgDir = join(projectCwd, "node_modules", "agent-browser");
  const binDir = join(pkgDir, "bin");
  await mkdir(binDir, { recursive: true });

  const pkgJson = {
    name: "agent-browser",
    version: "0.0.0-fake",
    type: "module",
    bin: { "agent-browser": "./bin/agent-browser.js" },
  };
  await writeFile(
    join(pkgDir, "package.json"),
    JSON.stringify(pkgJson, null, 2),
    "utf8",
  );

  const binScript = `#!/usr/bin/env node
import { appendFileSync } from "node:fs";
const logPath = process.env.CCQA_FAKE_AB_LOG;
if (logPath) {
  try {
    appendFileSync(logPath, JSON.stringify(process.argv.slice(2)) + "\\n");
  } catch {}
}
const exitStr = process.env.CCQA_FAKE_AB_EXIT ?? "0";
const stdoutLine = process.env.CCQA_FAKE_AB_STDOUT;
if (stdoutLine) process.stdout.write(stdoutLine + "\\n");
process.exit(Number(exitStr));
`;
  const binPath = join(binDir, "agent-browser.js");
  await writeFile(binPath, binScript, "utf8");
  await chmod(binPath, 0o755);
}
