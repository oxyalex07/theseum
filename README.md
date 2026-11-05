# Theseus desktop

Theseus is a local desktop workspace for running Codex agents against your projects. It brings task conversations, saved agent configurations, sequential crews, project terminals, local app previews, Git review, research artifacts, explicit memory, and scheduled routines into one Electron application.

The application is built with React, TypeScript, Vite, Tailwind CSS, Radix-based UI primitives, and Electron. The repository was originally named `theseum`; the application is named **Theseus**. This is a source distribution at version 0.1.0, with no signed installer or automatic application replacement.

**Live tasks can modify your selected project and consume Codex account usage.** Home separates **Codex · Live** from **Demo crew**. Live execution, saved profiles, memory, history, routines, account checks, configured MCP connections, and desktop tools are implemented. Sample conversations, sample approvals, sample PRs, and sample data remain explicitly labeled demonstrations.

## Contents

- [Capabilities and operating modes](#capabilities-and-operating-modes)
- [Installation and quick start](#installation-and-quick-start)
- [Finding your way around](#finding-your-way-around)
- [Running tasks and crews](#running-tasks-and-crews)
- [Task context and built-in workflows](#task-context-and-built-in-workflows)
- [Saved agents and GitHub imports](#saved-agents-and-github-imports)
- [Run history, continuation, and recovery](#run-history-continuation-and-recovery)
- [Managed Git worktrees](#managed-git-worktrees)
- [Project terminals and app previews](#project-terminals-and-app-previews)
- [Git changes, reviews, fixes, and PR merges](#git-changes-reviews-fixes-and-pr-merges)
- [Library and project-file search](#library-and-project-file-search)
- [Browser and page context](#browser-and-page-context)
- [Research sources and Markdown artifacts](#research-sources-and-markdown-artifacts)
- [Memory knowledge graph](#memory-knowledge-graph)
- [Persistent routines](#persistent-routines)
- [Accounts and MCP integrations](#accounts-and-mcp-integrations)
- [Settings, notifications, and shortcuts](#settings-notifications-and-shortcuts)
- [Local storage and privacy](#local-storage-and-privacy)
- [Security and execution boundaries](#security-and-execution-boundaries)
- [Development and repository structure](#development-and-repository-structure)
- [Verification](#verification)
- [Troubleshooting](#troubleshooting)
- [Current limitations](#current-limitations)

## Capabilities and operating modes

| Area | Available behavior | Important boundary |
| --- | --- | --- |
| Live tasks | Codex execution, cancellation, follow-ups, saved output | Requires Electron and an installed, authenticated Codex CLI |
| Agents and crews | Saved profiles, role routing, Build → Review, Research → Write | Codex is the only integrated execution runtime; crew steps run sequentially |
| Project tools | Interactive PTY shells, shell command runner, running-app preview | Manual shells use your OS account permissions, independently of the Codex sandbox |
| Git | Local changes, commits, upstream comparison, real PR checks, review/fix runs, confirmed merges | PR operations require a separately authenticated GitHub CLI |
| Context | Reviewed project files, selected memories, selected page extracts | Importing or saving content never automatically includes it in a task |
| Research | Saved source evidence, editable outline/draft/comparison, local Markdown export | A cited URL is not proof that the page was retrieved or verified |
| Memory | Versioned local graph, reviewed extraction, import/export, manual portable-file sync | No automatic learning, remote embeddings, or background cloud synchronization |
| Routines | Interval, weekday/UTC, and same-project manual-run event triggers | Theseus must remain open and awake; no daemon or missed-run replay |
| Accounts and tools | Codex sign-in/usage, app-owned MCP configurations and connection checks | Credentials stay with Codex or the configured environment/provider |
| Demo mode | Simulated crew sessions, approvals, conversation forks, sample layouts | Does not execute agents or apply permissions to live runs |
| Browser preview | Renderer UI and labeled demonstrations | Cannot use privileged desktop execution, filesystem, PTY, or scheduling APIs |

Real profiles, memory, routines, and run history survive reloads and restarts. Simulated conversations reset on reload. Some display preferences, including sample-preview selection, are saved locally.

## Installation and quick start

### Requirements

| Requirement | Purpose |
| --- | --- |
| Node.js **22.12 or newer** | Development and build tooling; Node 24 is used in native CI |
| pnpm **12.9.1** | Pinned in `package.json` |
| An Electron-supported desktop OS | Native application runtime |
| Codex CLI and authentication | Live agent execution; unnecessary for browsing the demo UI |
| Git | Managed worktrees and Git tools |
| GitHub CLI (`gh`) and `gh auth login` | Optional PR checks and merge operations |

Interactive terminals use `node-pty`. Linux installations need the native toolchain required by that module. Windows interactive terminals require Windows 10 1809 or newer and the included Windows PowerShell/.NET runtime. The [native project-tools workflow](.github/workflows/project-tools-native.yml) records the Windows/Linux build and test setup.

### Start the desktop application

From the repository root:

```sh
npm install --global pnpm@12.9.1
pnpm install --frozen-lockfile
pnpm dev:electron
```

The development command builds Electron main/preload, starts Vite at **http://127.0.0.1:5173/**, and opens the app. Do not run `pnpm dev` on that port at the same time. React and CSS changes hot reload; restart `pnpm dev:electron` after changing `electron/` or `shared/`.

Dependencies are pinned through the committed lockfile. `pnpm-workspace.yaml` permits dependency build scripts for Electron, esbuild, and node-pty. Installation and builds also prepare the POSIX PTY spawn helper's executable permissions.

For a local production build:

```sh
pnpm build
pnpm start
```

This loads `dist/index.html` from disk and uses `dist-electron/`. Keep `node_modules` available alongside the source build for Electron and native dependencies. These commands do not create an installer.

### Run your first live task

1. Install Codex and authenticate with `codex login` in a terminal, or use the runtime sign-in flow in **Settings → Models & usage**. The initial integration was verified with `codex-cli 0.162.1`; capability checks use the installed runtime.
2. Start the Electron app and select **Codex · Live** on Home.
3. Choose **Choose project folder** and select a project you intend to let Codex access.
4. Use Codex defaults or select a saved agent. Review the displayed sandbox, time limit, routing, and any selected context.
5. Enter a task, for example: `Explain this project's entry points and suggest the smallest useful improvement.` Choose a read-only profile if you only want inspection.
6. Click **Start Codex**. Follow messages and command/file events in the conversation; use **Run details** to inspect execution state.
7. Use **Cancel run** to stop an individual task, or **Stop all execution** for owned execution across the app. Cancellation does not undo file edits.

No API key or environment variable is required to preview the application. Live tasks require working Codex authentication and connectivity; optional integrations need their own authorization.

### Preview in a browser

```sh
pnpm dev
```

Open **http://127.0.0.1:5173/**. For a production renderer preview:

```sh
pnpm build
pnpm preview
```

Open **http://127.0.0.1:4173/**. Both ports are strict: a conflict fails instead of silently choosing another port. Browser mode explains unavailable desktop operations rather than substituting browser APIs for privileged actions.

## Finding your way around

| Surface | What to use it for |
| --- | --- |
| Home | Prepare a task; use the default Overview panel to inspect an active or recent run’s status, checkout changes, GitHub checks, and next action, or manage agents and routines, browse saved artifacts, and inspect Memory without leaving the right panel |
| Session sidebar and tabs | Open live or sample conversations; switch between Focus, Split, and Grid layouts |
| Session inspectors | Start with Overview for run status, checkout changes, GitHub checks, and a relevant next action; open Git changes, Research, Terminal, Preview, or Run details for more |
| Run history | Search persisted live runs, continue supported threads, review reruns, and delete finished records |
| Agents | Create/edit saved Codex profiles, import GitHub instructions, and manage external launchers |
| Memory | Save and inspect facts/relationships, version history, extraction proposals, and portable graph files |
| Routines | Configure and review scheduled/event-triggered tasks and actual execution history |
| Library | Search saved records and explicitly imported project files |
| Browser | Manage saved links, browse externally or in an isolated embedded view, and review page context |
| Terminal | Run an explicit shell command or open an interactive project shell |
| Settings | Configure defaults, capacity, safety, folders/worktrees, notifications, privacy, integrations, and keys |

The top-right bell opens the notification feed. The avatar opens a cosmetic local profile. The title bar shows live slot usage and queued work.

The interface targets desktop windows: the reference size is **1440 × 900**, with a minimum native window of **1100 × 700**. At increased Electron zoom, the layout follows the smaller effective CSS viewport: **Workspace**, **Sessions** (or **Settings sections**), and **Inspector** buttons switch panels, and content and dialogs scroll to keep controls reachable. Mobile layouts are outside the current scope.

### Explore sample data

**Show sample data** in Agents, Memory, or Home previews 12 fictional agent configurations and a graph with 19 nodes and 18 relationships. **Show saved data** returns to real records. Samples never enter executable profile lists or Codex memory context. Sample graph positions last only while mounted; sample editing/deletion is disabled.

Useful browser entry URLs:

| URL query | Opens |
| --- | --- |
| `?samples=1` | Populated sample preview |
| `?s=c1&view=focus` | Sample coding session |
| `?s=r1&tab=sources` | Sample research sources |
| `?view=grid&page=session` | Active demo sessions in Grid |
| `?page=settings&section=safety` | Approvals & safety |
| `?static=1` | Stops periodic simulated activity; chat replies still simulate |

For Electron, `THESEUS_SAMPLE_PREVIEW=1 pnpm dev:electron` selects the sample view initially. The in-app toggle continues to work.

Demo conversation actions include pausing/resuming activity, reviewing or editing simulated approval commands, and forking a conversation at a message or sample commit reference. A demo fork copies conversation data; it does not create a Git checkout. Demo approvals never authorize a live Codex action.

## Running tasks and crews

### Execution lifecycle

A live task uses a project selected through the native folder picker. Electron main owns the canonical folder and passes an opaque workspace ID to the renderer. Selecting a folder or preparing a draft does not start execution.

| Status | Meaning |
| --- | --- |
| Queued | Accepted and waiting for capacity, a checkout, or a crew dependency |
| Starting | Execution is being prepared or connected |
| Running | A Codex turn is in progress |
| Cancelling | Stop requested; waiting for process termination |
| Completed | Codex emitted `turn.completed` and exited with code 0 |
| Failed | Startup/turn failure, unsuccessful exit, missing completion, or time limit |
| Cancelled | Accepted user cancellation has stopped the execution |
| Interrupted | Tracking ended at shutdown or an unfinished run was recovered at startup |

Completion describes the runtime turn, not independent verification that the task is correct. A recovered command error does not necessarily fail the whole turn. Output is a redacted, bounded projection of public Codex JSONL events, rather than a full PTY stream. Command output arrives at the event boundaries exposed by Codex.

### Routing and crew roles

Home supports a single saved agent, an explicit crew role, **Build → Review**, **Research → Write**, and **Theseus · automatic routing**. The resolved plan is visible before submission.

| Role | Responsibility | Effective file sandbox |
| --- | --- | --- |
| Orbit | Planning | Read-only |
| Forge | Implementation and verification | Selected profile's sandbox |
| Sentinel | Review and findings | Read-only |
| Scout | Research using the project and supplied references | Read-only |
| Quill | Writing from available evidence | Selected profile's sandbox |

Automatic routing checks task words in order: review/audit → Sentinel; research/investigate/compare → Scout → Quill; write/draft/rewrite → Quill; plan/design → Orbit; otherwise Forge → Sentinel. It is deterministic routing, not an independent planning agent.

Each role can use Codex defaults or a current saved profile. Main validates and snapshots model, reasoning, instructions, memory policy, sandbox, and time limits. Role assignments are composer state and reset on reload.

Multi-step crews run sequentially in **Selected project folder** mode so successors see earlier file edits. A successor starts only after successful completion and receives up to 16,000 characters of predecessor final messages as reference data. Each step is a separate saved run with shared crew/dependency identifiers; inspect them through **Live crew steps**. Failure, cancellation, or interruption stops dependent work. Active crews protect predecessor history from deletion. Follow-ups wait until all crew steps end; rerun opens a new single-agent draft for review.

### Capacity and queueing

**Settings → Models & usage → Live capacity** saves 1–8 agent slots, defaulting to one, and an overflow policy:

- **Queue work** accepts pending tasks automatically.
- **Ask me near capacity** offers Cancel or Queue task when slots or the checkout are busy.

Tasks in the same canonical checkout wait for one another. Use separate managed Git worktrees for concurrent tasks from one repository. The scheduler admits eligible tasks in submission order while skipping occupied checkouts. Waiting dependencies use no live slot. Starting and Cancelling tasks occupy slots until their lifecycle ends.

Reducing capacity lets existing tasks finish; increasing it admits eligible queued work. A queued task retains its reviewed configuration and context but creates no worktree or agent process until admitted. Its time limit starts with execution. Queued runs can be cancelled and are protected from history deletion. Shutdown marks unfinished queue entries Interrupted; restart never launches them automatically.

### Time limits and stopping work

The global Safety limit and profile limit are 5–1,800 seconds. The effective limit is the shortest of those and a trusted launch timeout, when configured. This is a process-duration limit, not a spending or token budget.

**Stop all execution** cancels owned queued/starting/running Codex work, revokes browser grants, stops manual command runs and interactive shells, closes app previews, stops demo activity, and durably pauses routine scheduling. It does not roll back edits, stop unrelated apps, terminate external MCP services, or stop external Terminal launchers. Routine scheduling stays paused until **Resume scheduling** is chosen.

Closing a window normally stops owned execution. With **Show in menu bar** enabled, closing hides the window and keeps work/scheduling active. Quitting always follows execution shutdown. On macOS, closing the window can leave the application itself active; use Cmd+Q to quit fully.

## Task context and built-in workflows

Context selection is explicit. Saving a memory, importing a file, or bookmarking a page does not automatically send it to Codex.

### Reviewed project files

1. Choose a project on Home in **Codex · Live** mode.
2. Use **Attach files**, or **Mention agent or file**, to import/browse supported files within that project.
3. Inspect the plain-text content and choose **Include reviewed file in task**.
4. Review the checked files and remove anything you do not want included before Start.

A task can include **five files**, **32,000 characters per file**, and **64,000 characters total**. Oversized selections fail without truncation. Reviews expire after 30 minutes. Main rechecks the project's Library selection, file availability, scope, and content hash before reserving the run. Changes require a new review. Once reserved, a queued run receives an immutable snapshot of the reviewed bytes.

Library restrictions apply: hidden/dependency/build directories, symlinks, unsupported formats, and out-of-project files cannot be attached. File context is labeled untrusted reference JSON. Codex can still independently read project files allowed by its sandbox.

### Agent mentions, commands, and skills

**Mention agent or file** visibly selects a saved agent's actual configuration or opens the indexed file chooser. Typing `@`, `/`, or `$` opens the chooser; unresolved text remains ordinary task text.

**Commands & skills** offers `/review`, `/explain`, `$plan`, and `$test`, with behavior shown before selection. Choose at most one command and one skill. These are fixed prompt workflows validated by main; they do not execute a shell command or discover installed Codex skills.

**Remember this** opens a memory review form for the user-authored task. Saving requires **Save memory** in that editor. Sending a task or invoking a workflow does not save memory automatically.

### Context lifecycle

Memory and browser context have separate explicit selectors described below. Changing project or successfully starting clears composer context; file/workflow selections do not survive reloads. Follow-ups use the saved Codex thread, while a fresh task/rerun requires selecting current context again.

Run context metadata stores file references, IDs, hashes, review times, and workflow IDs, rather than an additional copy of file bytes. Normal agent output can still quote supplied context and is retained under the history policy.

## Saved agents and GitHub imports

### Create a profile

Open **Agents → Create agent**. An agent is a saved Codex configuration, not a trained model. The editor supports name, appearance, description, instructions, model/reasoning, optional native-selected default project, file sandbox, time limit, and memory policy.

**Check runtime** checks executable version/authentication and asks the runtime's public model catalog for supported models and reasoning levels. It starts no task. Options come from the installed runtime, with a five-minute capability cache. **Runtime default** remains available when discovery is unavailable; reasoning overrides require an explicitly advertised model. Theseus ignores personal CLI configuration for its exec adapter, so a runtime default is not a personal `config.toml` profile.

Saving does not execute. Dirty drafts warn before discard; stale edits cannot overwrite newer versions. **Use agent** configures Home while preserving its task and chosen project. A profile's default project applies only when no project is selected. Missing/moved defaults require choosing a folder. A changed profile must be reselected/reviewed before starting.

Profiles support edit, duplicate, archive/restore, and confirmed permanent delete. Use the Active/Archived filters to find archived profiles. Archiving removes a profile from active selectors; an agent with active runs cannot be deleted. Deleting the selected profile falls back to Codex defaults while preserving the task draft and project. Historical run snapshots keep the original configuration. Routines require the exact saved profile revision they were reviewed with; edit and save the routine after changing its agent.

Memory policies are **No memory**, **Selected project memory**, and **Selected personal and project memory**. These control eligible explicit selections; none selects memories automatically. Other integrated runtimes are unavailable.

### Import instructions from a public GitHub repository

1. Open **Agents → Add from GitHub**.
2. Enter a public repository URL or `owner/repo`; optionally specify a branch/tag.
3. Choose **Find agents**, search the Markdown catalog, and preview a file such as `AGENTS.md`, `SKILL.md`, or another agent definition.
4. Review name, description, and instructions. Choose **Read only** or **Allow edits**, then **Add agent**.
5. Use the saved profile on Home with the existing Codex runtime.

Discovery pins an exact commit and verifies the selected blob hash. Simple `name`/`description` YAML frontmatter is extracted and removed from the instruction body. Imports are local copies: they do not clone repositories, install dependencies, execute scripts, import linked files, apply another provider's tool permissions, or update automatically. The source link opens the exact imported commit.

Only anonymous public GitHub access is supported. Private repositories, rate-limit failures, and connectivity errors produce guidance. Catalogs expire after 15 minutes; up to 1,000 Markdown files are listed with omissions disclosed. Instructions must fit the 32,000-character profile limit and are never silently truncated.

### External GitHub launchers

**Agents → GitHub launchers** stores shortcuts with a repository URL, runtime label, exact shell command, and native-selected working folder. Install the tool yourself using its repository instructions. Saving a launcher neither installs nor executes it.

On macOS, **Launch** hands the saved command to Terminal in the selected folder; macOS may request Automation permission. The runtime label is organizational. The command determines what executes, using that terminal's environment and full user permissions. Theseus does not capture its output, apply the integrated Codex sandbox, verify startup, or stop it through Stop all. Other platforms can organize launchers but cannot launch them through this feature.

## Run history, continuation, and recovery

**Run history**, at the bottom of the session sidebar, searches real records by task, project path, or status. Open a record to inspect its output, timestamps, exit code/signal, configuration, and diagnostics. Finished live runs also appear in the sidebar. Demo sessions are excluded.

### Follow up or rerun

**Follow-up** continues the exact saved Codex thread using its runtime-issued UUID. It retains the run, execution folder/worktree, configuration, and earlier output. You can continue a completed/cancelled/failed run when a thread exists, or explicitly continue an interrupted run after inspecting its output and files. A queued initial task or startup failure may have no thread.

Follow-ups cannot overlap a live turn or unfinished crew. They share capacity/checkout locks, apply the current Safety time limit, and recreate browser/MCP access. The runtime must confirm the exact saved thread. Missing runtime session files, missing folders, incompatible resume behavior, or mismatched threads fail clearly; Theseus never substitutes the last thread or silently starts a fresh task. Messages are limited to 32,000 characters.

**Review rerun** opens a fresh Home draft for the original project/task. Review current agent settings and select context again before Start. Missing/archived profiles fall back visibly to Codex defaults; missing projects require a new selection. Rerun never resumes the old conversation.

### Retention and deletion

History defaults to **Forever**, without a run-count eviction limit. **Keep run history** in History or **Settings → Memory & privacy** supports 30, 90, 365 days, or Forever. A shorter policy asks for confirmation and removes expired finished records immediately, on startup, and every minute while open. Active runs and active-crew dependencies are protected.

**Delete selected** and **Delete all finished runs** permanently remove records and output after confirmation. Delete-all includes finished records hidden by search. Partial failures report what could not be removed. Deletion also removes associated research records and invalidates pending export destinations. Project files, saved memories, and Codex's own session files remain. A saved memory's explicit source excerpt remains even when its source-run link becomes unavailable.

Each run keeps approximately **150,000 output characters / 300 entries**; trimming is disclosed. Streaming writes are coalesced at 60 milliseconds, so an abrupt kill can lose the last pending batch.

### Restart and crash recovery

A normal shutdown interrupts active work and records Interrupted unless cancellation was already requested. On startup, persisted queued/starting/running/cancelling records become Interrupted, with a never-started or completion-unknown explanation. Nothing resumes automatically.

An OS kill or power loss bypasses shutdown hooks. Recovery cannot safely reattach to or kill a possibly orphaned process using a persisted PID. Inspect project changes and surviving processes before restarting work after an abrupt exit. Corrupt or unsupported records remain untouched with a warning while healthy records load.

If history storage becomes unavailable, active execution is stopped and new starts are blocked until storage is writable and the app restarts. The last atomically committed record remains recoverable.

## Managed Git worktrees

Choose **Home → Run location → New Git worktree** to isolate a task from the source checkout. The selected folder must be a Git repository root with a committed HEAD and checked-out branch. Theseus creates `theseus/<run ID>` from that commit and runs in a separate folder. Uncommitted source changes are not copied. Run details show source and execution paths.

**Selected project folder** also supports non-Git projects. Multi-step crews currently require this shared-folder mode.

**Settings → Spaces & folders → Worktrees** lets you choose an absolute storage path or `~/…`, select a managed worktree as the project, and clean up merged worktrees. The default is `~/.theseus/worktrees`. Location changes apply to future worktrees; ownership records survive restart and history deletion.

Automatic cleanup is off by default. When enabled, it checks every minute. Both manual and automatic cleanup require the owned worktree HEAD to be an ancestor of its original branch's current local tip. Active runs, selected folders, terminal jobs, local changes including ignored files, changed branches, and locked worktrees keep the worktree protected. Cleanup does not force removal or delete branches.

Fetch, commit, push, and merge remain explicit actions. Cleanup does not infer squash/cherry-pick equivalence: a squash-merged branch can still show commits ahead and be ineligible for ancestry-based cleanup. On restart, interrupted creation records are checked against Git ownership. Settings offers **Recover worktree** when Git finished creation, or **Forget creation record** when no folder, registration, or branch remains. Recovery keeps all files and branches; interrupted records stay outside cleanup until recovered. Uncertain ownership, missing folders with retained Git metadata, and replaced folders require manual inspection of the displayed path and `git worktree list`; they are left untouched.

## Project terminals and app previews

### Interactive shells

Open **Terminal → Interactive shell** for the selected project, or a session's **Terminal → Open shell** for its actual execution folder, including a worktree. The terminal uses node-pty with xterm.js for prompts, ANSI output, full-screen tools, Ctrl+C, and resizing. Sample session shells use the explicitly selected project rather than sample paths. Codex event output is never shell input.

A shell survives tab changes and renderer reloads. **Close shell**, **Stop all**, window destruction, and quit stop its owned jobs; closing to the tray leaves execution running. Up to eight shells run at once. Transcripts are memory-only, bounded to 120,000 characters per scope and 24 retained scopes. Nothing restarts after app exit.

Shells use your current OS account and app environment, with startup files skipped. They are not confined by the agent's file sandbox. POSIX cleanup supervises terminal jobs; Windows uses ConPTY, cmd.exe, and a PowerShell-created Job Object. Cleanup failures retain worktree protection and surface a retryable error. Processes deliberately escaping POSIX terminal ownership are outside ordinary shell-job cleanup.

### Noninteractive command runner

The left-rail **Terminal** also offers **Run command** or Cmd/Ctrl+Enter. Each command starts a fresh `/bin/zsh -f -s` on macOS or `/bin/sh -f -s` on Linux, with the project as its working directory. Use a multiline script for directory/environment changes within one command. For persistent state or interactive input, use Interactive shell.

One command runs at a time, with streaming stdout/stderr, exit/error state, cancellation, and a ten-minute limit. The last 20 commands, each bounded to 120,000 output characters, remain in memory only. Navigation reconnects without stopping a command. The noninteractive runner is unavailable on Windows; use the interactive ConPTY shell.

### Preview a running local app

1. Open the project's **Preview** inspector.
2. Enter a **Local preview URL**, or use **Start a development server** to send an explicit command to an idle shell.
3. Inspect Terminal output and use **Find URLs** to select a loopback URL printed by that project's shell/commands.
4. Interact with the real loaded app. Use Retry/Reload after connection failures or server restarts.

Theseus discovers URLs from scoped output; it does not scan ports or infer ownership of unrelated servers. Servers started outside Theseus stay under their owner's control.

Preview accepts HTTP(S) on localhost, `127.0.0.1`, or `[::1]` without credentials. Assets/HMR must use the selected origin. External/CDN resources, cross-origin redirects, pop-ups, downloads, and device permissions are blocked. Enter another local URL explicitly to switch origins. Loading, a 15-second navigation timeout, connection failures, and renderer failures are visible.

The preview is a separate sandboxed WebContentsView with no preload, Node integration, agent grants, or filesystem API. It hides when leaving the panel or showing application overlays; project changes replace its scope.

## Git changes, reviews, fixes, and PR merges

A live run's **Git changes** inspector uses its actual execution folder. It shows staged/unstaged/untracked changes, the latest 20 commits, local upstream comparison, and the branch's PR diff/checks. Refresh and window refocus reload state; upstream comparisons use existing refs and do not fetch.

Untracked previews are limited to 100 files and 200 KB. Binary, symlink, and oversized entries are labeled omitted. Oversized tracked/PR diffs report an error rather than presenting partial output as complete.

Local Git works independently of GitHub. PR tools require installed `gh` with `gh auth login`; a GitHub MCP connection is a separate configuration. **Open GitHub PR** resolves the checkout's actual PR URL.

**Ask Sentinel to review** launches a real read-only Codex run using runtime defaults. **Review → Fix** or **Have Forge fix all** launches a workspace-write run in the same checkout with selected findings and verification instructions. These action labels do not select saved agent profiles. Linked findings/results persist; failed, cancelled, interrupted, or malformed results never mark findings resolved. Review/fix actions do not commit or push changes.

**Merge PR…** refreshes checks, reviews, mergeability, and head SHA; displays a native confirmation naming the PR/head; rechecks state; then uses `gh pr merge --merge --match-head-commit`. It respects permissions and branch protection without admin override. The repository must permit merge commits. Draft/blocked/stale PRs fail clearly; queued/pending and confirmed merged results are distinguished. Only remote commits are merged, so commit and push local fixes separately first.

## Library and project-file search

**Library** searches saved agents, current memories/relationships, live runs, and explicitly imported project files. Select a project, then **Import files** or **Import folder** through the native picker. **Project files** filters the results; searches match filenames and text with line numbers/excerpts. Inspect a result as plain text.

Imports must be inside the canonical selected project. Supported formats include UTF-8 text/Markdown, common source/web files, JSON/YAML/TOML/XML, CSV/TSV, Dockerfile, and Makefile. Symlinks and symlinked ancestors, hidden paths, dependency directories, and generated build/coverage folders are excluded.

| Limit | Value |
| --- | --- |
| Individual file | 256 KiB |
| Known files per project | 1,000 |
| Indexed text per project | 8 MiB |
| Folder traversal | 4,000 entries; 32 levels |
| Displayed search results | 200 |

Warnings disclose partial indexing; narrow the import/search when a limit is reached. The index refreshes when opened, searched, or manually refreshed, without a background watcher. Folder imports discover new files. Missing, changed, unsupported, inaccessible, or oversized files show current status without exposing stale content. Import kinds are retained: replacing a selected file with a directory does not import its descendants.

**Manage imports → Remove import** removes that selection and entries no longer covered by another selection. **Clear project index** confirms removal of all selections for the displayed project. Original files and other project imports remain.

Selection metadata persists in `library/selections.json`; imported file contents are read on demand and not copied into durable index storage. Library imports do not automatically enter agent context. Use the reviewed Home file selector for explicit inclusion.

## Browser and page context

The left-rail **Browser** has an address/search bar and up to 100 locally saved links. Searches use DuckDuckGo. **External** mode opens validated HTTP(S) URLs in the system browser; embedded credentials and arbitrary protocols are rejected. Bookmarks are not automatically supplied to agents.

Desktop **Embedded** mode uses an isolated, sandboxed WebContentsView with no preload/desktop bridge and an in-memory browsing session. It supports back/forward/reload while denying pop-ups, downloads, device permissions, and non-HTTP(S) navigation. External mode remains the default.

### History and extracts

Embedded history is opt-in and limited to 200 visits. Pause recording, delete visits, or **Clear browsing data** to clear visits, extracts, activity, and temporary cookies/cache. Bookmarks remain. Visit history persists; cookies, page extracts, selected context, and agent grants do not survive restart.

**Extract page** captures up to 20,000 characters from main/article text, falling back to body text, with URL, title, time, and truncation status. Scripts, forms, and hidden-marked elements are excluded, but extraction is not a complete archive or a privacy filter for all page content. Up to five extracts stay in memory.

Review and explicitly select extracts for the next task. Main resolves their IDs, supplies text as untrusted reference data, then clears selection. History stores source references rather than another extract copy, although agent output may quote page text. Clearing browsing data does not erase that output.

### Agent browser access

Runs receive built-in `browser_read` and `browser_navigate` MCP tools through a per-run authenticated loopback endpoint. Access starts denied. While a run is active, open Embedded mode and grant reading/following links on the loaded origin.

Grants are revocable, exact-origin scoped, and end when Browser is hidden, covered by a dialog, or navigated to another site. Tools cannot submit forms, run arbitrary scripts, or visit unrelated origins. The shared browser is owned by the first run using it until that run ends; other runs receive a busy error. These grants govern these browser tools, not every independent capability of Codex or a configured MCP server.

## Research sources and Markdown artifacts

Open a completed live run's **Research** inspector. Sources are collected from saved assistant-result URLs, explicitly selected page references, and recorded browser activity. Each source gets a stable `[S#]` identifier, URL/title, originating run/output or page ID, capture time, excerpt, and SHA-256 evidence hash. User prompts, command output, and sample fixtures are excluded as result sources.

**A URL mention does not establish that the page was fetched, read, or verified.** The panel and exports retain that distinction. Open-source/citation actions use validated external navigation.

### Create and edit artifacts

After successful completion:

- **Create draft from results** preserves saved assistant text.
- **Create outline from results** extracts paragraph/heading first lines with citations from their originating paragraph.
- **Create comparison from results** extracts actual Markdown tables, or source-linked result excerpts with an unverified-evidence label.

These are local transformations without another model request. Missing result/comparison evidence produces guidance rather than invented content. Edit Markdown and **Save** reviewed text; unknown citation IDs are rejected. New results preserve source IDs and existing user edits. Stale edits fail with a refresh message while retaining unsaved text. Output trimming is disclosed, with previously collected provenance preserved.

Research edits are also stored as recoverable local drafts, separately for each run and artifact. Normal navigation and session changes keep them; **Research drafts** provides Save, Discard, and Open Research from any page, including after reload or restart. Reload/quit asks whether to keep editing or leave with recoverable drafts. If local storage reports an error, keep the window open and save before leaving. **Discard edits and refresh** deliberately discards that run's local drafts; navigation does not. A confirmed local save or artifact creation advances the revision of unchanged sibling drafts, so Draft, Outline, and Comparison can be saved in any order, including through **Research drafts** and across restart. Draft base text stays intact; unexpected saved-document changes keep their original revision, show saved text for review, and fail stale saves without overwriting it. A draft for deleted run history remains recoverable for copying or explicit discard, but cannot be saved back to a deleted run.

### Export a saved artifact

1. Choose **Publish / export** and a new local Markdown destination using the native save dialog.
2. Review the path and choose **Export saved artifact…**.
3. Confirm the exact destination in the final native dialog.

Export includes saved text, cited URLs, provenance, and result hashes. It never overwrites an existing file. Destination receipts expire after five minutes or an artifact change. Changed/symlink/nonregular destinations fail; creation uses an identity-checked pinned parent directory and a bounded child writer. Normal failures clean up the new file; forced termination or a system crash can leave an incomplete file, so inspect the chosen destination before retrying. Remote publishing is unavailable.

Research records are bounded to **200 sources**, **3 MB per run record**, and **200,000 characters per artifact**. Damaged/unsafe records are preserved with warnings. Research collection failure does not change a successful execution status. Run-history deletion/expiry removes its research record.

## Memory knowledge graph

**Memory** is a local versioned graph, initially empty. It does not infer personal facts, ingest logs, read projects for learning, or silently promote sample preferences. Nodes are typed **person**, **project**, **preference**, **technology**, or **goal**; labeled relationships join saved nodes.

The React Flow view provides zoom, pan/minimap, dragging with saved positions, fit view, search/results, scope/project filters, and details/version history. Personal and project scopes are explicit. Project scopes use canonical folder paths; renaming/moving a project does not migrate its facts automatically. Relationships cannot link different projects or turn project facts into personal facts.

### Save, revise, and delete

Use **Add memory**, **Add relationship**, or **Remember this** from a user task. Review meaning, type, scope, and provenance before Save. Task-source memories remain tied to their project. Fact meanings are limited to 4,000 characters; saved source excerpts to 1,000. Agent-generated output is not a supported memory source.

Editing creates a new version in the same stable lineage and marks the old version Superseded. Scope and relationship endpoints cannot be silently changed; create a separate fact/relationship instead. Layout changes preserve semantics and lineage positions.

**Delete memory** removes the entire selected lineage, every version, attached relationship lineages, and layout/search records after confirmation. Bulk selection shows the union of affected facts, relationships, versions, and positions for review. Independent duplicates are kept unless selected. Deletion does not erase project changes, separate task/output history, portable files, external copies, or backups, nor retract context already supplied to a running agent.

### Include memory in a task

On Home, expand **Memory context** and select current eligible facts after reviewing their full meaning, source, and dates. Saved profile policies limit eligibility. Codex defaults permit explicit personal/current-project selections. No policy selects facts automatically; switching project/agent clears selection.

Main validates the graph revision, current versions, project scope, profile policy, and relationship endpoints at Start. Context is limited to **20 distinct records / 24,000 serialized characters**, supplied as labeled JSON reference data separately from instructions and the final user task. Selecting a relationship adds endpoint labels, not their full fact meanings. History retains version/lineage references rather than another copy of memory text.

### Extract proposals and find duplicates

**Extract proposals** accepts pasted text or an original saved live user task, up to 32,000 characters. Deterministic **local rules v1** recognizes explicit preference/goal/technology statements such as “I prefer…”, “We must…”, and “We use…”. Up to 50 proposals are shown, initially unchecked; overlong/extra matches are disclosed. No provider call, automatic file access, saving, or task inclusion occurs.

Review/edit labels, meanings, types, exact source excerpts, and scope, then save selected proposals as one reviewed batch. Reviews expire after 15 minutes or any graph change. Unmatched/ambiguous facts can be saved manually.

Local semantic search uses words and curated English synonyms/concepts, without remote embeddings. **Review possible duplicates** compares current facts within compatible scopes/endpoints. Similarity is a review hint, not proof of equal meaning. The scan stops at 100 matches or 20,000 comparisons and discloses partial results. Deletion requires explicit selection/impact review; no automatic merge or relationship reassignment occurs.

### Import, export, and portable-file sync

**Import, export & portable sync** provides a versioned real-graph JSON format (`format: "theseus-memory"`, `version: 1`, `demo: false`) containing owner metadata, scopes, full version chains, relationships, provenance, and positions. Demo exports are a separate incompatible format. Owner labels are user claims, not authenticated identity.

Import previews new, unchanged, and conflicting lineages. For each conflict, choose the whole local or incoming lineage and its layout; divergent histories are not guessed together. Local-only lineages remain. Revision/file changes invalidate the review. Imported provenance is explicitly marked unverified; source-run IDs do not prove local ownership. Imported timestamps must use Theseus's canonical UTC form, `YYYY-MM-DDTHH:mm:ss.sssZ`.

Optional sync connects a user-chosen exported JSON file for the current app session, including a file in an externally synced folder. There is no watcher or background access:

- **Review sync pull** uses the same import/conflict review and never propagates deletions.
- **Review sync publish** discloses which incoming-only/conflicting versions will be replaced, then replaces the file with the complete local graph after review.

Pull/resolve first to keep another device's changes. File changes refuse stale operations; owner changes require reconnecting. Avoid simultaneous publishers. Older imports can reintroduce locally deleted facts. Portable files are unencrypted and include full project paths, source excerpts, and historical versions.

The local graph limit is **5,000 stored versions / 32 MB**. Damaged/unsupported storage is preserved and blocks unsafe mutation/context inclusion. A future repository adapter could replace local storage; no Graphiti service, database, AI extraction, or remote embedding dependency is currently required.

## Persistent routines

**Routines → New routine** saves a task, native-selected project, current saved Codex agent, and trigger. New routines start disabled. Enabling requires reviewing the actual task/project/permissions and explicitly consenting to automatic live work and account usage. Changes persist across restarts; browser preview cannot save/schedule routines.

| Trigger | Behavior |
| --- | --- |
| Interval | Every 1–10,080 minutes |
| Weekday/time | Selected weekdays at a UTC time; select all seven for daily |
| Manual-run event | A manual live run in the same project completes successfully or fails |

UTC schedules do not shift for daylight saving; next-run timestamps display in local time. Event triggers fire once per observed manual run ID, excluding follow-up events on that ID, routine-generated runs/follow-ups, other projects, cancellations, interruptions, and historical records. External webhooks/GitHub PR events are unavailable.

### Scheduling and execution rules

Theseus must stay **open and awake**. With the menu bar/tray enabled, hiding the window keeps scheduling active. Quitting stops it. No OS cron job, daemon, or network listener is installed.

Startup/reopen/resume skip overdue schedules. A wake gap of more than a minute skips missed schedules/events; a missed range records one skipped attempt and advances to the next future time. Offline events are not observed or replayed. Failed/interrupted attempts are never automatically retried.

Each routine allows one preparing/queued/running execution. Overlapping occurrences are skipped. Editing/disabling/deleting invalidates preparing starts and cancels queued tasks; already starting/running work keeps its saved snapshot and continues. Saving/enabling starts a future schedule, without catch-up. Stop all durably pauses all scheduling until **Resume scheduling**.

Routines share global slots and checkout locks. **Queue** overflow uses the regular queue; **Ask** overflow visibly fails an unattended occurrence when busy instead of opening an approval dialog. Missing projects and archived/deleted/changed agents fail visibly. Changed agents require reviewing and resaving the routine. Runtime safety, sandbox, model, timeout, worktree, account, and connection guards remain enforced. Routines do not automatically include memories, file/page attachments, or composer workflows.

### History and storage failures

**Execution history** shows the latest 500 attempts across routines, including trigger, configuration revision, status, and diagnostics. **View result** opens the actual persisted run. Deleting/expiring run history removes that link while retaining non-content routine attempt metadata. Deleting a routine keeps execution history. Completed/failed runs follow existing notification preferences; failed preparation has diagnostics without a fabricated run result.

The routine store allows 100 routines, 500 attempts, and 3 MB. Storage failures latch scheduling off and cancel not-yet-started reservations. Already running snapshots and unrelated manual work can continue. Repair storage, then explicitly **Resume scheduling**; healthy storage alone never resumes automation. A persisted session marker keeps interrupted/faulted scheduling paused after restart.

## Accounts and MCP integrations

### Codex account and usage

**Settings → Models & usage** shows account state and quota windows reported by installed Codex. **Sign in** starts runtime browser authorization; **Cancel sign-in** stops it. **Sign out** affects the shared CLI account and is blocked while tasks are active. Subscription management opens ChatGPT account settings; Theseus does not manage billing.

Usage/reset windows come from `account/rateLimits/read`, with missing data shown unavailable. API-key accounts do not expose ChatGPT quota windows. Home uses the same data, refreshed every 30 seconds. Usage does not automatically defer tasks to a quota reset.

### App-owned MCP servers

**Settings → Integrations** supports HTTPS, local HTTP, and absolute-path stdio executables with JSON argument arrays and environment variable names. Rejecting inline URL credentials/query strings/fragments and the reserved `theseus_browser` name keeps configuration bounded. Configure trusted services; stdio programs run with your user permissions.

GitHub, Linear, and Slack buttons prefill service configurations. GitHub uses `GITHUB_TOKEN`; Slack uses `SLACK_MCP_TOKEN` for an MCP-enabled Slack app. Linear and supported custom HTTP servers without bearer variables offer Codex-managed OAuth. Authorize, then **Check connection**; saving alone does not prove connectivity or tool availability.

Keep secret values in the launch environment rather than command arguments/URLs. OAuth callbacks and credentials stay with the main-process runtime. Enabled servers are passed explicitly to new Codex tasks while unrelated personal CLI MCP/app configuration is disabled. Changes affect new tasks; active turns keep existing connections.

**Disable** excludes a server from new tasks. **Remove** deletes local configuration, without revoking provider credentials. Sign out OAuth connections before removal or revoke at the provider. Damaged configuration is preserved and blocks edits/new runs until repaired. Built-in browser access uses its own per-site grants; native Codex filesystem access follows the selected sandbox.

## Settings, notifications, and shortcuts

### Settings reference

| Section | Main controls |
| --- | --- |
| General | Home/last-session startup, default space/layout/agent, density, collapsed tool cards, login/tray behavior |
| Models & usage | Runtime account/usage, saved model configuration, agent slots and overflow |
| Approvals & safety | Supported file sandbox/approval capabilities, global timeout, Stop all |
| Spaces & folders | Selected folder, managed worktree location and cleanup |
| Notifications & focus | Failure/completion events, banner/sound/badge, deep-work filtering |
| Memory & privacy | Saved-memory navigation, history retention, explicitly separate demo preferences/export |
| Integrations | Built-in tools and app-owned MCP connections |
| Keyboard | Per-action rebinding and reset |
| About | App/runtime versions and manual update checks |

General renderer preferences persist in local storage. **Last session** opens saved output after recovery without resuming a process; unavailable/deleted sessions fall back to Home. Explicit URL navigation wins over launch defaults. A missing/archived default agent falls back visibly to Codex defaults. Layout/default changes do not rewrite historical run configuration.

### Desktop lifecycle and updates

**Launch at login** is supported for installed macOS/Windows packages; it is disabled for this source distribution and Linux. **Show in menu bar** adds Open/Quit tray actions and keeps execution alive when the window is hidden. Windows packages need the app identity `ai.theseus.desktop` for notification/login integration.

**About → Check for updates** checks the repository's public stable GitHub release with a 15-second timeout. Offline, rate-limit, invalid-metadata, and unpublished states are distinct. A newer version offers a validated release-page link for manual installation. Quit the app, obtain the release source, then run `pnpm install`, `pnpm build`, and `pnpm start` in that checkout. The app does not execute downloaded update code or replace a running installation.

### Notifications and local profile

The in-app bell delivers real terminal run states and labeled sample attention items, applying preferences when first observed. Existing/read items remain after preference changes; suppressed events are not replayed. Feed decisions/read state last for the app session. Continued runs can deliver a fresh result.

System notifications cover completed/failed live runs, with banner, banner+sound, or badge-only delivery. Notifications omit task/project/output text. Failure badges clear on app focus where supported. OS permissions/signing can suppress delivery; macOS native notifications require a signed application.

Deep-work filtering uses **Monday–Friday, 09:00–12:00 local time**. **Nothing** suppresses new notifications; **Only blockers** allows failed live runs for OS delivery, and failed/interrupted runs or sample approval/answer/error blockers in the feed, subject to category preferences. The app badge still updates. Morning brief is a demo setting; no brief service runs.

The avatar's display name/bio are cosmetic local preferences. They are not an online account, Codex identity, or memory context. Overview counts exclude samples. No crash-reporting upload service is configured.

### Default keyboard shortcuts

Cmd and Ctrl are interchangeable primary modifiers across platforms.

| Shortcut | Action |
| --- | --- |
| Cmd/Ctrl+K | Command palette |
| Cmd/Ctrl+N | New task composer |
| Cmd/Ctrl+0 | Home |
| Cmd/Ctrl+1 / 2 / 3 | Focus / Split / Grid |
| J / K | Next / previous session |
| Cmd/Ctrl+Enter | Approve a waiting demo request |
| A / D | Approve / deny selected demo request |
| `/` | Search Settings |

Every action has its own binding in **Settings → Keyboard**. Rebinding replaces the old shortcut, persists across restart, and rejects conflicts. Escape cancels capture; modifier-only/repeated/IME events do not assign keys. Shortcuts pause in editable fields/dialogs, except a modified command-palette shortcut can open while typing. Demo approval shortcuts do not change live permissions.

## Local storage and privacy

Electron main owns application records under `app.getPath('userData')`, normally `~/Library/Application Support/Theseus` on macOS. `<userData>` below means that OS-specific directory. Only one app instance can use a profile at a time.

| Location | Saved data |
| --- | --- |
| `run-history/<run-id>.json` | Versioned run metadata, bounded redacted output, saved thread/configuration references |
| `run-history/retention.json` | History expiration policy |
| `agent-profiles/<UUID>.json` | Saved instructions, appearance, runtime options, approved default project |
| `agent-launchers.json` | External terminal shortcuts |
| `memory/graph.json` | Versioned facts/relationships and graph positions |
| `memory/portable-owner.json` | Local portable graph owner metadata |
| `research/<run-id>.json` | Sources, evidence, editable artifacts |
| `routines.json` | Routine configuration, scheduling state, bounded attempt history |
| `library/selections.json` | File/folder selection metadata; no durable imported file contents |
| `browsing-history.json` | Opt-in embedded visit history |
| `worktrees.json` | Managed worktree preferences and ownership journal |
| `desktop-preferences.json` | Tray, notification, capacity, and other main-owned desktop preferences |
| `safety-policy.json` | Main-owned live execution policy |
| `mcp-servers.json` | App-owned MCP configurations, with environment variable references |
| Renderer local storage | General preferences, keyboard bindings, bookmarks, cosmetic profile, sample-view preference |
| `~/.theseus/worktrees` by default | Actual managed Git working folders, outside app user data |

Selected project permissions and composer drafts/context are session state. Shell transcripts, command history, page extracts, browser cookies, and grants are memory-only. Codex separately owns authentication and runtime thread/session files; Theseus history deletion does not erase those files.

Records are **local plaintext, not encrypted**. Known environment secrets and common token/bearer/JWT patterns are redacted, but arbitrary task text, project paths, source excerpts, and output can still be sensitive. Do not put credentials in tasks, instructions, launcher commands, or memory. Content explicitly supplied to Codex/MCP services leaves the local storage boundary according to those services' operation.

Main stores use versioned validation and atomic temp-write/fsync/rename patterns; private POSIX files/directories generally use 0600/0700. Windows access follows parent directory ACLs. Hardened file workflows reject unsafe/nonregular paths and bound reads. Damaged data is preserved with feature-specific warnings rather than silently discarded; recovery behavior varies by store as described above.

For a manual backup, quit Theseus first and copy the app user-data directory plus any project/worktree folders you need. Preserve Codex's runtime sessions separately if future thread continuation matters. There is no built-in full-app backup/restore or encryption workflow. Memory's reviewed portable export is the supported graph-sharing path.

## Security and execution boundaries

### Electron boundary

The renderer has context isolation, sandboxing, and web security enabled, with Node integration disabled and no webviews. Production uses a strict script CSP; development allows the local Vite refresh/HMR connection. Unexpected windows/navigation and permission requests are denied.

`electron/preload.ts` exposes a frozen, typed API defined by `shared/bridge.ts` and feature contracts. Main validates the owning webContents, top-level frame, exact renderer URL, and request shape. There is no generic renderer `invoke`, unrestricted shell/filesystem API, arbitrary browser script API, or exposed `ipcRenderer`. Native pickers and main-owned IDs/receipts authorize folder/file/destination operations.

Embedded Browser and app Preview are separate isolated WebContentsViews without the desktop preload. Their origin/resource policies differ: Browser supports web browsing, while Preview is restricted to its chosen loopback origin.

### Codex execution policy

Electron spawns the CLI directly with `shell: false`, fixed argument construction, the approved project as `cwd`, and the task on stdin. The base workspace-write invocation is:

```text
codex --no-daemon --ask-for-approval never exec --ignore-user-config --json --color never --sandbox workspace-write --skip-git-repo-check --ignore-rules -c sandbox_workspace_write.network_access=false -c web_search="disabled" -
```

Main adds validated profile/model/tool/context settings and uses the selected effective sandbox; follow-ups use the exact saved thread. `--skip-git-repo-check` permits intentionally chosen non-Git projects. No sandbox-bypass fallback is used. Incompatible runtimes fail visibly.

| Policy | Behavior |
| --- | --- |
| File access | Read-only or workspace-write; some roles force read-only |
| Approvals | Fixed to `never`; escalation fails rather than waiting on a demo approval |
| Agent shell network | Explicitly disabled; built-in web search disabled |
| Personal config/rules | User CLI configuration and remembered execpolicy grants are ignored |
| Interactive ask-first / command allowlist | Unsupported; cannot be enabled through renderer state |
| Per-step timeout / network domain allowlist | Unsupported |
| Whole-run duration | Main-enforced effective limit |

Network restrictions concern sandbox commands, not model service connections, app-owned web browsing, or explicitly configured MCP services. Manual terminals and external launchers use OS permissions separately. Context labeling is useful separation, not a guarantee against prompt injection or a replacement for sandbox enforcement.

## Development and repository structure

| Path | Responsibility |
| --- | --- |
| `src/main.tsx`, `src/App.tsx` | Renderer entry and application composition |
| `src/components/layout/` | Title bar, rail, sessions/tabs, notifications, status/navigation |
| `src/components/pages/` | Home, Agents, Memory, Routines, Library, Browser, Terminal, History, Settings |
| `src/components/session/` | Conversation/tool cards, live output, Git/research inspectors, demo actions |
| `src/components/composer/`, `src/components/crew/`, `src/components/memory/` | Reviewed task context, routing controls, memory workflows |
| `src/state/` | React providers, typed demo state/transitions, preferences, keyboard/search support |
| `src/data/` | Explicit mock/demo fixtures and optional populated samples |
| `src/styles.css`, `src/prototype.css` | Semantic/Tailwind styling and retained reference styling |
| `src/components/ui/`, `components.json` | Customized Radix/CVA primitives and component aliases |
| `electron/main.ts`, `electron/preload.ts`, `electron/policy.ts` | Native lifecycle, narrow IPC bridge, sender/request policy |
| `electron/agent-runner.ts`, `codex-protocol.ts`, `codex-rpc.ts` | Owned processes, queue/crew lifecycle, JSONL projection, runtime control |
| Other `electron/` modules | Feature-specific storage, validation, browser/project tools, Git, routines, integrations |
| `shared/` | Renderer/main contracts and feature validation; no runtime Node dependency in the renderer bridge |
| `scripts/` | Electron bundling, combined dev launcher, native PTY preparation |
| `tests/` | Unit/policy/storage tests and real Electron/browser integration suites |
| `.github/workflows/` | Focused Windows/Linux native project-tools and research checks |
| `public/assets/brand/` | Theseus logos, app mark, favicon, and touch icon |
| `reference/orbit/` | Archived original standalone prototype, unchanged and not executed by the React app |

The renderer builds to `dist/`; Electron main/preload build to `dist-electron/`. These, `node_modules/`, and verification artifacts are ignored by Git. node-pty stays external to esbuild so adjacent native binaries/helpers resolve. Future signed/ASAR packaging must unpack these native assets.

The original design can be opened directly at `reference/orbit/orbit-app.html`; see [reference documentation](reference/README.md). Its stale artifact metadata path `source/orbit/orbit-app.html` is preserved as archival content and has no runtime effect. [FolderDirectory.md](FolderDirectory.md) provides a short repository map.

### Common development commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Renderer-only development on port 5173 |
| `pnpm dev:electron` | Build main/preload, start Vite, and launch desktop development |
| `pnpm typecheck` | Check renderer and Node/main TypeScript projects |
| `pnpm build:renderer` | Build renderer only |
| `pnpm build:electron` | Build Electron bundles and prepare PTY helper |
| `pnpm build` | Typecheck and build both targets |
| `pnpm preview` | Serve built renderer on port 4173 |
| `pnpm start` | Launch built Electron app |
| `pnpm test` | Run Vitest unit/policy/storage suites |

### Trusted launch environment

These variables are read by the application/tooling, not accepted as renderer execution options. POSIX examples use `NAME=value pnpm …`; PowerShell users should set `$env:NAME` before launching.

| Variable | Use |
| --- | --- |
| `THESEUS_CODEX_PATH` | Absolute Codex executable override when PATH discovery fails |
| `THESEUS_AGENT_TIMEOUT_MS` | Trusted launch ceiling from 1,000–1,800,000 ms; invalid values use the 30-minute default |
| `THESEUS_USER_DATA_DIR` | Alternate Electron profile, useful for isolated testing; does not copy credentials |
| `THESEUS_SAMPLE_PREVIEW=1` | Start with sample profiles/graph visible |
| `THESEUS_DEV_URL` | Internal development renderer URL supplied by the dev launcher |
| `CHROME_PATH` | Chrome executable override for browser smoke verification |

For example, use an isolated app-data directory while retaining the normal installed Codex runtime:

```sh
THESEUS_USER_DATA_DIR=/absolute/path/to/disposable-profile pnpm start
```

## Verification

For a documentation change, check links, examples, script names, and feature claims against the source. For application changes, the baseline is:

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm test:smoke
```

Build before Electron integration suites. `test:smoke` and `test:contrast` need installed Google Chrome; `test:smoke` also needs a free port 4173, while `test:contrast` uses an ephemeral port. Set `CHROME_PATH` for a nonstandard Chrome location. Suites use disposable profiles/projects; reports/screenshots go to ignored `artifacts/verification/`.

### Feature suites

These suites use local synthetic runtimes, stubbed service/native responses where needed, or local servers rather than provider tasks. Real Electron, filesystem, Git, PTY, and UI paths are exercised as appropriate; fixtures do not prove external account/service access.

| Command | Coverage |
| --- | --- |
| `pnpm test:smoke` | Browser/desktop screens, bridge isolation, navigation, demo interactions |
| `pnpm test:contrast` | Rendered small-text contrast on populated Home, Agents, Routines, and dialogs; normal, hover, and keyboard focus states |
| `pnpm test:crew` | Routing, sequential handoffs, prerequisites, crew lifecycle |
| `pnpm test:concurrency` | Slots, queue, checkout ownership, concurrent worktrees, cancellation |
| `pnpm test:continuation` | Saved-thread follow-up, restart, missing-thread behavior |
| `pnpm test:history` | Deletion, retention, physical persistence, rerun review |
| `pnpm test:profile-lifecycle` | Archive/restore/delete and historical profile isolation |
| `pnpm test:github-agents` | Public instruction discovery/preview/import with GitHub fixtures |
| `pnpm test:launchers` | Launcher CRUD, validation, persistence, injected Terminal handoff |
| `pnpm test:composer-context` | Explicit reviewed files, agent/file resolution, workflows, stale context |
| `pnpm test:memory-workflows` | Extraction, graph portability/conflicts, duplicates, bulk deletion, sync |
| `pnpm test:settings-memory` | Saved/demo memory settings behavior |
| `pnpm test:samples` | Sample preview, storage/context isolation |
| `pnpm test:library` | Native imports, scoped search, file lifecycle, import persistence |
| `pnpm test:resources` | Saved-record Library and external Browser |
| `pnpm test:browser` | Embedded navigation/history, extracts, grants, per-run browser tools |
| `pnpm test:research` | Sources/artifacts, edits, citations, native export, deletion/restart |
| `pnpm test:routines` | Real runner integration for schedule/event attempts, consent, faults, Stop all |
| `pnpm test:terminal` | Noninteractive commands, output, cancellation, shutdown |
| `pnpm test:project-tools` | Session/worktree PTYs, local preview, panels/overlays, teardown |
| `pnpm test:project-platform` | Native PTY input/resize/Ctrl+C/job cleanup and local HTTP preview |
| `pnpm test:worktrees` | Creation, ownership, cleanup guards, storage |
| `pnpm test:git` | Local Git data, fixture reviews/fixes, guarded merge requests |
| `pnpm test:connections` | Fixture account/usage/OAuth/MCP lifecycle and task propagation |
| `pnpm test:safety` | Live policy, Stop all, unsupported requests, damaged-store refusal |
| `pnpm test:desktop` | Tray/settings/notification dispatch and update-page handoff |
| `pnpm test:desktop-zoom` | Native Electron 125%/150%/200% zoom at minimum/default windows, keyboard actions, compact panels, scrolling, and dialogs; no provider tasks |
| `pnpm test:topbar` | Bell, local profile, navigation, persistence |
| `pnpm test:notifications` | Notification preference behavior |

Additional focused checks are available directly:

```sh
node tests/research-drafts-electron.mjs
node tests/research-concurrency-electron.mjs
node tests/keyboard-electron.mjs
node tests/preferences-electron.mjs
node tests/memory-workflows-security.mjs
```

**Provider-backed suites must be run deliberately:** `pnpm test:agent`, `pnpm test:profiles`, and `pnpm test:memory` use installed/authenticated Codex and can consume account usage. They cover real execution/cancellation/recovery, an advertised model with saved profile instructions, and explicit memory delivery respectively.

Most full-app verification is macOS-focused. The [native CI workflow](.github/workflows/project-tools-native.yml) covers actual Windows/Linux PTYs and local preview plus research storage/export unit regressions. This is not a claim of full-app acceptance on every OS. Real OAuth/provider access, signed notifications/login registration, and packaging require separate target-environment verification. [Routine verification notes](docs/verification/issue-17-routines.md) document its specific evidence and limits.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| Live/desktop action is unavailable | Use `pnpm dev:electron` or build/start; `pnpm dev` is renderer-only |
| Port 5173 or 4173 is occupied | Stop the other development/preview process; ports are strict |
| Electron still uses old main-process behavior | Restart after changing `electron/` or `shared/`; rebuild before `pnpm start` |
| Codex is missing | Run `codex --version` in a terminal, check absolute PATH entries, or launch with `THESEUS_CODEX_PATH` |
| Authentication/model discovery fails | Check runtime/account status; sign in, retry runtime discovery, or use Runtime default |
| A project is unavailable | Select it again with the native picker; Theseus never falls back to another folder |
| A task stays Queued | Check slot use, another task using the same checkout, or an unfinished crew prerequisite |
| Codex cannot use the network or request approval | Inspect the enforced adapter policy; sandbox shell network and escalation are disabled |
| File attachment is stale/rejected | Refresh/import, inspect the current file again, and explicitly include it within context limits |
| Library is missing a file | Check supported UTF-8 type, hidden/excluded paths, symlinks, size/import limits, then Refresh index |
| Follow-up cannot resume | Check saved runtime thread availability, execution folder, and CLI compatibility; use reviewed rerun for a new task |
| Worktree cleanup keeps a merged branch | Check local ancestry, changes/ignored files, locks, selection, and terminal ownership; squash equivalence is not inferred |
| Preview is blank or assets fail | Verify the server URL/output and selected origin; external/CDN assets and cross-origin HMR are blocked |
| Interactive terminal fails to start | Reinstall/build native dependencies and the PTY helper; use the native host requirements above |
| PR controls fail while local Git works | Check `gh auth status`, the checkout's real PR, repository merge policy, and remote head/checks |
| Routine did not run | Check enabled/paused state, UTC trigger, app awake/open state, exact saved-agent revision, capacity, and execution history |
| Notifications or login items are unavailable | Check OS support/permissions and installed/signed package requirements; source launches do not support every desktop feature |
| A store reports corruption/unwritable data | Preserve the reported file, quit, repair storage/permissions, then restart; do not delete all app data as a first step |
| Samples appear instead of saved records | Choose Show saved data; sample fixtures never replace real records |

After an abrupt crash, review output, project changes, and potentially surviving processes before submitting new work. For routine storage recovery, use **Resume scheduling** explicitly after repair. For a damaged profile, memory, history, or integration store, follow the feature warning rather than assuming a reset repaired it.

## Current limitations

- Codex is the only integrated runtime. External launchers are separate macOS Terminal handoffs.
- Crews are sequential; automatic routing is deterministic. Multi-step crews require a shared selected project folder.
- Live approvals are noninteractive (`never`). Ask-first action rules, command allowlists, per-step limits, and spending budgets are unavailable.
- PR creation, automatic commit/push, and general live Git conversation fork/merge are not implemented. Demo conversation forks do not change Git.
- Research artifacts are local result transformations with explicit Markdown export; remote publication and independent source verification are unavailable.
- Memory uses reviewed local facts/rules and manual portable-file sync. Automatic learning, model extraction, remote embeddings, Graphiti, encrypted storage, and background cloud sync are unavailable.
- Routines need the app open and awake; there is no external webhook trigger, detached service, missed-run replay, or automatic retry.
- Browser tools support reading and same-origin navigation rather than arbitrary scripts/forms/general automation. Preview requires a same-origin local app.
- Dictation, delivered morning briefs, some labeled demo preferences, mobile layouts, full-app encrypted backup, signed installers, and automatic update installation remain future work.
