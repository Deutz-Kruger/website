# Cloudflare media sync

Cloudflare Images and Stream metadata are the sync source of truth. The
generated frontend manifest is build output and stays untracked.

The production assets were migrated to managed metadata on 2026-07-13.
Normal sync refuses an empty managed inventory to prevent an accidental full
upload. `--allow-empty-inventory` exists only for a deliberate fresh start.

Run `pnpm sync-media -- --help` for the complete command and flag reference.

## Normal lifecycle

`pnpm sync-media` runs before the site build. It reuses exact
`sourcePath + sha256` matches, uploads missing media, waits for Stream encoding,
and atomically writes the frontend manifest. It never deletes media.

Before contacting Cloudflare, sync generates a 32px inline WebP LQIP for every
local asset. Sharp handles images and the exact-pinned `ffmpeg-static` binary
extracts each video's first frame. Video extraction is limited to two
concurrent processes and has a 30-second per-file timeout. LQIPs are regenerated
deterministically on every sync; there is no cache, sidecar output, or remote
thumbnail request.

Placeholder generation is fail-closed. If any source is invalid, FFmpeg is
unavailable, or the generated data does not pass the manifest schema, sync stops
before listing or mutating Cloudflare assets. The previous generated manifest
is left byte-for-byte unchanged. Fix the reported source or reinstall
dependencies, then rerun `pnpm sync-media`; there is no skip flag.

The generated manifest is a versioned, validated artifact. Astro only consumes
it during static generation and performs no media processing in the deployed
Worker. A missing manifest fails the build as an unresolved import; an outdated
or incomplete one fails with an instruction to rerun sync.

## Pruning

`pnpm sync-media:prune` runs only after a successful deployment. It marks stale
managed media, retains it for seven days, then deletes it on a later successful
deployment. Untagged media is never pruned.

Local development requires an existing generated manifest. Run
`pnpm sync-media` after changing files under `src/content/media`.

## Module layout

| Module          | Responsibility                                           |
| --------------- | -------------------------------------------------------- |
| `cli.ts`        | Command list, help text, flag parsing, exit codes        |
| `sync.ts`       | Reuse/upload reconciliation, metadata helpers, staleness |
| `prune.ts`      | Stale marking, retention window, deletion                |
| `manifest.ts`   | Atomic manifest read/write and schema validation         |
| `cloudflare.ts` | Images/Stream client with per-asset-type adapters        |
| `file-utils.ts` | Local media scanning, hashing, LQIP attachment           |
| `lqip.ts`       | Sharp placeholders and the pinned FFmpeg frame extractor |
| `schema.ts`     | Zod schemas and constants shared with the frontend       |
| `config.ts`     | Default roots, concurrency limits, `mapConcurrent`       |
| `reporting.ts`  | Sync logger interface and console default                |
