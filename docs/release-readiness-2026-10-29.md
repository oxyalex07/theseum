# Theseus public-release audit

**Decision: not ready for a general public desktop release.** The app has working core features and substantial regression coverage, but this sweep reproduced execution-lifecycle, data-loss, input, history, accessibility, and scalability defects. Distribution and release gates also need implementation.

Audited October 29, 2026, against commit `91ea58a` / version `0.1.0`. Application source was left unchanged. This document and local verification artifacts are the deliverables.

## Scope and evidence

Reviewed Electron main/preload and IPC authorization, agent execution/continuation/crews, process shutdown, project terminals and preview, browser isolation, Git/worktrees, saved profiles, memory and file context, research, routines, persistence, renderer state, interface accessibility, dependencies, build tooling, CI, and distribution configuration.

| Check | Result |
| --- | --- |
| `pnpm test` | **343 tests passed across 32 files** |
| `pnpm build` | Type checks, renderer, and Electron build passed |
| Existing integration/security scripts | **35 unique suites exercised; 33 passed, 2 failed** after the composer rerun |
| Dependency audit | **1 high-severity advisory**, affecting the installed Electron runtime |
| Rendered accessibility scan | axe-core on Home, Agents, Memory, Routines, Library, Browser, Terminal, Settings; repeated contrast failures |
| Desktop layout | Eight main pages at 1100×700 and 1440×900; no overflow in the selected layout containers at normal zoom |
| Zoom | **Failed:** 200% zoom clips the application |
| Additional adversarial probes | Confirmed process orphaning, control-channel timeout failure, Research draft loss/save conflict, IME submission, retention limit, worktree recovery gap, expensive history cloning |

Tests used disposable profiles/projects. Most used fixture runtimes; the existing Memory and Profiles suites each reached a successful real Codex file edit before failing their final UI assertion. No actual GitHub merge or remote publication was performed. The full separate `tests/agent-electron.mjs` suite was not run.

After the request to avoid foreground interruptions, remaining Electron launches used a temporary test preload that prevents `show`, `showInactive`, and focus. Custom UI probes verified `WINDOW_VISIBLE false` at launch and completion. This preload is audit infrastructure, not an application change. Native tests that depend on actual window visibility had already run before this change.

Local evidence is under [`artifacts/release-audit-2026-10-29`](../artifacts/release-audit-2026-10-29), which is ignored by Git. Start with [`summary.json`](../artifacts/release-audit-2026-10-29/summary.json), [`ui-repros.log`](../artifacts/release-audit-2026-10-29/ui-repros.log), [`layout-results.json`](../artifacts/release-audit-2026-10-29/layout-results.json), and the per-suite logs. Reproduction programs and screenshots are included there. Some harness paths refer to this checkout and `/tmp`; adapt them when rerunning elsewhere.

This is a source/build audit on macOS, not certification of packaged binaries, every OS, every provider, or every possible bug. Real OAuth, remote MCP authorization, real PR merges, signed install/upgrade/uninstall, physical assistive technology, and Windows/Linux desktop behavior still require the release-candidate checks below.

## Priorities

**P1:** resolve before general public release. **P2:** meaningful defect or product issue; fix before launch if feasible, otherwise explicitly accept and document it. No P0 catastrophe was demonstrated in this sweep.

There are **14 tracked findings: 11 P1 and 3 P2**. Ten are reproduced functional/security/accessibility/performance defects; interrupted-worktree recovery adds a reproduced crash-state simulation. The remaining three cover CI, first-run sample data, and distribution readiness.

