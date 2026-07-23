# Cloudflare media sync

Cloudflare Images and Stream metadata are the sync source of truth. The
generated frontend manifest is build output and stays untracked.

The 87 production assets were migrated to managed metadata on 2026-07-13.
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
Worker. A missing, version-1, or incomplete manifest fails the build with an
instruction to rerun sync.

`pnpm sync-media:prune` runs only after a successful deployment. It marks stale
managed media, retains it for seven days, then deletes it on a later successful
deployment. Untagged legacy media is never pruned.

Local development requires an existing generated manifest. Run
`pnpm sync-media` after changing files under `src/content/media`.

`pnpm sync-media:audit` reads the full Cloudflare inventory and writes an
ignored report of filename-matched untagged legacy duplicates. It never deletes
or updates those assets. Audit does not print an approval checksum; the cleanup
dry run validates that report against current state and prints its checksum.

## One-time legacy cleanup

Legacy cleanup is deliberately separate from deployment pruning. First refresh
the report, then run the cleanup dry run:

```bash
pnpm sync-media:audit
pnpm sync-media:cleanup-legacy
```

The second command is the cleanup dry run. It prints the exact report SHA-256
required for apply. Review its counts, then pass that checksum explicitly:

```bash
pnpm sync-media:cleanup-legacy -- --apply --report-sha256=<sha256>
```

Apply protects every current manifest ID, requires each candidate to remain
untagged with the audited filename, and re-fetches each asset immediately before
deletion. Progress is written atomically to an ignored, report-specific cleanup
checkpoint, so rerunning the same command resumes safely. This command is never
run by the deployment workflow.

During apply, progress is printed after every 20 candidates with deleted,
missing, skipped, failed, rate, and ETA counts. The first `Ctrl+C` requests a
graceful pause: no new deletions start, in-flight requests finish, the checkpoint
is saved, and a completed/remaining summary is printed. The process exits
successfully, so pnpm does not report an `ELIFECYCLE` failure.

Rerun the exact same apply command and checksum to resume. A deletion interrupted
before its checkpoint is simply rechecked as missing. Do not regenerate the
audit between cancellation and resume because that creates a new report checksum
and checkpoint. Duplicate `SIGINT` events delivered immediately by pnpm are
ignored. Pressing `Ctrl+C` again after two seconds forces an immediate exit and
may still produce the normal exit-code 130 message.
