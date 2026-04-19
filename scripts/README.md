# Internal build & test scripts

How the npm scripts in [package.json](../package.json) fit together. Not customer-facing — devs maintaining the docs site, demo videos, and integration tests.

Most individual scripts have a usage block at the top of the file; this README is the glue.

## npm scripts

| Script | Produces | Depends on / requires |
|---|---|---|
| `build:vendor` | [docs/vendor/](../docs/vendor/) — npm packages copied for self-hosting (replaces CDN refs) | Run after `npm install` or version bumps. CI runs it to keep `docs/vendor/` in sync. |
| `build:screenshots` | [docs/screenshots/*.png](../docs/screenshots/) — API Explorer reference shots | `npx playwright install chromium`. Boots its own temporary HTTP server for `docs/`. |
| `build:terminal:java` | `.target/video/terminal-java.webm` (18s terminal animation, intermediate) | Renders [terminal-java.html](../docs/screenshots/terminal-java.html) headless. No external server. |
| `build:terminal:sigfunnel` | `.target/video/terminal-sigfunnel.webm` (18s, intermediate) | Renders [terminal-sigfunnel.html](../docs/screenshots/terminal-sigfunnel.html). No external server. |
| `build:video:funnel-app` | `.target/video/funnel-app.webm` + `funnel-app.de.webm` (intermediate) | Shells out to the Playwright spec in [src/sign-widget-demo-application/](../src/sign-widget-demo-application/) with `DEMO_VIDEO=1`. That project must have its own deps installed (`npm install` + `npx playwright install`). Hits the real inSign sandbox. |
| `build:video:java-app` | `.target/video/java-app-demo.webm` (intermediate) | **Java app must already be running on `http://localhost:8090`** (`cd src/java/app && mvn spring-boot:run -Pspring-client`). Script aborts if not — it does not start Maven itself. Storyboard-driven via [docs/screenshots/lib/storyboard-runner.mjs](../docs/screenshots/lib/storyboard-runner.mjs). |
| `build:video` | [docs/video/funnel.webm](../docs/video/funnel.webm) + `funnel.de.webm` (final, committed) | Chains `build:terminal:sigfunnel` → `build:video:funnel-app` → two `stitch-video.mjs` calls. |
| `build:video:java` | [docs/video/java-quickstart.webm](../docs/video/java-quickstart.webm) (final, committed) | Chains `build:terminal:java` → `build:video:java-app` → `stitch-video.mjs`. |
| `build:media` | All of the above | `build:screenshots && build:video && build:video:java`. |
| `test:getting-started[:headed]` | exit code | Boots its own static server on `:9877`, hits real sandbox via Playwright. `npx playwright install chromium` once. |
| `test:api-explorer[:headed]` | exit code | Boots its own static server on `:9878`, hits real sandbox. |
| `test:ui[:headed]` | exit code | Runs both test suites sequentially. |

## Video pipeline

```
terminal-*.html ──► take-terminal-video.mjs ──► .target/video/terminal-*.webm ─┐
                                                                                ├─► stitch-video.mjs ──► docs/video/<final>.webm
sample app ──► take-{funnel,java-app}-video.mjs ──► .target/video/*-app.webm ──┘
```

- Intermediate `.webm` files land under [.target/video/](../.target/) and are gitignored.
- Final outputs land in [docs/video/](../docs/video/) and are committed.
- `stitch-video.mjs` joins the terminal pre-roll with the app walkthrough using an ffmpeg `xfade zoomin` transition. The trailing `0.6` in the package.json invocations is the transition length in seconds.
- Requires `ffmpeg` on `$PATH`.

## Scripts not wired into package.json

- [build-og-card.mjs](build-og-card.mjs) — rasterizes the 1200×630 social share card to [docs/img/og-card.png](../docs/img/og-card.png). Run manually when the design/tagline changes.
