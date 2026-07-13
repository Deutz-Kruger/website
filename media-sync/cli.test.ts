import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { createInterruptHandler } from "./interrupt";

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
    [cliPath, "cleanup-legacy", "--help"],
    { cwd: directory, env },
  );

  assert.equal(stderr, "");
  assert.match(stdout, /pnpm sync-media:cleanup-legacy/);
  assert.match(stdout, /Then run cleanup-legacy for the SHA/);
  assert.match(stdout, /safely resumes after Ctrl\+C/);
  assert.match(stdout, /graceful pause exits successfully/);
  assert.match(stdout, /--allow-empty-inventory/);
  assert.match(stdout, /--report-sha256=<value>/);
  assert.match(stdout, /Show this help without requiring credentials/);
});

test("interrupt handler ignores immediate duplicate SIGINT delivery", () => {
  let currentTime = 1000;
  let forcedExits = 0;
  let pauses = 0;
  const errors: string[] = [];
  const messages: string[] = [];
  const handleInterrupt = createInterruptHandler({
    forceExit: () => {
      forcedExits += 1;
    },
    now: () => currentTime,
    pause: () => {
      pauses += 1;
    },
    writeError: (message) => errors.push(message),
    writeInfo: (message) => messages.push(message),
  });

  handleInterrupt();
  currentTime += 100;
  handleInterrupt();

  assert.equal(pauses, 1);
  assert.equal(forcedExits, 0);
  assert.equal(messages.length, 1);
  assert.equal(errors.length, 0);

  currentTime += 2000;
  handleInterrupt();
  assert.equal(forcedExits, 1);
  assert.equal(errors.length, 1);
});
