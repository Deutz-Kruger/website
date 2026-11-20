# Deutz & Krüger Portfolio

The production portfolio at [deutzkrueger.de](https://deutzkrueger.de), built
with Astro and deployed as a Cloudflare Worker with static assets. Images are
stored in Cloudflare Images and videos in Cloudflare Stream.

## Requirements

- Node.js 22.23.4 or newer (`mise.toml` pins the local development version)
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
manifest fails the build as an unresolved import; an outdated one asks you to
run `pnpm sync-media`.

## Commands

| Command           | Purpose                                                     |
| ----------------- | ----------------------------------------------------------- |
| `pnpm dev`        | Start the Astro development server.                         |
| `pnpm build`      | Production build, including budget and verification checks. |
| `pnpm preview`    | Build and serve the result locally with `astro preview`.    |
| `pnpm check`      | Run ESLint, Prettier verification, and Astro type checking. |
| `pnpm test`       | Run the unit and media test suites.                         |
| `pnpm sync-media` | Reconcile local media and write the generated manifest.     |

The full command list lives in [AGENTS.md](AGENTS.md) and is discoverable
with `pnpm run`. Media internals and recovery details are in
[media-sync/README.md](media-sync/README.md).

## Media lifecycle

Sources live in `src/content/media` (PNG, JPG/JPEG, SVG, MP4, WebM).
`pnpm sync-media` reconciles them against tagged Cloudflare Images and Stream
inventory and atomically writes the generated, ignored
`src/generated/media-manifest.json`. Normal sync never deletes media.
Deployment pruning is documented in [media-sync/README.md](media-sync/README.md).

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
