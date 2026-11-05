# Issue #17: persistent routines verification

Issue: https://github.com/AlexSingh-cpu/theseum/issues/17

Branch: `AlexSingh-cpu/fix-17-routines`, [PR #51](https://github.com/AlexSingh-cpu/theseum/pull/51), targeting **main** at `e99f18ede36555190760e0742b9463ddface649f`. Main remains an ancestor; the original integration through `2afe6b086f97c33e9efc9a8f3828842a1011222d` preserved the verified routine tree. The correction below changes routine behavior plus narrow internal runner/main wiring. The coordinator owns pull-request merging; this worker has not merged a pull request.

## Correction review — R17-2 (P2), first repaired startup load

The separate correction reviewer reproduced an additional macOS bug at `9ccd52b244aa29c128cce0643bd39c33cd86c8c2`: if initial storage loading failed, repairing `routines.json` and explicitly resuming adopted stale active execution rows without startup reconciliation. A real interrupted runner task remained queued in routine history and blocked every new occurrence. The independent production service/store/runner probe was reproduced locally and failed with queued versus interrupted; both new real-runner regression variants also failed before the fix.

Startup and the first successful repaired load now share `reconcileLoaded`. It seeds historical-event and routine-origin suppression, preserves actual terminal runner status/time/error, and marks absent or otherwise unfinished old attempts interrupted with the existing no-retry explanation. Reconciliation is persisted before scheduling resumes; overdue schedules still skip and only a new explicit occurrence executes. Recovery from a runtime write fault continues to preserve in-memory cancellation and completion results. No runner, main, preload, auth, helper or task-context interface changed in this correction; R17-1 guards and manual/running behavior remain intact.

Validation on macOS: `pnpm exec vitest run tests/routines.test.ts tests/routines-runner.test.ts` passed **38 cases** (25 service/store and 13 actual-runner cases), `pnpm build` passed, and `pnpm test:routines` passed the expanded production Electron acceptance. New cases cover repaired first load with retained/expired runner history, invalid Resume remaining paused, no implicit recovery or retry, offline skip, durable truthful terminal history, actual execution of one new occurrence, every terminal status, and historical/origin suppression after result-link pruning. Production Electron additionally keeps a nonregular store across app startup, repairs it while open, explicitly resumes, compares persisted interruption/time with actual runner history, and verifies the next new occurrence completes. All fixtures use local disposable executables without live providers; the real-runner executable cases skip Windows. Existing Vite >500 kB advisory remains.

All disposable apps/children closed and exclusive LOCAL UI was explicitly released in `msg_6270e608c448`. The source/test candidate is frozen once pushed; its immutable SHA, exact final-head Windows/Ubuntu Actions links, receipts and limits are retained in the ignored durable report `artifacts/verification/issue-17-r17-2-final.md` and PR #51 description. Earlier checkpoints below record R17-1 validation at their stated historical heads; no broad unrelated reruns are claimed for R17-2. Independent review and merge remain coordinator-owned.

## Independent review correction — R17-1 (P1), prior checkpoint

The original independent review is complete and reported exactly one actionable finding: an already queued routine could execute after a later routine-store failure, contradicting the stopped-automation warning and leaving routine history stale at queued. Its actual-runner/nonregular-destination reproduction was read alongside the final report in the separate `review-51-routines` checkout. R17-1 is addressed as follows:

- A storage fault now stops the timer, pauses scheduling and changes the execution generation before cancelling all routine-owned queued/starting reservations. Cancellation and live history reconciliation require no successful routine write. Already running routine snapshots and unrelated manual work continue.
- Reservation ownership is delivered synchronously before runner publish/launch, covering linkage failure before the start Promise returns its run ID. `AgentRunner.start` has two optional trailing internal arguments after the unchanged `taskContext` position: reservation callback and launch guard. Every earlier argument, snapshot and preload API remains unchanged. Starting reservations with no child finish cancellation immediately while existing worktree attribution and launch-token protections remain intact.
- The per-occurrence generation guard is retained through runner queue drain, worktree preparation and final spawn. Cancellation callback exceptions are isolated per reservation; a failed callback cannot let an old queue entry execute, even after healthy explicit resume. Already starting snapshots still survive routine edits; storage/stop revocation applies to work that has not spawned.
- Actual cancellation/completion remains visible in memory during storage faults; the warning explicitly discloses unsaved recent history. Recovery validates healthy storage and saves state only on explicit Resume scheduling. A session marker written before scheduling prevents automatic restart after a failed pause write; it clears only after runner shutdown and final status delivery. Missed occurrences are skipped, never caught up.

Correction validation on macOS: `pnpm build` passed; `pnpm test` passed **32 files / 339 tests** (23 routine service/store cases plus 11 real-runner integration cases). The new integration file uses actual `AgentRunner`, filesystem and disposable local executable, with no child-process or runner mocks. It covers actual nonregular destination, directory EACCES and 3 MB capacity failures, failed linkage write before run ID return in queued/starting stages, pending preparation and delayed-return races, throwing cancellation callback isolation, manual/running preservation, truthful terminal status, failed pause persistence, restart marker and explicit healthy recovery. These executable/shebang cases are skipped on Windows; no Windows execution claim is made.

`pnpm test:routines` passed the expanded production Electron suite, including the actual nonregular routine-store fault with an occupied manual slot, slot release with zero forbidden routine child, cancelled history, faulted-session restart and explicit healthy resume/new execution. A stale native picker ID in the initial expanded harness run was corrected by reselecting the project after restart; the complete rerun passed.

## Correction verification checkpoint

The frozen source/test candidate is **`73ea8ab88fc410bf85f8e89d55522efd9c65c66a`**, pushed to the same branch and PR. This subsequent report update changes only this document; `git diff --exit-code 73ea8ab HEAD -- . ':!docs/verification/issue-17-routines.md'` proves source/test equivalence. Main `e99f18ede36555190760e0742b9463ddface649f` remains an ancestor. Against main, all changes are the intended routine feature plus its two necessary additions: `electron/agent-runner.ts` and `tests/routines-runner.test.ts` (19 files total).

All local checks completed successfully at the frozen source candidate:

| Check | Result |
| --- | --- |
| `pnpm build` | TypeScript, production renderer and Electron bundles passed; existing Vite >500 kB advisory only. |
| `pnpm test` | 32 files / 339 tests passed, including the 11 actual-runner/local-child fault cases. |
| `pnpm test:routines` | Expanded actual production Electron routine acceptance and R17-1 fault/recovery scenario passed. |
| `pnpm test:smoke` | Browser and production Electron navigation/assets/layout, exact bridge/security and payload checks passed without page/console/request errors. |
| `pnpm test:concurrency` | Real local processes, capacity/checkout ownership, worktree concurrency, overflow/cancellation/drain, Stop all and restart passed. |
| `pnpm test:continuation` | Same-thread/stdin/cwd, active exclusion, restart, identity/refusal/recovery, legacy UI and responsive fixture checks passed. |
| `pnpm test:composer-context` | Native explicit context selection, immutable file/agent/skill/command context, hostile/stale/scope rejection and provenance restart passed. |
| Diff/status | `git diff --check` passed; clean worktree after candidate commit. |

Routine editor/list/history screenshots were regenerated; the 1100px list was visually checked after the correction. All disposable apps/processes were closed by successful fixture cleanup, and the exclusive LOCAL UI gate was explicitly released to the coordinator in `msg_9f735f580105` and transferred to the separate correction reviewer. No additional UI work is running in this checkout.

Actions run [40894664083](https://github.com/AlexSingh-cpu/theseum/actions/runs/40894664083) checks the frozen source head. The final report-only head is also submitted to the existing **Project tools native** workflow using `workflow_dispatch` if the PR path filter does not run it; its exact SHA and final Actions receipt are attached to the same PR description and the worker completion report. This workflow builds and runs selected PTY/project-tool and research units plus Windows/Ubuntu native terminal/preview Electron acceptance; it does **not** run the full routine unit suite or routine UI acceptance. Final CI success is claimed only after both native jobs complete at the actual PR head. Separate correction review remains coordinator-owned.

All five acceptance criteria are implemented:

| Acceptance | Implementation and evidence |
| --- | --- |
| Persistent create/edit/enable/disable/delete | Main-owned versioned store; revision checks; native-selected registered project and exact saved-agent revision; real editor, activation consent, deletion review, restart/reload persistence. |
| Defined schedules/events/offline behavior | Intervals 1–10,080 minutes; selected UTC weekdays/time; once per observed non-routine live run ID on completion/failure in the same canonical project. Offline/restart/sleep misses are skipped, never replayed. No OS background daemon or external webhook. Stop all pause persists until explicit resume. |
| Launch actual configured work | Uses existing `startRun` and real runner after main project/profile/capability/safety checks; config guard immediately before reservation; configured sandbox/task/instructions reach the local Electron fixture process. No memory, file, page or workflow attachments are selected implicitly. |
| Computed next times and actual history/results | Next future occurrence calculated in main; durable preparing reservation; real status/diagnostics; result links to persisted runner output; deleted/expired history removes result links. 500 attempts retained, including deleted routines. |
| Real execution notifications | Real routine runs use the existing runner status flow, in-app notification candidates and desktop notification preference adapter. Electron verifies actual fixture completion/failure notifications. No notification is fabricated for demo state or preparation failure before a run exists. |

Safety and concurrency behavior:

- Strict main IPC sender and config validation; no arbitrary path, command, sandbox or event injection through routine APIs.
- Native project choices resolve through registered workspace IDs. Stored paths are canonicalized and checked again at execution, including after asynchronous preparation. Registered workspace IDs are reused per canonical path.
- Saved agents are re-resolved by ID/revision at execution and immediately before reservation. Archived, deleted or changed profiles fail visibly until reviewed. Existing safety, sandbox, global slots, project locks, timeout, connection guards and immutable task-context boundaries remain intact.
- An occurrence is persisted before asynchronous launch. One preparing/queued/active occurrence per routine; duplicates and overlaps cannot reserve additional work. Editing/disabling/deleting invalidates pending guards and cancels queued work. Already starting/running work keeps its immutable snapshot and continues.
- Routine-origin runs and continuations cannot trigger other routines, including after history trimming. Historical events and events observed after long scheduler suspension are not replayed. Shutdown stops timers/preparing starts; actual interrupted runs are never retried after restart.
- Storage rejects malformed UTF-8, malformed/versioned metadata, symlink/hardlink/nonregular/oversized files, unsafe directories and directory replacement. Reads use precheck plus nonblocking/no-follow descriptor validation and a hard byte cap. Saves use unique exclusive temporary files, mode 0600, fsync and atomic replacement. Failures preserve prior bytes/state and stop automation with a visible warning.

Checks completed on macOS:

- `pnpm build`: passed TypeScript plus production renderer/Electron bundles. Existing Vite >500 kB chunk advisory remains.
- `pnpm test`: passed **32 files / 339 tests**, including **23 routine service/store tests**, **11 real-runner routine fault cases** and upstream research corrections.
- `pnpm test:routines`: passed on the integrated base, then passed again after final UI text/wrapping and history screenshot changes.
- `pnpm test:smoke`: passed browser navigation/images/settings/layouts/inspectors and Electron security flags, exact narrow bridge allowlist, invalid payload rejection, workspace read, memory export and popup blocking. Only routine assertions and seven routine bridge entries were changed.
- `git diff --check`: passed.

Focused unit coverage includes interval/weekly/year-boundary calculation; invalid trigger/config/native-folder/profile/revision rejection; CRUD/restart; durable duplicate reservation and overlap; pending edit/disable/delete/Stop all races; queued cancellation versus immutable running configuration; offline skip/interrupted restart; same-project actual events, recursion and repeated update suppression; actual failures; persistent pause; sleep/shutdown event suppression; 500-row retention preserving active work; reservation/startup persistence failure; unsafe/corrupt/FIFO/oversized/malformed UTF-8 storage; growth while reading; atomic replacement failure; and directory replacement. FIFO cases are skipped on Windows.

Electron coverage uses disposable profiles/projects and a local synthetic executable through the actual production preload/main/runner. It validates the real editor/native picker/explicit activation, computed scheduled firing with controlled main clock, event firing from real fixture success/failure, task/agent instructions/sandbox/canonical cwd, actual saved output and notification adapter, hostile senders, stale config, project scope and no recursion, queued disabling, persistent Stop all/reload/restart/resume/offline skip, run-history deletion, active-process quit/interruption without retry, persistent routine deletion and 1100px layout. Early harness failures (stale IPC-created agent list, exact-text output selector and one closed-target run) were corrected or retried; the complete integrated and final suites passed with explicit action timeouts and reliable fixture cleanup.

Reviewed local screenshots (generated, intentionally ignored by Git):

- `artifacts/verification/routine-editor-1100.png`
- `artifacts/verification/routines-list-1100.png`
- `artifacts/verification/routines-history-1100.png`

Limits and unverified behavior:

- Schedules require an open, awake app. UTC times are explicit; local-time/DST schedules, cron expressions, external webhooks and catch-up/retry policies are not offered.
- 100 routines, 500 attempts, 3 MB routine store; tasks and paths are local plaintext. Actual outputs remain governed by existing run-history retention. Preparation errors are visible in routine history, with no synthetic run/OS event.
- Overflow Queue uses existing live capacity; overflow Ask fails automated occurrences when busy without unattended approval prompts.
- No provider/account-consuming execution was run. Native notification display/sound is intercepted, with OS signing/permissions still required. Windows/Linux Electron behavior was not executed here; existing runner sandbox enforcement and native platform behavior retain their prior limitations.
- Research PR #50 is merged and final main ancestry is incorporated. Original independent review is complete with only R17-1, corrected above; separate correction verification and eventual merge remain coordinator responsibilities. The worker does not merge it.
