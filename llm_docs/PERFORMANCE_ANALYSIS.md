# Non-visual Performance Optimization Report

Date: 2026-07-14

## Guardrail

This pass preserves the rendered design and observable interactions: Arial
typography, Swup's 350 ms transition, Lenis settings, GSAP logo animation,
header/services behavior, media quality, and visible video playback rules.

## Production-build results

| Budget area                        |                                Before |                       After | Result          |
| ---------------------------------- | ------------------------------------: | --------------------------: | --------------- |
| Sitewide JavaScript                |                         ~65.8 KB gzip |              46.74 KiB gzip | Pass (≤50 KiB)  |
| HLS player                         |                        161.74 KB gzip |             104.80 KiB gzip | Pass (≤115 KiB) |
| CSS                                |                         ~5.98 KB gzip |               5.84 KiB gzip | Pass (≤7 KiB)   |
| Arial font transfer                |                        845,528 B WOFF |             650,320 B WOFF2 | 23.09% smaller  |
| Client chunks                      | Empty/redundant entries plus full HLS |            2, neither empty | Pass            |
| Maximum eager images per route     |         Logo plus up to 6 deep images | Logo only in current routes | Pass (≤2)       |
| Unreferenced React client artifact |                         60.99 KB gzip |                     Removed | Pass            |

`pnpm build` now runs `scripts/performance-budget.mjs` after Astro's production
build and fails if any budget regresses.

## Implemented changes

### Fonts

- Added full-glyph WOFF2 versions of the existing regular and italic Arial
  files. WOFF remains as the fallback.
- WOFF2 is now preferred by `@font-face` and preloaded by the layout.
- FontTools verification confirmed equivalence for `cmap`, `glyf`, `hmtx`,
  `kern`, `GPOS`, `GSUB`, `head`, `hhea`, and `OS/2`, plus glyph order.
- No glyph subsetting, family, weight, metric, fallback, or `font-display`
  change was made.

### Application and navigation scripts

- Replaced the Layout's eight script tags with one `app.ts` entry and an
  explicit initialization/cleanup order.
- Removed the empty NavBar script and all empty client chunks.
- Removed unused ScrollTrigger while preserving GSAP core, the GSAP ticker,
  Lenis options, timing conversion, and `lagSmoothing(0)`.
- Removed Swup ScriptsPlugin. Custom video-element registration is part of the
  persistent application graph instead of page-specific executable markup.
- Kept Swup HeadPlugin and PreloadPlugin. `preloadInitialPage: false` removes
  the redundant initial-document request while hover/focus/touch preload stays
  enabled.

### HLS and media lifecycle

- Added one shared HLS attach/destroy helper for both custom video elements.
- Desktop browsers, including Safari and Chromium on macOS, use
  `hls.js/light`. This restores the original HLS.js-first desktop Safari
  behavior and avoids Chromium's native 426×240 startup rendition. Native HLS
  is retained for iOS and as a fallback when HLS.js is unsupported.
- Removed low-latency VOD mode and aligned buffer lengths with four-second
  segments without adding rendition or player-size quality caps.
- Players attach around 300 px before the viewport. Distant hosts keep their
  poster but request no manifest or segment.
- Case videos play/loop while any part is visible, pause when fully outside the
  viewport, and resume on re-entry.
- Case-video wrappers fill their grid section independently of the active HLS
  rendition, so adaptive-quality changes cannot resize the layout.
- Preview videos retain desktop hover behavior and mobile full-visibility,
  one-shot behavior. Desktop re-hover still enables looping as before.
- Preview videos use a manifest-sized outer frame, with the replaced `<video>`
  positioned outside layout flow. Poster, metadata, rendition, and playback
  changes therefore cannot resize the case-preview container.
- Disconnect now aborts pending initialization, destroys HLS, clears native
  sources/listeners, removes resize/hover handlers, and disconnects observers.
  Rejected `play()` promises are handled.

### Images and connections

- Image priority is based on one page-global media index rather than restarting
  inside every group. Current case routes now have only the logo eager because
  their first content media is a viewport-managed video.
- Added a global Image Delivery preconnect and a Stream preconnect only on
  landing and case routes.
- Existing Cloudflare variants, AVIF/WebP negotiation, dimensions, image
  quality, CSS sizing, and caching behavior are unchanged.

### Lifecycle and dependency cleanup

- Fixed mismatched logo resize callback registration/removal.
- Removed all service-card handlers during cleanup.
- Killed stale logo tweens before the existing reset tween.
- Removed dead React, Glide, Swup Debug/Scripts, `astro-useragent`, `@thi.ng`,
  R3F, and shader-tooling dependencies after a repository-wide import search.

## Runtime verification

- Desktop landing initial load attached only the first near-viewport preview;
  the other three had no media source. The prepared player selected 1920×1080
  rather than the native 426×240 startup rendition.
- Mobile landing initial load attached only the two previews within the 300 px
  margin. At the case-card position, the two fully visible previews played
  one-shot, the near offscreen preview prepared without playing, and the distant
  preview still had no source.
- A forced native-HLS poster-to-playback test kept preview dimensions unchanged:
  489.59×282.39 px on desktop and 370×215.125 px on mobile.
- Desktop BL Thermodynamics initial load played the three visible/partially
  visible players at 1920×1080; the distant fourth player had no source. Their
  600 px grid boxes remained stable before and after playback initialization.
  Scrolling paused fully offscreen players and started the newly visible fourth
  player.
- Mobile BL Thermodynamics showed the same visible/pause behavior.
- Ten complete landing ↔ case Swup round trips retained exactly four preview or
  four case hosts as appropriate and produced no console warnings/errors.
- Language switching, browser back/forward, titles, and page content replacement
  remained correct.
- The initial preview log contained one initial landing-document GET; the old
  PreloadPlugin duplicate was absent.

## Visual parity note

Desktop and mobile before/after screenshots were captured for landing, case
media, services, logo overlap, and header states. Static layout and typography
match; time-varying video regions were excluded from pixel comparisons.
The evidence is stored under
`/Users/megravity/.codex/visualizations/2026/07/13/019f5d3f-cb28-7ca0-99ae-e34f227e7be9/perf-pass/`.

The initial screenshot pass did not expose a delayed native-HLS regression on
desktop Chromium: Cloudflare's 240p startup rendition could shrink a `w-fit`
case-video wrapper after capture. The issue was subsequently reproduced and
corrected at both the player-selection and layout levels as described above.

An accurate fixed `sizes` hint for the logo was tested but reverted. It changed
Chrome's selected Cloudflare rendition (`small` to `thumbnail`) and caused a
measurable raster difference. The no-visual-change acceptance rule takes
precedence, so the current logo source selection is intentionally retained.

## Remaining measurement

Core Web Vitals were not recorded because a Chrome performance-trace provider
was unavailable in this environment. Run three median mobile and desktop
Lighthouse traces against the deployed build and record LCP, CLS, TBT, Speed
Index, transfer size, and request count. Targets remain LCP ≤2.5 s, INP ≤200 ms,
and CLS ≤0.1 at p75.
