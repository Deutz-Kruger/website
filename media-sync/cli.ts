import "dotenv/config";

import { CloudflareMediaClient, getCloudflareConfig } from "./cloudflare";
import { createInterruptHandler } from "./interrupt";
import {
  auditLegacyMedia,
  cleanupLegacyMedia,
  pruneMedia,
  syncMedia,
} from "./sync";

const HELP_TEXT = `Cloudflare Images and Stream reconciliation

Usage:
  pnpm sync-media [-- --dry-run] [-- --allow-empty-inventory]
  pnpm sync-media:prune [-- --dry-run]
  pnpm sync-media:audit
  pnpm sync-media:cleanup-legacy [-- --dry-run]
  pnpm sync-media:cleanup-legacy -- --apply --report-sha256=<sha256>

Commands:
  sync             Reconcile local media and atomically write the manifest.
                   Never deletes remote assets.
  prune            Mark stale managed assets, then delete after seven days.
                   Intended only after a successful deployment.
  audit            Write an ignored report of possible untagged duplicates.
                   Never mutates assets. Then run cleanup-legacy for the SHA.
  cleanup-legacy   Validate the audit report and classify deletion candidates.
                   Dry-run by default and prints the SHA required by --apply.
                   Apply checkpoints progress and safely resumes after Ctrl+C.
                   A graceful pause exits successfully with a final summary.
                   Never part of deployment automation.

Options:
  --dry-run                Report intended work without remote mutations or
                           generated output changes.
  --allow-empty-inventory  Allow sync when no managed assets exist remotely.
                           Use only for a deliberate fresh start.
  --apply                  Enable legacy deletion after all safety checks.
  --report-sha256=<value>  Exact checksum printed by cleanup-legacy dry-run.
                           Required with --apply.
  -h, --help               Show this help without requiring credentials.

Environment:
  CLOUDFLARE_ACCOUNT_ID
  CLOUDFLARE_MEDIA_API_TOKEN`;

const getOption = (args: string[], name: string): string | undefined => {
  const inline = args.find((argument) => argument.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

const run = async () => {
  const rawCommand = process.argv[2];
  const command = rawCommand ?? "sync";
  const args = process.argv.slice(3);
  const flags = new Set(args);
  if (
    rawCommand === "help" ||
    rawCommand === "--help" ||
    rawCommand === "-h" ||
    flags.has("--help") ||
    flags.has("-h")
  ) {
    console.log(HELP_TEXT);
    return;
  }

  const client = new CloudflareMediaClient(getCloudflareConfig());

  switch (command) {
    case "sync":
      await syncMedia({
        client,
        dryRun: flags.has("--dry-run"),
        requireExistingInventory: !flags.has("--allow-empty-inventory"),
      });
      return;
    case "prune":
      await pruneMedia({ client, dryRun: flags.has("--dry-run") });
      return;
    case "audit":
      await auditLegacyMedia({ client });
      return;
    case "cleanup-legacy": {
      const apply = flags.has("--apply");
      if (apply && flags.has("--dry-run")) {
        throw new Error('Use either "--apply" or "--dry-run", not both.');
      }
      const controller = new AbortController();
      const handleInterrupt = createInterruptHandler({
        forceExit: () => process.exit(130),
        pause: () => controller.abort(),
        writeError: console.error,
        writeInfo: console.log,
      });
      if (apply) process.on("SIGINT", handleInterrupt);
      try {
        await cleanupLegacyMedia({
          apply,
          client,
          expectedReportSha256: getOption(args, "--report-sha256"),
          signal: controller.signal,
        });
      } finally {
        if (apply) process.off("SIGINT", handleInterrupt);
      }
      return;
    }
    default:
      throw new Error(`Unknown media-sync command: ${command}`);
  }
};

try {
  await run();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
