import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const cliPath = resolve("./media-sync/cli.ts");
const tsxPath = resolve("./node_modules/.bin/tsx");

test("CLI help documents all commands without requiring credentials", async (t) => {
  const directory = await mkdtemp(resolve(tmpdir(), "media-cli-help-"));
  t.after(() => rm(directory, { force: true, recursive: true }));
  const env = { ...process.env };
  delete env.CLOUDFLARE_ACCOUNT_ID;
  delete env.CLOUDFLARE_MEDIA_API_TOKEN;

  const { stderr, stdout } = await execFileAsync(
    tsxPath,
    [cliPath, "prune", "--help"],
    { cwd: directory, env },
  );

  assert.equal(stderr, "");
  assert.match(stdout, /pnpm sync-media \[-- --dry-run\]/);
  assert.match(stdout, /pnpm sync-media:prune \[-- --dry-run\]/);
  assert.match(stdout, /Reconcile local media and atomically write/);
  assert.match(stdout, /Intended only after a successful deployment/);
  assert.match(stdout, /--allow-empty-inventory/);
  assert.match(stdout, /--dry-run/);
  assert.match(stdout, /Show this help without requiring credentials/);
  assert.doesNotMatch(stdout, /cleanup-legacy|report-sha256/);
  assert.doesNotMatch(stdout, /\n {2}audit\b/);
});
