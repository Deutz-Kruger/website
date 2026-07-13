# Deutz & Krüger Portfolio

The production portfolio at [deutzkrueger.de](https://deutzkrueger.de), built
with Astro and deployed as a Cloudflare Worker with static assets. Images are
stored in Cloudflare Images and videos in Cloudflare Stream.

## Requirements

- Node.js 20 or newer
- pnpm 10 or newer
- Cloudflare media credentials for the initial media sync and media changes

## Local development

Install dependencies:

```bash
pnpm install
```

The generated media manifest is intentionally ignored. On a fresh checkout, or
after changing files in `src/content/media`, configure the following local
environment variables and reconcile media before starting Astro:

```dotenv
CLOUDFLARE_ACCOUNT_ID=<account-id>
CLOUDFLARE_MEDIA_API_TOKEN=<images-and-stream-token>
```

An ignored `.env` file can be used locally. The media token should have only
Cloudflare Images Read/Write and Stream Read/Write permissions.

```bash
pnpm sync-media
pnpm dev
```

The development server is available at `http://localhost:4321`. A missing
manifest produces an actionable error asking you to run `pnpm sync-media`.

## Commands

| Command                          | Purpose                                                                       |
| -------------------------------- | ----------------------------------------------------------------------------- |
| `pnpm dev`                       | Start the Astro development server.                                           |
| `pnpm build`                     | Create the production Worker and static assets in `dist`.                     |
| `pnpm preview`                   | Build and run the result locally with Wrangler.                               |
| `pnpm check`                     | Run ESLint, Prettier verification, and Astro type checking.                   |
| `pnpm test:media`                | Run the media reconciliation test suite.                                      |
| `pnpm sync-media`                | Reconcile local media and write the generated manifest. Never deletes assets. |
| `pnpm sync-media:prune`          | Mark or delete stale managed media after a successful deployment.             |
| `pnpm sync-media:audit`          | Report possible untagged legacy duplicates without mutation.                  |
| `pnpm sync-media:cleanup-legacy` | Validate or apply an approved legacy cleanup report. Dry-run by default.      |

Run `pnpm sync-media -- --help` for all media commands, safety behavior, and
flags. Implementation and recovery details are in
[media-sync/README.md](media-sync/README.md).

## Media lifecycle

Supported source formats are PNG, JPG/JPEG, SVG, MP4, and WebM. Dotfiles are
ignored; unsupported visible files fail the sync.

```text
src/content/media
  → SHA-256 scan and metadata extraction
  → Cloudflare Images / Stream reconciliation
  → src/generated/media-manifest.json
  → Astro build
```

Cloudflare metadata is the remote source of truth. Assets are tagged with their
normalized source path and SHA-256 hash. Exact matches are reused, so an
unchanged sync performs zero uploads. Images use deterministic content-addressed
IDs; videos are reused after interrupted uploads and must finish encoding before
the manifest is written.

The manifest contains only the remote ID, media type, width, and height. It is
written atomically after every local asset has a usable remote ID and remains
unchanged if reconciliation fails.

Normal sync never deletes media. Production pruning is a separate post-deploy
operation: unused managed assets are first marked stale and are deleted only
after seven days. Reusing an asset clears its stale marker. Untagged assets are
outside normal pruning.

## Deployment workflow

The GitHub Actions workflow uses the `CLOUDFLARE` environment with:

- `vars.CLOUDFLARE_ACCOUNT_ID`
- `secrets.CLOUDFLARE_MEDIA_API_TOKEN` for Images and Stream
- `secrets.CLOUDFLARE_API_TOKEN` for Worker uploads and deployment

Keep the media and Worker tokens separate and limited to their required
permissions.

### Preview a branch

Manual runs of `.github/workflows/build.yml` are preview-only. They sync media,
build with `APP_ENV=preview`, upload an isolated Cloudflare Worker version, add
the preview URL to the run summary, and smoke-test it. They cannot move
production traffic and never run media pruning.

The preview shares the production Cloudflare Images and Stream inventory. It may
upload new content-addressed assets from the branch, but it cannot delete or
replace assets referenced by the production manifest.

Before pushing a branch, run:

```bash
pnpm test:media
pnpm check
```

Push the branch, then select it under **Actions → Build, Preview & Deploy → Run
workflow**. Until the workflow update reaches `main`, GitHub may display its old
name, **Build & Deploy**. The equivalent GitHub CLI flow is:

```bash
gh workflow run build.yml --ref "$(git branch --show-current)"
gh run list --workflow build.yml --branch "$(git branch --show-current)" --event workflow_dispatch --limit 1
gh run watch <run-id> --exit-status
```

Open the preview URL from the run summary and verify:

- the homepage and representative case-study pages;
- at least one Cloudflare Image and one Stream video;
- `/robots.txt` disallows indexing;
- the production site remains available and unchanged.

Run the preview workflow a second time without changing files. Its media sync
should report zero uploads.

### Deploy production

Only a push to `main` can run the production path:

```text
media sync → production build → Wrangler deploy → managed-media prune
```

Pruning runs only after deployment succeeds. A failed sync, build, or deploy
leaves the currently served Worker and its referenced media untouched. After
preview validation, merge the pull request and monitor the resulting `main`
workflow through the deploy and prune steps.

Cloudflare documents the underlying non-production mechanism under
[Preview URLs](https://developers.cloudflare.com/workers/versions-and-deployments/preview-urls/)
and GitHub documents branch selection under
[Manually running a workflow](https://docs.github.com/actions/managing-workflow-runs/manually-running-a-workflow).

## Legacy media cleanup

Legacy cleanup is intentionally excluded from deployment automation. Its normal
sequence is:

```bash
pnpm sync-media:audit
pnpm sync-media:cleanup-legacy
pnpm sync-media:cleanup-legacy -- --apply --report-sha256=<sha256>
```

The audit does not print the approval checksum. The cleanup dry run revalidates
the report against Cloudflare and prints the SHA-256 required by apply. During
apply, progress is checkpointed and `Ctrl+C` requests a graceful, resumable
pause. Read [media-sync/README.md](media-sync/README.md) before running deletion.

## Project structure

```text
.github/workflows/build.yml       Preview and production deployment workflow
media-sync/                       Cloudflare reconciliation CLI and tests
src/content/media/                Source images and videos
src/generated/media-manifest.json Generated, ignored frontend manifest
src/utils/media.ts                Runtime media lookup and URL helpers
astro.config.mjs                  Astro and Cloudflare adapter configuration
wrangler.jsonc                    Cloudflare Worker and asset configuration
```

The primary stack is Astro, TypeScript, React, Tailwind CSS, GSAP, Cloudflare
Workers, Cloudflare Images, and Cloudflare Stream.
