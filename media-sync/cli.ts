import "dotenv/config";

import { CloudflareMediaClient, getCloudflareConfig } from "./cloudflare";
import { pruneMedia } from "./prune";
import { syncMedia } from "./sync";

interface CommandSpec {
  name: string;
  usage: string;
  description: string[];
}

interface OptionSpec {
  flags: string;
  description: string[];
}

/** Single source of truth for the command list rendered into HELP_TEXT. */
const COMMANDS: CommandSpec[] = [
  {
    name: "sync",
    usage: "pnpm sync-media [-- --dry-run] [-- --allow-empty-inventory]",
    description: [
      "Reconcile local media and atomically write the manifest.",
      "Never deletes remote assets.",
    ],
  },
  {
    name: "prune",
    usage: "pnpm sync-media:prune [-- --dry-run]",
    description: [
      "Mark stale managed assets, then delete after seven days.",
      "Intended only after a successful deployment.",
    ],
  },
];

const OPTIONS: OptionSpec[] = [
  {
    flags: "--dry-run",
    description: [
      "Report intended work without remote mutations or",
      "generated output changes.",
    ],
  },
  {
    flags: "--allow-empty-inventory",
    description: [
      "Allow sync when no managed assets exist remotely.",
      "Use only for a deliberate fresh start.",
    ],
  },
  {
    flags: "-h, --help",
    description: ["Show this help without requiring credentials."],
  },
];

const COMMAND_LABEL_WIDTH = 14;

const renderSection = (
  title: string,
  rows: Array<[string, string[]]>,
  minLabelWidth = 0,
) => {
  const labelWidth = Math.max(
    minLabelWidth,
    ...rows.map(([label]) => label.length),
  );
  const continuationIndent = " ".repeat(labelWidth + 4);
  const lines = rows.flatMap(([label, description]) => [
    `  ${label.padEnd(labelWidth)}  ${description[0]}`,
    ...description.slice(1).map((line) => `${continuationIndent}${line}`),
  ]);
  return `${title}:\n${lines.join("\n")}`;
};

const renderHelp = (): string => {
  const usages = COMMANDS.map((command) => `  ${command.usage}`).join("\n");
  return [
    "Cloudflare Images and Stream reconciliation",
    "",
    "Usage:",
    usages,
    "",
    renderSection(
      "Commands",
      COMMANDS.map((command) => [command.name, command.description]),
      COMMAND_LABEL_WIDTH,
    ),
    "",
    renderSection(
      "Options",
      OPTIONS.map((option) => [option.flags, option.description]),
    ),
    "",
    "Environment:",
    "  CLOUDFLARE_ACCOUNT_ID",
    "  CLOUDFLARE_MEDIA_API_TOKEN",
  ].join("\n");
};

const HELP_TEXT = renderHelp();

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