| ID | Priority | Finding | Evidence | GitHub issue |
| --- | --- | --- | --- | --- |
| R01 | P1 | Electron runtime has a high-severity TLS advisory | Registry audit + upstream advisory | [#52](https://github.com/AlexSingh-cpu/theseum/issues/52) |
| R02 | P1 | Cancel and Stop all can leave agent-created processes alive | Process fixture | [#53](https://github.com/AlexSingh-cpu/theseum/issues/53) |
| R03 | P1 | Codex control initialization can hang beyond its timeout | Process fixture | [#54](https://github.com/AlexSingh-cpu/theseum/issues/54) |
| R04 | P1 | Navigating away silently loses Research edits | Electron UI reproduction | [#55](https://github.com/AlexSingh-cpu/theseum/issues/55) |
| R05 | P2 | Saving one Research artifact invalidates another edited artifact | Electron UI reproduction | [#56](https://github.com/AlexSingh-cpu/theseum/issues/56) |
| R06 | P1 | IME Enter unexpectedly submits a live task | Electron input reproduction | [#57](https://github.com/AlexSingh-cpu/theseum/issues/57) |
| R07 | P1 | Pruning over 10,000 expired runs throws during startup | Service reproduction + startup call path | [#58](https://github.com/AlexSingh-cpu/theseum/issues/58) |
| R08 | P1 | History growth makes each edit/update copy the entire history | Source + 150 MB synthetic-history benchmark | [#59](https://github.com/AlexSingh-cpu/theseum/issues/59) |
| R09 | P1 | Repeated text contrast failures | Rendered axe results + CSS | [#60](https://github.com/AlexSingh-cpu/theseum/issues/60) |
| R10 | P1 | Zoom hides controls without a recovery scroll path | Electron zoom reproduction | [#61](https://github.com/AlexSingh-cpu/theseum/issues/61) |
| R11 | P2 | Interrupted worktree creation has no usable recovery path | Real Git worktree + simulated interrupted journal | [#62](https://github.com/AlexSingh-cpu/theseum/issues/62) |
| R12 | P1 | Release verification is neither green nor enforced comprehensively | Existing failures + workflow inspection | [#63](https://github.com/AlexSingh-cpu/theseum/issues/63) |
| R13 | P2 | Saved-data mode still opens with sample sessions and activity | Rendered fresh-profile view + model initialization | [#64](https://github.com/AlexSingh-cpu/theseum/issues/64) |
| R14 | P1 | No distributable installer/signing/release pipeline | Package/scripts/workflow inspection | [#65](https://github.com/AlexSingh-cpu/theseum/issues/65) |

## Detailed findings

### R01 — Update the Electron runtime before shipping

**Location:** [`package.json`](../package.json#L76), `pnpm-lock.yaml`.

The installed and locked runtime is **Electron 44.9.0**. `pnpm audit --json` reports **GHSA-jr5w-w6x2-84p9 / CVE-2026-115570**, high severity. The advisory covers compromised eMudhra intermediate certificates; an attacker able to intercept network traffic with a relevant certificate could impersonate a TLS server. Theseus uses network fetches and an embedded browser, so the runtime is relevant despite Electron being listed under dev dependencies.

The [Electron upstream advisory](https://github.com/electron/electron/security/advisories/GHSA-jr5w-w6x2-84p9) identifies **44.9.1** as the patched version on the current major and says an Electron update is required. See also the [reviewed advisory](https://github.com/advisories/GHSA-jr5w-w6x2-84p9).

**Required:** update the dependency and lockfile to a patched supported runtime; rebuild native dependencies and rerun Electron/browser/PTY tests. Verify the version inside the packaged artifact, and gate future releases on a fresh dependency audit. The passing build does not resolve this advisory.

### R02 — Cancellation loses ownership of surviving descendants

**Location:** [`electron/agent-runner.ts`](../electron/agent-runner.ts#L120), especially `finish`, `interrupt`, and `forceStop`.

**Reproduce:** a fixture agent spawns a detached child with its own process group and ignored stdio, then exits immediately when it receives SIGINT. Cancel the run, wait four seconds, and invoke Stop all.

Observed:

```text
after cancel   {"status":"cancelled","childAlive":true}
after stop all {"status":"cancelled","childAlive":true}
```

`finish()` clears the escalation timer and drops `run.child` as soon as the leader closes. Its final signal targets the original process group. Descendants in another group survive; the later ancestry scan cannot run against the now-exited leader, and Stop all no longer considers the run active. This undermines the assurance that owned execution has stopped. The probe's child was explicitly killed afterward.

**Required:** retain process ownership through shutdown, capture descendants before terminating the leader, and confirm cleanup before reporting completion of cancellation. Use suitable process/job ownership on each supported OS. Add a regression where the leader exits promptly and a descendant ignores or escapes the initial group signal. Exercise Cancel, timeout, Stop all, and application quit. Avoid killing unrelated pre-existing user servers.

### R03 — Control initialization has no reliable hard deadline

**Location:** [`electron/codex-rpc.ts`](../electron/codex-rpc.ts#L6), `start`, `call`, and `close`.

`disableConfiguredMcp()` uses `execFile(..., {timeout: 6000})`, but a child that ignores SIGTERM can keep the callback from completing. The app-server request timer starts only after initialization reaches `send()`. The inventory child is not owned by `CodexRpc.close()`.

**Reproduce:** use a fixture `codex mcp list --json` that ignores SIGTERM and stays alive. After eight seconds, the configured six-second operation was still pending and its process was alive. Two inventory fixture processes from the concurrency suite also remained after their test app had closed; these were cleaned up during the audit.

**Required:** place a hard deadline around the entire control startup, own the inventory child, reject the waiting request independently of process-close callbacks, escalate termination, and make close/shutdown cancel every startup stage. Apply the same lifecycle review to runtime capability and executable/login probes. Verify that a failed check can be retried and that quitting leaves no owned control processes.

### R04 — Research edits disappear on navigation

**Location:** [`src/components/session/research.tsx`](../src/components/session/research.tsx#L12), [`src/components/session/live-run.tsx`](../src/components/session/live-run.tsx#L64).

Research edits exist only in component state. The UI says “Unsaved changes · save before leaving,” but neither route changes nor closing/reloading are guarded. Leaving a session unmounts the component.

**Reproduce:** create a draft, enter `UNSAVED_USER_RESEARCH`, navigate Home → Run history → the same run → Research. The text reverted to the saved result, without a save/discard decision. No renderer exception occurred.

**Required:** preserve drafts by run/artifact outside the panel or persist recoverable local drafts; provide an explicit save/discard path on navigation, session switches, reload, and quit. Keep intentional “Discard edits and refresh” distinct from incidental navigation. Add a regression that uses normal app navigation.

### R05 — Editing multiple Research artifacts causes a self-created conflict

**Location:** [`src/components/session/research.tsx`](../src/components/session/research.tsx#L51), [`electron/research.ts`](../electron/research.ts#L150).

Each local edit stores the document revision from when typing began. Saving any artifact increments the shared document revision, but remaining local edits keep their old revision.

**Reproduce:** create Draft and Outline; edit both; save Draft; switch to Outline and save. The second save fails with `Research changed. Refresh before editing or publishing.` No other writer is involved. Refresh discards the remaining edit; copying the text aside is the practical workaround.

**Required:** reconcile remaining drafts after a known successful local save, or use artifact-specific concurrency/version handling. Retain genuine external-conflict detection. Verify editing all artifact types and saving in different orders without losing changes.

### R06 — IME composition Enter starts execution

**Location:** [`src/components/pages/home.tsx`](../src/components/pages/home.tsx#L44); also audit other submit-on-Enter handlers.

The Home task handler submits on Enter without checking `isComposing`/composition key state. Enter is also used to confirm text in Chinese, Japanese, and Korean input methods.

**Reproduce:** select a disposable project, fill a task, dispatch Enter with `isComposing: true` and key code 229. A new run was created. The reproduction used a missing runtime, so it made no provider call; with a working runtime the same path can start a billable, project-editing task before the user finishes composing.

**Required:** ignore submission while composing, as the follow-up composer already does. Cover Home, the command palette, and demo composers. Add deterministic keyboard tests and a manual IME check. This probe synthesized the event; it did not use a physical IME.

### R07 — Large retention cleanup can prevent startup

**Location:** [`electron/run-history.ts`](../electron/run-history.ts#L122), `historyDeletionCandidates` at line 147; [`electron/main.ts`](../electron/main.ts#L90) and its periodic retention callback.

`prune()` passes every expired ID to `delete()`, but the request validator rejects arrays longer than 10,000. Startup invokes prune without catching this failure. The periodic callback is likewise unguarded.

**Reproduce:** create 10,001 valid completed run IDs older than a 30-day retention cutoff and call `prune()`. It throws `Invalid history IDs` before deleting anything. The service behavior was reproduced directly; failure of startup follows from the uncaught startup invocation. Such a store is permitted by the unlimited-history policy and can accumulate through routines.

**Required:** batch internal deletions, separate internal maintenance limits from renderer request limits, and surface maintenance errors without preventing launch. Test more than 10,000 expired records, partial disk failures, changing retention from Forever, and restarting after a failed cleanup.

### R08 — Unlimited history is copied on normal interactions

**Location:** [`src/state/app-context.tsx`](../src/state/app-context.tsx#L68), [`electron/agent-runner.ts`](../electron/agent-runner.ts#L97), History/session rendering.

Every renderer `update()` deep-clones the complete model, including all saved run output. This path is used for composer typing, navigation, and streamed output. `AgentRunner.getRun(id)` calls `list()` and clones every run to return one run. Initial history application also does repeated session searches/insertion. The default retention is Forever and there is no run-count ceiling or paginated history loading.

A synthetic **1,000-run / approximately 150 MB** retained-output probe measured approximately **116 ms per full-model clone** and **94 ms per single-run lookup** on this machine. These are Node service/primitive benchmarks, not end-to-end renderer timing; hardware and GC affect them. They nevertheless exercise the same operations and demonstrate work proportional to all retained output for a keystroke or lookup. An earlier noisy run was slower; the reported measurements exclude JSON serialization from the timed clone loop.

**Required:** update renderer state structurally, keep heavy transcripts separate from session metadata, retrieve one run directly from the map, paginate/load history and output on demand, and virtualize long lists. Add sustained-stream and typing checks with realistic populated stores. Target responsiveness with 1,000+ retained runs and document any tested limits. The build also warns about a **616.77 kB** minified entry chunk; further splitting is secondary to the history-copying problem.

### R09 — Text contrast repeatedly falls below the target

**Location:** [`src/prototype.css`](../src/prototype.css#L43), lines 75–76, 198, 374; [`src/styles.css`](../src/styles.css#L28).

Rendered axe scans found these repeatable failures:

| Element | Measured ratio | Expected for this small text |
| --- | --- | --- |
| White labels on violet primary buttons | **3.32:1** | 4.5:1 |
| Command/search trigger text | **4.35:1** | 4.5:1 |
| Home session-summary small text | **3.98:1** | 4.5:1 |

Primary-action failures occurred on Agents and Routines as well as the shared New control. Changing shared tokens/styles can fix multiple surfaces. An additional transient tooltip finding was excluded from the release count because the screenshot/scan caught a hover transition.

**Required:** correct shared foreground/background combinations, including hover/focus states; rescan main pages and dialogs with representative data. This is evidence of contrast defects, not a claim that the rest of WCAG has been fully assessed. Suggested UI follow-up: `$impeccable colorize`, followed by `$impeccable audit`.

### R10 — Desktop zoom clips essential UI

**Location:** [`src/styles.css`](../src/styles.css#L40).

The root and body enforce `min-width:1100px`, `min-height:700px`, and `overflow:hidden`. At 200% Electron zoom in a 1440×900 window, the CSS viewport becomes **720×450**, but the content remains **1100×700**. The root/body do not permit scrolling to the clipped portions.

**Required:** make layout respond to the effective CSS viewport, provide usable scrolling/collapsed panels, and preserve primary actions at increased text/zoom sizes. Check 125%, 150%, and 200% at minimum/default window sizes, keyboard access, and dialogs. A public desktop app needs this even if mobile layouts remain out of scope. Suggested follow-up: `$impeccable adapt`.

### R11 — Interrupted worktree creation is stranded

**Location:** [`electron/worktrees.ts`](../electron/worktrees.ts#L80), `get` and `cleanup`.

Creation saves a `creating` record before `git worktree add`, then changes it to `ready`. A crash or final-journal-write failure after Git succeeds leaves an actual worktree recorded as `creating`. Selection and cleanup accept only `ready`; there is no reconciliation or recovery action.

**Reproduce:** create a real disposable Git worktree, set its journal back to the state left by that interruption, and reload the manager. Selection says `Managed worktree was not found.` Cleanup reports no removed, skipped, or error entries, while the folder remains on disk.

**Required:** reconcile journal intent against Git ownership on restart, distinguish incomplete creation from a successfully created folder, and offer safe recovery/forget/manual-cleanup guidance. Preserve dirty, ignored, locked, and active work. Add crash-point tests before Git, after Git, and after final persistence.

### R12 — Establish a trustworthy release gate

**Location:** [`.github/workflows/project-tools-native.yml`](../.github/workflows/project-tools-native.yml), `package.json`, [`tests/memory-electron.mjs`](../tests/memory-electron.mjs#L77), [`tests/profiles-electron.mjs`](../tests/profiles-electron.mjs#L79).

The only workflow is path-filtered and covers Windows/Linux build plus selected project-tools/research tests. It does not enforce the complete unit suite, core desktop workflows, or macOS behavior for every PR. There is no installer/release candidate gate.

Two existing suites remain red:

- Memory successfully verified real selected-memory execution, then waited for `Selected memory references · 1` without opening **Run details**.
- Profiles successfully verified a real run using saved model/effort/instructions, then waited for `Saved configuration snapshot` without opening **Run details**.

Those texts now live in the Run details tab while the inspector starts in Git changes. Source inspection identifies stale assertions; these final failures do not demonstrate lost memory/configuration. Repair the tests and rerun them to establish a fully green baseline. The composer suite initially received an extra `m` in a draft and passed a hidden rerun without source changes; the cause was not established and should be treated as a focus/timing flake until made deterministic.

**Required:** add always-on type/build/unit/security checks; stable fixture desktop suites on supported systems, including macOS; explicit opt-in/provider-backed canaries; packaged-app smoke tests; timeouts and artifact capture; and a required release status. Centralize the hidden test-launch behavior so verification does not steal the developer's foreground. A timed-out suite must also clean up owned processes.

### R13 — Sample content remains in the normal first-run experience

**Location:** [`src/state/model.ts`](../src/state/model.ts#L23), [`src/components/pages/home.tsx`](../src/components/pages/home.tsx#L26), [`src/components/profile/local-profile.ts`](../src/components/profile/local-profile.ts#L5), sidebar/top-bar counters.

A fresh profile in saved-data mode still initializes mock sessions/threads and open sample tabs. The rendered app greets everyone as **Alex**, reports four attention items and sample agents working, and shows sample approvals/errors alongside real tasks. The separate “Show sample data” preference does not control this baseline session model. Some lists are labeled demo, but high-level counts and session chrome remain mixed; even working counts differ between surfaces because some include starting/queued runs and others do not.

**Required:** define the production first-run state. Prefer empty real history/activity and a deliberate demo entry point; make the sample toggle apply consistently if retained. Use a neutral initial identity or ask for a display name. Keep live counts/statuses consistent across Home, sidebar, title bar, and footer. Test a clean profile with no runtime and one with a connected runtime. Suggested follow-up: `$impeccable onboard`.

### R14 — Build the actual public distribution

**Location:** [`package.json`](../package.json), [`scripts/build-electron.mjs`](../scripts/build-electron.mjs), `.github/workflows`.

`pnpm build` emits renderer/main/preload files and `pnpm start` runs a source checkout with its dependencies. There is no installer builder/configuration, signed/notarized packaging job, artifact publishing, or upgrade-validation job. README correctly calls this a source distribution. Checks for an already-packaged app do not establish that packaging works.

**Required before a public app release:**

- Decide the initial supported OS versions and CPU architectures; an explicitly limited macOS release is a valid smaller scope.
- Configure app identity, versioning, icons, platform metadata, native dependencies, ASAR/native-binary handling, and production dependency inclusion. Verify `node-pty` and its helper inside the installed app.
- Build platform installers; sign/notarize where applicable; verify first launch through the normal OS download/install path.
- Test installation, replacement/upgrade with existing data, uninstall/reinstall, and rollback/recovery from a failed update.
- Publish release notes, artifacts, checksums, and source/license notices as appropriate to the chosen distribution.
- Keep the manual update workflow clear and functional, or implement a validated signed updater. Automatic updates are not intrinsically required for v1; a reliable patch-delivery path is.
- Verify that a user without Node/pnpm or the repository can install the app and receives actionable Codex/Git/GitHub CLI setup guidance.

## Remaining launch work and release-candidate checklist

These are gaps to validate or product decisions to make, not additional demonstrated bugs. Implementing every future README limitation is unnecessary; define a narrower, truthful launch scope.

### 1. Execution and security gate

- [ ] Resolve R01–R03 and R06; run cancellation/quit/timeout checks with actual Codex as well as fixtures.
- [ ] Verify no owned processes survive normal close, force close recovery, Stop all, timeout, or failed initialization on each supported OS.
- [ ] Test malicious page content, redirects, untrusted frames, stale receipts, deleted sources, path replacement/symlinks, and privileged IPC against the packaged artifact. Existing tests provide a good starting point.
- [ ] Validate supported Codex versions and installation methods from the installed GUI environment, including PATH differences and Windows command shims if Windows ships. Confirm graceful failures for missing/old/unauthenticated/offline runtimes.
- [ ] Verify enabled HTTP/stdio MCP configuration, connection failure, token-variable absence, OAuth success/cancel/expiry/revocation, and shutdown while connection setup is pending.
- [ ] Confirm that shared Codex sign-out and external launcher permissions are explained accurately. Credentials and raw authentication payloads must stay out of logs and support bundles.

### 2. Data durability and scale gate

- [ ] Resolve R04, R07, R08; address R05 and R11 or document their accepted limitations.
- [ ] Test full disk, read-only storage, failed rename/fsync, corrupted/truncated records, and interrupted writes; show actionable recovery without silent replacement of user data.
- [ ] Test history retention/deletion and source references at realistic large sizes; verify deleting one feature's data does not imply erasing separately retained Codex sessions or memory excerpts.
- [ ] Run a long-session/overnight soak with streaming agents, terminal output, routines, browser/preview switches, repeated close/reopen, sleep/wake, and network interruption. Track CPU, memory, event listeners, file descriptors, and child processes.
- [ ] Establish a backup/restore and upgrade migration procedure; exercise it with populated stores. The README's manual backup is a starting point. Encryption and cloud sync can remain explicitly out of scope.

### 3. Product and accessibility gate

- [ ] Resolve contrast and zoom failures (R09/R10), then run keyboard and screen-reader checks with populated views/dialogs, not only empty pages.
- [ ] Verify focus restoration, custom radio/tab arrow-key behavior, graph alternatives, error announcements, long names/paths, and reduced-motion behavior. The current global motion override needs deliberate review; no physical screen-reader conformance claim was established here.
- [ ] Resolve R13 or explicitly design an opt-in demonstration mode and honest live summaries.
- [ ] Provide a short first-run path: runtime/install/auth status → choose project → explain permissions/account usage → first task → cancel/review/recover.
- [ ] Make errors persistent/actionable for operations that affect work; brief toast-only errors can be missed. Add a renderer error boundary and recovery screen for unexpected component/lazy-load failures.
- [ ] Correct stale UI copy such as “one active run at a time” in the agent editor despite configurable slots, and “future system notifications” despite the implemented notification adapter. Check all shipped copy against actual behavior.
- [ ] Finish with `$impeccable harden`, a targeted re-audit, and `$impeccable polish` after functional fixes. These are optional UI workflows, not dependencies of the underlying bug fixes.

### 4. Release operations and support gate

- [ ] Complete R12/R14, with a clean install/upgrade matrix for every supported OS/architecture.
- [ ] Verify signed-app tray behavior, close/quit semantics, launch at login, system notifications, OS permissions, and native terminal helper execution. Source-build tests cannot validate these fully.
- [ ] Validate the release checker against the first real release and exercise the actual manual/automatic patch path.
- [ ] Decide and publish support contact, bug-report instructions, supported runtime/OS matrix, release notes, and known limitations. Provide a sanitized diagnostic export or a documented way to collect useful local logs.
- [ ] Decide the project/application license and dependency notice approach; no root license file was present. Have the appropriate owner review the public privacy/terms disclosures for local plaintext storage, external model/MCP transmission, shared CLI authentication, retention, and deletion. This audit does not establish legal requirements or compliance.
- [ ] Conduct a small external beta using installed release candidates, triage real reports, and rerun the required gates on the exact artifact intended for publication.

## UI audit assessment

The interface has a coherent shared visual system, usable semantic controls in many areas, and meaningful saved-data empty states. Its implementation integrity is mixed: product-specific workflows are real, but shared live/demo state still creates misleading default activity. This is not a reason to redesign the app; fix the verified behavior and shared tokens first.

| Dimension | Preliminary score | Evidence |
| --- | --- | --- |
| Accessibility | 2/4 | Automated contrast failures; keyboard regression coverage; manual assistive technology still pending |
| Performance | 1/4 | Measured history-wide copying; lazy-loaded heavy views already exist |
| Theming | 3/4 | Shared semantic/prototype tokens, with contrast and duplicate-token inconsistencies |
| Desktop adaptation | 2/4 | Normal minimum/default layouts pass selected overflow checks; 200% zoom fails |
| Implementation integrity | 2/4 | Coherent workflows, but mixed sample/live defaults and stale copy |
| **Total** | **10/20** | Significant work needed within the audited UI scope |

These scores are prioritization judgments, not a certification or a replacement for the launch gates. The Impeccable context launcher was not executable in this environment; no project PRODUCT.md/DESIGN.md was found. Rendered checks used axe-core, Electron metrics, screenshots, and direct inspection instead of claiming a completed Impeccable detector run.

## What already works and should be preserved

- Production type/build checks and 343 unit tests pass.
- IPC ownership checks, context isolation, renderer sandboxing, blocked unexpected navigation/popups, and separate unprivileged browser/preview views are present and exercised.
- Many persistence paths use version validation, private permissions, atomic writes, and explicit damaged-store handling.
- File/memory/page context is reviewed and explicitly selected; stale and cross-project context has substantial test coverage.
- Real Codex runs using saved configuration and selected memory completed successfully in this sweep.
- Routines have durable reservations, no replay after downtime, explicit execution consent, and fail-closed behavior for damaged storage; their desktop suite passed.
- Project PTYs/preview, Git review/merge guards, worktree protection, browser boundaries, profile lifecycle, research export, history, and continuation have meaningful integration coverage.

## Recommended delivery order

1. **Contain execution/security risks:** patched Electron, process ownership, hard control deadlines, IME guard.
2. **Protect work and maintain responsiveness:** Research drafts/revisions, retention batching, history state/storage access, worktree recovery.
3. **Make verification reliable:** repair stale tests, remove focus flakiness, enforce full CI and packaged smoke checks.
4. **Prepare the public experience:** clean first run, contrast/zoom/accessibility, accurate setup and recovery copy.
5. **Ship a candidate, then validate it:** installer/signing/native modules, upgrade/patch path, service canaries, hardware matrix, external beta, and final required checks.

Re-run the audit against the release candidate after fixes. Any intentionally deferred P2 or unsupported feature should appear in the release's known limitations. No deployment or publication is part of this audit.
