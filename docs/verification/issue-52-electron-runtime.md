# Electron runtime security — issue 52

## Finding and selected runtime

The original lockfile resolves Electron 44.9.0. A fresh `pnpm audit --json`
reports one high vulnerability, GHSA-jr5w-w6x2-84p9 / CVE-2026-115570, including
the development dependency path `.>electron`.

- [Electron's advisory](https://github.com/electron/electron/security/advisories/GHSA-jr5w-w6x2-84p9)
  requires an Electron update and identifies 44.9.1 as the first patched 44.x.
- [The reviewed advisory](https://github.com/advisories/GHSA-jr5w-w6x2-84p9)
  confirms the affected range is `>=44.0.0-alpha.1 <44.9.1`.
- On November 1, 2026, `pnpm view electron@44 version` returns **44.10.1**.
  The [upstream release](https://github.com/electron/electron/releases/tag/v44.10.1)
  and [registry metadata](https://registry.npmjs.org/electron/44.10.1) identify
  that version. Electron supports the latest minor of each supported major;
  [44.x remains supported](https://releases.electronjs.org/schedule).

`package.json` pins **44.10.1** exactly, and the lockfile records its registry
integrity. No other dependency versions changed.

## Repeatable source verification

Use a separate checkout with its own dependencies and build output:

```sh
pnpm install --frozen-lockfile
pnpm rebuild electron node-pty esbuild
pnpm typecheck
pnpm test
pnpm build
pnpm audit:dependencies
pnpm test:electron-runtime
pnpm test:browser
pnpm test:project-platform
pnpm test:smoke
```

The smoke suite needs Google Chrome and exclusive port 4173. The browser suite
uses a fixture Codex executable, local HTTP pages, and a disposable launcher that
keeps application windows hidden. None of these commands
requires paid provider execution. The focused runtime suite uses a hidden
window, temporary profile, local HTTP server on an ephemeral port, and a short
native PTY command; it removes its temporary resources on exit. Other full
application suites normally create visible windows.

`test:electron-runtime` checks the actual executable's `process.versions.electron`
against the installed package and exact manifest pin, checks the advisory's
patched 44.x floor, loads a sandboxed Chromium page with no Node access, performs
a Chromium network fetch, and spawns a real node-pty terminal inside Electron.
This directly detects a stale executable or unusable native module.

`test:browser` obtains the main BrowserWindow from the actual application page,
waits for its owned WebContentsView, and retains that view's identity for security,
capture, and visibility checks. It waits for the exact fixture URL and completed
load, then checks fixture title/content and directly evaluates
`typeof window.theseus` / `typeof require`. An unrelated hidden renderer loads the
same fixture URL to guard against selecting contents by enumeration order.
Restart reacquires the owner/view; clearing data must destroy the old WebContents
ID and create a new owned view before checks continue.

Independent review R1 found that Electron 44's `getLastWebPreferences()` omits
`preload` for both the app and embedded renderers. The former absence-of-preload
selector could count/select the application renderer; a delayed hidden baseline
reproduction counted two contents and failed. The revised browser suite passed
twice, including once after a fresh build, with direct fixture identity and
Electron 44.10.1 recorded in its output. The revision also reran typecheck, all
348 unit tests, build, fresh audit, the installed-runtime probe, and native PTY
acceptance (the latter using a disposable hidden-launch copy). Smoke was not
repeated for this test-only revision; its earlier implementation/review passes
remain historical evidence.

## Recorded local acceptance

macOS arm64, Node 24.21.0, pnpm 12.9.1:

| Check | Result |
| --- | --- |
| Original lockfile, fresh audit | Reproduced one high Electron advisory; exit 1 |
| Updated frozen install and dependency rebuild scripts | Passed with isolated node_modules and store |
| Explicit node-pty source compilation | Passed with node-gyp 11.4.2 and Electron 44.10.1 headers |
| `pnpm typecheck` | Passed |
| `pnpm test` | Passed: 33 files, 348 tests |
| `pnpm build` | Passed; existing large-chunk warning only |
| `pnpm audit:dependencies` | Passed: no known vulnerabilities |
| Original lockfile with the same audit flags | Correctly failed with exit 1 and the Electron advisory |
| Audit with unavailable registry | Correctly failed; registry failures cannot pass the gate |
| `pnpm test:electron-runtime` | Passed: Electron 44.10.1, Chromium 152.0.7977.169, Node 24.22.1, native ABI 149 |
| `pnpm test:browser` | Passed: embedded isolation, fixture MCP permissions, navigation, extraction, persistence |
| `pnpm test:project-platform` | Passed: real PTY input/resize/Ctrl+C, teardown, local preview, renderer loss |
| `pnpm test:smoke` | Passed: browser preview and production Electron launch/security/bridge checks |
| Windows/Linux execution | Not run locally; existing native workflow remains responsible for those platforms |
| Packaged runtime | Pending: no installer/package artifact exists in this source distribution |

For explicit source compilation on this host, the node-gyp invocation was:

```sh
npm exec --yes --package=node-gyp@11.4.2 -- node-gyp rebuild \
  --directory node_modules/.pnpm/node-pty@1.1.0/node_modules/node-pty \
  --target=44.10.1 --arch=arm64 --dist-url=https://electronjs.org/headers
```

The verification used task-specific npm/header caches under `/tmp`. This tool
was not added to project dependencies. Normal `pnpm rebuild` can select node-pty's
N-API prebuild; the explicit compilation additionally verifies the source build.

## Fresh dependency audit gate and packaging handoff

`.github/workflows/dependency-audit.yml` independently runs for pull requests,
pushes (including tags), manual dispatch, and reusable workflow calls. It installs
the frozen graph with native scripts disabled, then runs `pnpm audit:dependencies`
against current registry advisories. All production and development dependencies
are included, and every advisory of low severity or higher fails the job. There
are no ignored advisories, cached audit results, `continue-on-error`, or registry
error bypasses.

Issue 65's packaging/release workflow must call
`./.github/workflows/dependency-audit.yml` as a required job and make packaging
and publication depend on that job with `needs`. A separate tag-triggered check
alone cannot stop an independent publication job. Branch-protection requirements
also need repository configuration; this change does not configure them.

This repository currently produces `dist/` and `dist-electron/` source builds,
not a packaged application. The installed runtime has been verified; the package
portion of issue 52's acceptance remains pending until issue 65 produces an
artifact. That artifact must be launched to read its own `process.versions.electron`
and exercise its bundled browser and native PTY before release. A successful
source build or npm package version alone is not packaged-runtime evidence.
