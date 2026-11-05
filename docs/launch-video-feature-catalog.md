# Theseus — Extensive Feature Catalog for the Launch Video

**Product:** Theseus desktop  
**Catalog date:** October 29, 2026  
**Implementation reference:** `a73893a` — Home panel crew, routine, and artifact actions  
**Purpose:** A detailed inventory for writing the launch script, selecting demonstrations, recording footage, and planning feature callouts.

This catalog describes the current application, including the latest Home right-panel improvements. It combines user-facing features, supporting capabilities, demonstration surfaces, and practical limits. Suggested voiceover and shot ideas are creative proposals; they are not additional product capabilities.

## How to use this document

- Start with the product overview and launch highlights to choose the video's main message.
- Use the detailed feature inventory to find specific interactions worth recording.
- Use the workflow demonstrations to build sequences with a beginning, an action, and a visible result.
- Check the implementation notes before presenting a feature as live functionality.
- Use the filming checklist and source map when preparing the recording environment.

### Status labels

| Label | Meaning for the video |
| --- | --- |
| **Live** | Implemented functionality in the Electron desktop application. Some features require a configured runtime, selected project, or external account. |
| **Local** | Implemented functionality performed on the user's machine or stored in application data. This does not mean that Codex inference runs locally. |
| **Demo** | Simulated or fictional content intended to preview the experience. Keep its demo labeling visible. |
| **Conditional** | Implemented, but dependent on the operating system, packaging, credentials, installed tools, or provider capabilities. |

## Contents

- [1. Product overview](#1-product-overview)
- [2. Launch highlights at a glance](#2-launch-highlights-at-a-glance)
- [3. Desktop workspace and navigation](#3-desktop-workspace-and-navigation)
- [4. Home and task preparation](#4-home-and-task-preparation)
- [5. Home right panel: Overview](#5-home-right-panel-overview)
- [6. Home right panel: Crew](#6-home-right-panel-crew)
- [7. Home right panel: Routines](#7-home-right-panel-routines)
- [8. Home right panel: Artifacts](#8-home-right-panel-artifacts)
- [9. Home right panel: Memory](#9-home-right-panel-memory)
- [10. Live Codex execution](#10-live-codex-execution)
- [11. Agents, profiles, and configuration](#11-agents-profiles-and-configuration)
- [12. Crews and role-based workflows](#12-crews-and-role-based-workflows)
- [13. Concurrency and queue management](#13-concurrency-and-queue-management)
- [14. Explicit task context and built-in workflows](#14-explicit-task-context-and-built-in-workflows)
- [15. Sessions, layouts, and conversation controls](#15-sessions-layouts-and-conversation-controls)
- [16. Run history, follow-ups, and recovery](#16-run-history-follow-ups-and-recovery)
- [17. Managed Git worktrees](#17-managed-git-worktrees)
- [18. Git changes, code review, and PR workflows](#18-git-changes-code-review-and-pr-workflows)
- [19. Interactive project terminal](#19-interactive-project-terminal)
- [20. Noninteractive command runner](#20-noninteractive-command-runner)
- [21. Local application preview](#21-local-application-preview)
- [22. Browser, saved links, and page context](#22-browser-saved-links-and-page-context)
- [23. Research sources, citations, and artifacts](#23-research-sources-citations-and-artifacts)
- [24. Memory knowledge graph](#24-memory-knowledge-graph)
- [25. Memory portability and manual sync](#25-memory-portability-and-manual-sync)
- [26. Persistent routines and automation](#26-persistent-routines-and-automation)
- [27. Library and project-file search](#27-library-and-project-file-search)
- [28. Accounts, models, usage, and integrations](#28-accounts-models-usage-and-integrations)
- [29. Public GitHub agent imports and external launchers](#29-public-github-agent-imports-and-external-launchers)
- [30. Notifications, focus, and local profile](#30-notifications-focus-and-local-profile)
- [31. Settings, keyboard shortcuts, and desktop lifecycle](#31-settings-keyboard-shortcuts-and-desktop-lifecycle)
- [32. Execution controls, storage, and privacy features](#32-execution-controls-storage-and-privacy-features)
- [33. Demo and sample experiences](#33-demo-and-sample-experiences)
- [34. Practical limits reference](#34-practical-limits-reference)
- [35. Suggested workflow demonstrations](#35-suggested-workflow-demonstrations)
- [36. Possible launch-video structures](#36-possible-launch-video-structures)
- [37. Script wording grounded in current features](#37-script-wording-grounded-in-current-features)
- [38. Recording preparation](#38-recording-preparation)
- [39. Current feature boundaries in one place](#39-current-feature-boundaries-in-one-place)
- [40. Source map for checking and updating this catalog](#40-source-map-for-checking-and-updating-this-catalog)

---

## 1. Product overview

Theseus is a desktop workspace for running Codex agents against local projects. It brings task preparation, conversations, reusable agent configurations, sequential crews, terminal access, local app previews, Git review, research artifacts, explicit memory, and routines into one application.

The main product loop is:

1. Choose a project.
2. Describe the work.
3. Select an agent or crew.
4. Review the context and execution configuration.
5. Start the task.
6. Follow its output and inspect the result.
7. Review changes, continue the conversation, export a deliverable, or save useful context for later.

### Principal user benefits

- Keep agent work and project tools together.
- Reuse a configuration instead of rewriting the same instructions for every task.
- Hand implementation to a reviewer through a visible sequential workflow.
- Inspect what changed alongside the conversation.
- Run separate tasks in separate Git worktrees.
- Keep a history of work and resume supported conversations.
- Choose which files, memories, and page extracts become task context.
- Turn saved research results into editable, cited Markdown artifacts.
- Schedule repeatable work with a saved agent and project.
- Manage agents, routines, and artifacts directly from Home's right panel.

### Suggested opening line

> “Meet Theseus: one desktop workspace for your agents, projects, and the work they produce.”

### Suggested positioning line

> “Choose a project, give your agents a task, and keep the conversation, changes, tools, and results in view.”

---

## 2. Launch highlights at a glance

| Feature | What to show | Why it matters | Status |
| --- | --- | --- | --- |
| Project-aware task composer | Choose a folder, write a task, review configuration | Connects a request to a real working project | Live |
| Saved agents | Select or edit an agent's instructions and settings | Makes recurring working styles reusable | Live / Local |
| Build → Review | Show Forge followed by Sentinel | Makes implementation and review separate visible steps | Live |
| Research → Write | Show Scout followed by Quill | Turns gathered evidence into a writing handoff | Live |
| Home Overview | Status, latest activity, checkout changes, checks, next action | Gives the right panel a practical purpose | Live |
| Home Crew | Search, create/edit, inspect configuration, open recent runs | Reduces navigation while preparing work | Live |
| Home Routines | Edit, enable, Run now, inspect recent results | Makes repeatable work accessible from Home | Live |
| Home Artifacts | Search, preview, create, edit, export | Makes saved deliverables easy to find | Live |
| Git review and fixes | Real diff, findings, Fix, checks | Connects an agent's work to reviewable code | Live / Conditional |
| Managed worktrees | Select New Git worktree and inspect its execution path | Separates task changes from the source checkout | Live |
| Interactive terminal | Run a command and interact with a real shell | Keeps project execution close to agent work | Live |
| Local app preview | Start a server, discover a URL, inspect the running app | Shows the result in the workspace | Live |
| Memory graph | Add a fact and relationship, drag/zoom, inspect history | Gives saved context a visible structure | Live / Local |
| Reviewed task context | Inspect a file, select memory, choose page extracts | Makes context inclusion explicit | Live |
| Research artifacts | Create a draft, outline, or comparison and export Markdown | Turns conversation results into a deliverable | Live / Local |
| Persistent routines | Define a scheduled or event-triggered task | Reuses a reviewed agent/project/task combination | Live |
| Session layouts | Switch Focus, Split, Grid | Supports different ways of monitoring work | Live UI; demo and live content differ |
| MCP connections | Configure and check an external service | Extends tools available to new Codex tasks | Conditional |
| History and continuation | Open a saved run and send a follow-up | Keeps work accessible across sessions | Live / Conditional |

---

## 3. Desktop workspace and navigation

### Main workspace

- Native Electron desktop application.
- Dark desktop interface with Theseus branding.
- Custom title bar with window controls.
- Persistent navigation rail for the main product areas.
- Home screen for preparing work.
- Session sidebar for navigating conversations and runs.
- Top session tabs for switching between open work.
- Center workspace for conversations and pages.
- Right inspector for run tools and contextual information.
- Bottom status bar with application mode and workspace information.
- Desktop layout designed around 1440 × 900, with a minimum supported window of 1100 × 700.

### Navigation destinations

- Home.
- Agents.
- Memory.
- Routines.
- Library.
- Browser.
- Terminal.
- Run history.
- Settings.
- Local profile.

### Session organization

- Sessions grouped into Needs you, Working, Paused, and Finished.
- Status indicators next to session names.
- Agent identity and project information in session rows.
- Task titles and recent activity previews.
- Live-run labeling distinct from samples.
- Open-session tabs with individual close controls.
- Closing a tab changes navigation; cancelling execution is a separate action.
- A New control for preparing another task.
- All, Code, and Research selectors in the title bar.
- Current live run entries use the Code classification in the shared session list; sample projects also populate the Code and Research spaces.

### Search

- Session search covers task/session titles, projects, agent names, recorded source names/URLs, and recorded file paths. It does not search arbitrary full conversation text.
- Results can include a matching excerpt or category.
- Search scope is explained in the UI.
- Session search does not substitute for Library's project-file content search.
- Settings has its own cross-section search.
- Agents, routines, artifacts, memory, history, and Library provide feature-specific discovery controls.

### Command palette

- Open with Cmd/Ctrl+K.
- Search for existing sessions.
- Open a matching session.
- Describe a task and prepare it in the composer.
- Choose Live or Demo task mode.
- Review the task before starting execution.

**Video angle:** A quick workspace tour can establish that the product contains both agent conversations and the tools needed to inspect their work.

---

## 4. Home and task preparation

### Task composer

- Describe a task in a multiline text field.
- Start from an empty request or a template.
- Choose Codex · Live or Demo crew.
- Select a real project through a native folder picker.
- See the selected project name and path.
- Use Codex defaults or a saved agent configuration.
- Choose single-agent execution or a crew route.
- Review the effective configuration before starting.
- Select the run location: chosen project or new Git worktree.
- Include reviewed files.
- Select eligible saved memories.
- Review selected page context.
- Add supported built-in prompt workflows.
- Save a fact from the user-authored task through Remember this.
- Prepare a task without executing it immediately.
- Preserve the Home draft while choosing agents or moving through supported panel actions.

### Crew templates

- Ready-made task entry points on Home.
- Templates prepare a task and route for review.
- Coding templates can select a Build → Review sequence.
- Research templates can select a Research → Write sequence.
- Single-role templates can target a specific crew role.
- Starting remains a separate user action.

### Home activity surfaces

- Activity tiles can include live and demo sessions.
- Tiles provide a way to open work in the main conversation.
- Watch all in grid switches to the Grid layout.
- Needs you cards demonstrate approval, question, error, and review states.
- The current Needs you dashboard is labeled Demo; it should not be presented as a general live approval inbox.
- The morning brief and learned-this-week examples are also demo content.

**Suggested voiceover:** “Start with the project, the task, and the context you want your agent to use.”

---

## 5. Home right panel: Overview

**Status: Live, with separately labeled sample support.**

### Run selection

- Overview is the default Home right-panel tab.
- Choose an active or recent live run from a session picker.
- Identify the project, task, and run status from the selection.
- Open the chosen session directly.
- When no live runs exist, an empty state explains what will appear after starting a task.
- Write a task focuses the Home composer without starting a run.
- In sample-preview mode, the panel can display sample sessions when no live run is available.

### Run summary

- Current execution status.
- An explanation of that status.
- Project and available branch information.
- Latest meaningful activity from saved run events.
- Run error or persistence error when available.
- Structured review summary for supported completed Git review/fix output.

### Checkout changes

- Current changed paths in the run's checkout.
- A compact list of paths and Git status markers.
- A count of changed paths.
- A link to the full Git changes view.
- Refresh control for retrieving a new snapshot.
- Snapshot refresh time.
- Explicit wording that checkout changes can include edits made before the run.

### GitHub checks

- Available PR checks from the actual checkout's GitHub state.
- Separate counts for passing, failing, pending, and skipped/neutral checks.
- Individual check names and status/conclusion values.
- Failing checks shown ahead of the others.
- A direct link to the Checks view.
- Clear unavailable/no-check states.
- An explanation when GitHub results could not be retrieved.
- Local command output remains in the conversation rather than being presented as independently verified test results.

### Next action

- Inspect errors in Run details.
- Open failing GitHub checks.
- Review structured findings.
- Review Git changes.
- Open research/artifacts for an applicable completed research role.
- Open run details when no more specific action applies.
- Links move to the correct run and detail view.
- Home drafts remain available when returning from those actions.

**Video angle:** Return to Home after a task finishes, then move from the result summary directly to its diff or failing check.

---

## 6. Home right panel: Crew

**Status: Live / Local, with separate fictional sample profiles.**

### Find and choose agents

- Browse active saved configurations.
- Search agent names and descriptions.
- View an agent's name, description, icon, and color.
- See which saved agent is selected.
- Select an agent for the Home composer.
- Preserve the task draft and existing project while selecting an agent.
- See selection-in-progress and selection-failure states.
- Open the full Agents management page through Manage.

### Create and edit in place

- New agent opens the actual saved-agent editor from Home.
- Configure and save a new agent without navigating to the full Agents page.
- Expand Configuration & activity for a saved agent.
- Inspect the model or Runtime default.
- Inspect file permissions.
- Inspect the run time limit.
- Inspect the memory policy.
- Expand saved instructions.
- Edit agent opens the same real configuration editor used by Agents.
- Saved changes appear in the panel.
- Unsaved editor changes use the existing discard protection.

### Recent activity

- Inspect up to three recent runs made with that saved profile.
- See run task text and status.
- Identify active work with a live label.
- Open a recent run directly.
- See a useful empty state for agents without runs.

### Prepare a crew task

- Build → Review prepares the corresponding route in the composer.
- Research → Write prepares the corresponding route.
- These actions configure a task; they do not silently start execution.
- Sample agents remain preview-only and do not enter executable profile selectors.

**Suggested voiceover:** “Keep your reusable agents close: inspect how they work, update their instructions, and prepare the right crew from Home.”

---

## 7. Home right panel: Routines

**Status: Live; desktop execution required.**

### Browse and inspect

- List saved routines.
- Search by routine name, saved agent, or task text.
- Inspect trigger descriptions.
- See enabled, disabled, paused, next-run, or waiting-for-event states.
- See upcoming execution in local time.
- Expand Task & recent results.
- Inspect the actual saved task.
- Inspect the agent, sandbox, and project path.
- See up to three recent attempts for the routine.
- Read attempt status, timestamp, and available diagnostics.
- Open the actual run result when it remains in history.

### Operate routines from Home

- New routine opens the real routine editor.
- Create a task/project/agent/trigger configuration without leaving Home.
- Edit an existing routine.
- Disable an enabled routine.
- Enable a routine after the existing explicit task/project/permissions confirmation.
- Cancel the enable confirmation without changing the routine.
- Run now starts an enabled routine through the actual scheduler.
- Run now is disabled when the routine is disabled, scheduling is paused, or an execution is already active.
- Resume scheduling is available when the scheduler is paused and storage permits it.
- Manage opens the full Routines page.
- Task drafts remain intact while working with the panel.

**Video angle:** Set up a recurring review, enable it after inspecting the task, use Run now, and open the resulting output.

---

## 8. Home right panel: Artifacts

**Status: Live / Local.**

### Saved artifact shelf

- A dedicated Artifacts tab on the Home right panel.
- Lists real saved research artifacts belonging to retained live runs.
- Includes Draft, Outline, and Comparison artifact types.
- Identifies each artifact's originating task and project.
- Shows a saved date and citation count.
- Provides a short content preview in the list.
- Search by originating task, project, or preview text.
- Filter by artifact type.
- Load additional results in batches when the list is long.
- Refresh the list.
- Display storage/read warnings while preserving existing records.
- Handle empty lists and searches with no matches.

### Preview and reuse

- Open an artifact's saved Markdown in a plain-text preview.
- See its saved timestamp and character count.
- Return to All artifacts.
- Refresh a selected artifact as well as the list.
- Edit in session opens the originating run's Research inspector.
- The correct draft, outline, or comparison is selected automatically.
- Editing and exporting are blocked while that run is active.

### Create and export

- Create from a run opens a creation form.
- Choose a successfully completed run with saved assistant results.
- Choose Draft, Outline, or Comparison.
- Create a local artifact using the existing result transformation.
- Existing artifacts are not silently replaced by the creation form.
- Export Markdown opens a native destination picker.
- Review the chosen destination.
- Confirm export of the saved artifact.
- Existing export safeguards and source provenance are retained.
- Cancellation and successful export are reported in the panel.

**Suggested voiceover:** “The work doesn't end in a transcript. Find the draft, open the comparison, or export a saved result.”

---

## 9. Home right panel: Memory

**Status: Live / Local, with separate sample data.**

- Browse current saved facts and relationships.
- Scope the panel to personal and relevant project memory.
- Expand individual records to inspect their full meaning.
- See whether a record is personal or project-scoped.
- Inspect its node type or relationship classification.
- Inspect source information and update time.
- Open the full Memory management surface.
- Switch between saved and sample data.
- See loading, empty, and storage-error states.
- The panel explains that saved memory is not automatically included in a task.

**Video angle:** Inspect a saved preference, then explicitly select it in the composer before starting a task.

---

## 10. Live Codex execution

### Starting work

- Run against a project selected through a native picker.
- Use an intentionally chosen non-Git project in direct-folder mode.
- Apply a saved agent or runtime defaults.
- Validate the selected configuration before starting.
- Snapshot reviewed instructions and settings for the run.
- Execute the task through the installed Codex CLI.
- Connect execution to the selected project or managed worktree.

### Visible execution lifecycle

- Queued.
- Starting.
- Running.
- Cancelling.
- Completed.
- Failed.
- Cancelled.
- Interrupted.

### Run output

- User task and system status messages.
- Assistant messages.
- Command-start events.
- Command results and exit information exposed by the runtime.
- File-change events.
- Error events.
- Collapsible tool-output cards.
- Live output following while the user is near the bottom.
- Manual scrolling without being continually pulled back to the latest output.
- Disclosed output trimming when retention limits are reached.

### Run controls

- Cancel an individual run.
- Inspect execution state and diagnostics.
- Start another task after a turn finishes.
- Continue a supported saved thread.
- Stop all application-owned execution.
- Enforce a whole-run duration limit.

### What successful completion means

Completed means the Codex turn completed and exited successfully. It does not independently establish that the task is correct, that every test passed, or that every requested change was made. Use the diff, checks, and review output as evidence in the video.

---

## 11. Agents, profiles, and configuration

### Saved agent identity

- Agent name.
- Description.
- Icon.
- Color.
- Custom instructions.
- Optional default project folder selected natively.
- A reusable Codex runtime configuration.

### Runtime configuration

- Model selection from the installed runtime's advertised catalog.
- Reasoning effort when the chosen model advertises it.
- Runtime default when a specific override is not selected.
- Read-only or workspace-write file access.
- Per-profile run duration limit.
- Memory eligibility policy.
- Runtime version and authentication checks.
- A visible effective configuration before execution.

### Memory policies

- No memory.
- Selected project memory.
- Selected personal and project memory.
- Policies define what may be selected; they do not automatically select context.

### Profile management

- Create.
- Edit.
- Duplicate into an independent configuration.
- Archive.
- Filter Active and Archived profiles.
- Restore archived profiles.
- Confirmed permanent deletion.
- Prevent deletion while that agent owns active runs.
- Fall back to Codex defaults when the selected profile becomes unavailable.
- Preserve the task and chosen project during selection/fallback.
- Preserve the original configuration snapshot in historical runs.
- Reject stale edits that would overwrite a newer saved version.
- Warn before discarding an unsaved editor draft.
- Expand the instructions editor for longer instruction sets.

### Runtime discovery

- Check the installed executable version.
- Check runtime authentication.
- Discover supported model and reasoning choices.
- Cache capability results for five minutes.
- Check configuration without starting an agent task.
- Explain unavailable runtime/model discovery instead of presenting invented choices.

**Video angle:** Build two visibly different saved configurations—for example, a read-only reviewer and a project-writing builder—then choose between them.

---

## 12. Crews and role-based workflows

### Available roles

| Role | Name | Main purpose | Effective file access |
| --- | --- | --- | --- |
| Planner | Orbit | Inspect the task and propose a plan | Read-only |
| Builder | Forge | Implement and verify changes | Selected profile's permitted sandbox |
| Reviewer | Sentinel | Inspect changes and report findings | Read-only |
| Researcher | Scout | Gather and compare available evidence | Read-only |
| Writer | Quill | Produce written work from available evidence | Selected profile's permitted sandbox |

### Routing options

- A single saved agent.
- An explicit individual crew role.
- Build → Review: Forge, then Sentinel.
- Research → Write: Scout, then Quill.
- Theseus automatic routing based on task words.
- A visible plan before submission.
- Saved profile assignment per role.
- Codex defaults for roles without a saved profile assignment.

### Sequential handoffs

- Crew steps run in order.
- Each step is a separate persisted run.
- Steps share a crew identity and dependency information.
- Successor steps wait for predecessor success.
- A successor receives a bounded handoff of predecessor final messages.
- Shared-folder execution lets later steps inspect earlier file changes.
- Crew step controls let the user inspect each run.
- Failure, cancellation, or interruption prevents dependent work from starting.
- An unfinished crew blocks follow-up submission until its steps end.

### Automatic routing behavior

- Review/audit language routes to Sentinel.
- Research/investigate/compare language routes to Scout → Quill.
- Write/draft/rewrite language routes to Quill.
- Plan/design language routes to Orbit.
- Other requests route to Forge → Sentinel.
- This routing is deterministic; it is not a separate autonomous planning service.

**Suggested voiceover:** “Let one role build and another review, or hand research to a writer with the results already attached.”

**Scope:** Current crews are sequential predefined routes. Do not depict an arbitrary visual workflow builder or simultaneous steps inside one crew.

---

## 13. Concurrency and queue management

- Configure one to eight live Codex slots.
- See occupied slots and queued work in the title bar.
- Queue eligible work when capacity is full.
- Choose an overflow policy that asks before queueing manual work near capacity.
- Prevent concurrent tasks from sharing the same canonical checkout.
- Run separate tasks concurrently in separate managed worktrees.
- Skip occupied checkouts when admitting other eligible queued tasks.
- Keep dependency-waiting steps out of active slot usage.
- Keep queued configuration and context snapshots stable.
- Cancel work before it starts.
- Apply increased capacity to eligible pending work.
- Allow existing work to finish when capacity is reduced.
- Start a run's execution time limit when execution begins, rather than when it is queued.
- Protect queued/active runs from history deletion.
- Recover an unfinished queue as Interrupted after restart, without automatically starting it.

**Video angle:** Show a small number of real parallel tasks in distinct worktrees, with the slot/queue indicator visible.

---

## 14. Explicit task context and built-in workflows

### Reviewed project files

- Import supported project files or folders into Library.
- Browse and search the selected project's indexed files.
- Inspect a plain-text preview.
- Explicitly include the reviewed file in the next task.
- Remove a file from the selected task context.
- Include up to five files within the documented size limits.
- Validate that files still exist, belong to the chosen project, and match the reviewed hash.
- Require a new review when content changes or a review expires.
- Preserve the reviewed bytes when a task is queued.
- Record attachment references, hashes, and review times in run metadata.

### Agent and file mentions

- Mention agent or file opens a real chooser.
- Select a saved agent's actual configuration.
- Choose and review an indexed file.
- Typing `@`, `/`, or `$` can open the corresponding chooser.
- Unresolved mention text remains ordinary task text.

### Built-in commands and skills

| Token | Visible label | Behavior |
| --- | --- | --- |
| `/review` | Review changes | Ask Codex to inspect changes and report findings before editing |
| `/explain` | Explain code | Ask Codex to trace code and explain its behavior |
| `$plan` | Plan a task | Use a fixed planning workflow to inspect, identify constraints, and propose steps |
| `$test` | Verify behavior | Identify and run relevant local verification checks |

- Preview each workflow's description before adding it.
- Choose at most one command and one built-in skill.
- Remove selected workflows before starting.
- Main validates workflow identifiers.
- These are prompt workflows, not direct shell invocations or discovery of installed Codex skills.

### Other context sources

- Explicitly selected saved memories.
- Explicitly selected extracted web pages.
- Crew predecessor handoffs.
- Current project access permitted by the agent's sandbox.

**Video angle:** Show context selection as a deliberate preparation step: inspect a file, select a preference, and choose a workflow before Start.

---

## 15. Sessions, layouts, and conversation controls

### Focus

- One primary conversation.
- Right inspector alongside the conversation.
- Appropriate for following a task and inspecting its result.
- Session inspectors can be hidden/restored where the UI exposes those controls.

### Split

- Two conversation panes side by side.
- Switch through open sessions.
- Useful for visually comparing two tasks or a build/review pair.
- The full right inspector is hidden in this layout.

### Grid

- Multiple session tiles in one workspace.
- See active status and recent output.
- Open a tile into a full conversation.
- Live tiles provide an entry into actual saved output.
- Demo tiles include simulated quick replies; those controls should not be presented as live run controls.
- Add another session from the grid.

### Layout interaction

- Focus, Split, and Grid choices in a layout menu.
- Keyboard shortcuts for each layout.
- Choose a default layout in Settings.
- Switch layouts during work.

### Live session inspectors

- Overview.
- Git changes.
- Research.
- Terminal.
- Preview.
- Run details.
- Per-run inspector view state while the application is open.
- Direct navigation from Home actions into a matching inspector/subview.

### Live run details

- Status.
- Project and source folder.
- Execution folder/worktree when applicable.
- Start and end timestamps.
- Exit code and signal when available.
- Saved agent name and version.
- Model and reasoning configuration.
- Effective sandbox.
- Effective time limit.
- Runtime version when known.
- Saved instructions snapshot.
- Selected memory references.
- Execution policy information.
- Run/persistence diagnostics.

---

## 16. Run history, follow-ups, and recovery

### History browsing

- Persist live run records across restarts.
- Search by task, project/path, and status.
- Open a saved run's output.
- Inspect configuration snapshots and diagnostics.
- Finished live runs also remain reachable through the session list.
- Keep demo conversations separate from saved live history.

### Continue a conversation

- Send a follow-up to the exact runtime-issued saved thread when available.
- Keep the execution folder or worktree.
- Keep the saved agent configuration.
- Keep earlier output in the same run record.
- Continue eligible completed, cancelled, or failed work.
- Explicitly continue an interrupted run after inspection when a thread is available.
- Show why continuation is unavailable when a thread, folder, or compatible runtime session is missing.
- Prevent overlapping turns or continuation during an unfinished crew.
- Reapply current capacity and execution policy checks.

### Review rerun

- Prepare a new task using an earlier run's task/project.
- Review current saved agent settings.
- Select current context again.
- Start only after the user reviews the draft.
- Fall back visibly if the earlier saved profile is unavailable.
- Keep reruns distinct from continuing the old conversation.

### Retention and deletion

- Keep history forever by default.
- Choose 30, 90, or 365 days instead.
- Review confirmation when shortening retention.
- Delete selected finished records.
- Delete all finished runs, including those hidden by search.
- Protect active runs and active crew dependencies.
- Report partial deletion failures.
- Remove associated research records when a run is deleted or expires.
- Preserve project files and separately saved memory.

### Recovery

- Mark unfinished persisted work Interrupted at startup.
- Explain never-started versus completion-unknown work.
- Preserve healthy records when another record is corrupt.
- Avoid silently restarting an agent after a crash.
- Keep storage failures visible.

**Suggested voiceover:** “Your work stays accessible. Return to the run, inspect its original configuration, and continue the conversation when the runtime supports it.”

---

## 17. Managed Git worktrees

- Create a separate worktree for a task.
- Start from committed HEAD of the selected repository root.
- Create a task-specific `theseus/<run ID>` branch.
- Keep uncommitted source changes in the original checkout.
- Record source and execution paths separately.
- Target the correct execution folder from session terminal, preview, and Git tools.
- Configure the storage location.
- Use the default `~/.theseus/worktrees` location or a chosen absolute/expanded-home path.
- Select an existing managed worktree as the current project.
- Persist ownership information across restarts and history deletion.
- Manually clean up eligible merged worktrees.
- Optionally enable periodic cleanup.
- Protect worktrees with active runs, terminals, local/ignored changes, changed branches, or locks.
- Avoid forced removal.
- Keep branches rather than automatically deleting them.

**Scope:** Multi-step crews currently use a shared selected project folder. Worktree cleanup uses local ancestry and does not infer squash/cherry-pick equivalence.

**Video angle:** Show a normal project task and an isolated worktree task, then open the latter's terminal to make the separate working directory visible.

---

## 18. Git changes, code review, and PR workflows

### Repository inspection

- Inspect the run's actual execution checkout.
- Current branch and head information.
- Working-tree status.
- Staged changes.
- Unstaged changes.
- Untracked file previews within limits.
- Latest 20 local commits.
- Comparison with the local upstream reference when available.
- Actual branch PR information when GitHub CLI can resolve it.
- PR diff.
- GitHub check names and conclusions.
- GitHub review decision.
- Manual refresh and refresh on application refocus.

### Agent review

- Ask Sentinel to review starts a real Codex review.
- Review uses read-only file access.
- Findings can include severity, title, file/path, and explanation.
- Findings and review summary remain linked to their run.
- Open the corresponding review output.
- Invalid or incomplete structured output is not treated as a verified finding set.

### Agent fixes

- Fix an individual finding.
- Have Forge fix all supported findings.
- Run a workspace-writing fix task against the same checkout.
- Include selected findings and verification instructions.
- Inspect the actual fix run output.
- Do not mark findings resolved merely because a fix started or exited without valid review data.

### GitHub PR actions

- Open the actual GitHub PR in the external browser.
- Inspect PR state, head/base branches, mergeability, and review/check state.
- Merge PR through a native confirmation.
- Recheck the head SHA and readiness around confirmation.
- Require the expected remote head during the merge request.
- Distinguish cancelled, blocked, pending, and confirmed-merged results.
- Respect branch protection without an admin bypass.

**Dependencies:** Local Git is required for repository features. PR operations additionally require installed/authenticated GitHub CLI and an eligible PR. A GitHub MCP connection is separate.

**Scope:** Theseus does not provide automatic commit/push, PR creation, or live Git conversation forking. Review/fix actions do not commit or push. The implemented merge path uses merge commits where the repository permits them.

**Suggested voiceover:** “Inspect the actual changes, get a separate review, and turn findings into a focused fix run.”

---

## 19. Interactive project terminal

- A real PTY shell rendered with xterm.js.
- Open for the selected project.
- Open for a run's execution folder, including a worktree.
- Enter commands interactively.
- Respond to prompts.
- See ANSI output.
- Use compatible full-screen terminal programs.
- Send Ctrl+C.
- Resize the terminal with the panel.
- Reconnect when switching tabs.
- Reconnect after renderer reload.
- Close the shell explicitly.
- Start a new shell after a previous one exits.
- See exit and error information.
- Keep separate project/run scopes.
- Run up to eight owned shells at once.
- Retain bounded in-memory transcripts for recent scopes.
- Stop owned shells/jobs through Close shell, Stop all, window destruction, or quit.

**Platform notes:** Interactive shells use PTY support on macOS/Linux and ConPTY on Windows. Shells run with the user's OS permissions independently of the Codex file sandbox.

**Video angle:** Keep the agent conversation on screen, open Terminal, run a test command, and show its real output.

---

## 20. Noninteractive command runner

- Available from the Terminal page on supported platforms.
- Enter a one-off command or multiline script.
- Use the selected project as the working directory.
- Start through Run command or Cmd/Ctrl+Enter.
- Stream stdout and stderr.
- Inspect exit/error state.
- Cancel an active command.
- Keep the command running when navigating away and reconnect on return.
- Retain the last 20 command records in memory.
- Enforce a ten-minute command duration limit.

**Scope:** Each invocation starts a fresh shell; use a multiline script for state within one invocation or Interactive shell for persistent state. This runner is unavailable on Windows; interactive ConPTY shells cover that platform.

---

## 21. Local application preview

### Open and interact

- Preview a running local application inside Theseus.
- Enter a complete local HTTP(S) URL.
- Accept loopback hosts: localhost, `127.0.0.1`, and `[::1]`.
- See the loaded application's title, loading state, or error state.
- Interact with the actual app.
- Retry/reload after a failure or server restart.

### Start and discover

- Start a development server through an explicit command sent to an idle project shell.
- Inspect the terminal/server output.
- Find URLs printed by that project's shell or commands.
- Choose a discovered local URL.
- Keep preview scope connected to the selected project/run/worktree.

### Isolation

- Preview content runs in a separate sandboxed browser surface.
- No application preload, Node integration, filesystem bridge, or agent grants are exposed to the previewed page.
- Assets and HMR must use the selected origin.
- The preview hides when leaving its panel or showing application overlays.

**Scope:** No general remote-site preview, port scanning, automatic ownership of unrelated servers, or unrestricted CDN/cross-origin loading.

**Suggested voiceover:** “Go from a change to the running app without leaving the workspace.”

---

## 22. Browser, saved links, and page context

### Navigation and bookmarks

- Browser page with an address/search field.
- Open validated HTTP(S) URLs externally.
- Search through DuckDuckGo.
- Save up to 100 local links.
- Revisit saved links.
- Keep bookmarks separate from agent context.
- Use External mode by default.
- Switch to an isolated Embedded browser in the desktop app.
- Back, forward, and reload in Embedded mode.

### Optional visit history

- Opt into embedded browsing history.
- Retain up to 200 visits.
- Pause recording.
- Delete individual visits.
- Clear browsing data.
- Keep bookmarks when clearing visit/extract/activity data.
- Persist visits while keeping cookies/cache in the temporary browsing session.

### Page extracts

- Extract readable main/article text, falling back to body text.
- Retain URL, title, capture time, and truncation status.
- Capture up to 20,000 characters per page.
- Keep up to five extracts in memory.
- Review an extract before selecting it.
- Explicitly include selected extracts with the next task.
- Inspect selected page references in the run.
- Clear context selections after use.

### Agent browser tools

- Built-in `browser_read` and `browser_navigate` tools for live runs.
- Access starts denied.
- Explicitly grant access to the loaded origin while a run is active.
- Allow reading and following same-origin links.
- Revoke grants.
- End grants when the browser is hidden, covered, or moved to another origin.
- Scope access to the owning run.
- Surface a busy state when another run owns the shared browser.

**Scope:** These tools do not provide arbitrary JavaScript, form submission, unrestricted cross-origin navigation, or general desktop automation.

**Video angle:** Extract a page, inspect its text, select it as context, and show its reference attached to a new task.

---

## 23. Research sources, citations, and artifacts

### Source collection

- Collect supported links from saved assistant results.
- Include explicitly selected page references.
- Include recorded built-in browser activity.
- Exclude user prompts, command output, and sample fixtures as assistant-result evidence.
- Deduplicate supported source URLs.
- Assign stable `[S#]` source identifiers.
- Keep source title and URL.
- Record the originating run/output sequence or selected page ID.
- Record capture time.
- Preserve an evidence excerpt.
- Store evidence hashes.
- Open sources in validated external navigation.

### Artifact types

- **Draft:** editable saved assistant result text.
- **Outline:** extracted paragraph/heading first lines with associated citations.
- **Comparison:** actual Markdown tables or supported source-linked result excerpts.
- Create locally after successful completion.
- No additional model request is needed for these transformations.
- Explain missing evidence instead of inventing a comparison.

### Editing

- Select an artifact type.
- See whether each type has a saved artifact.
- Edit Markdown directly.
- See unsaved-change status.
- Save the selected artifact.
- Preserve citation markers.
- Reject unknown citations and removal of required existing citation IDs.
- Preserve existing edits and stable source IDs when new run results are collected.
- Reject stale saves while retaining the user's unsaved text.
- Refresh research and explicitly discard edits when requested.
- Inspect citations used by the selected artifact.
- Open cited source URLs.

### Export

- Choose a new Markdown destination with a native save dialog.
- Review the exact path.
- Confirm the final export.
- Export saved text with cited URLs and provenance.
- Include originating result hashes.
- Avoid overwriting an existing file.
- Reject expired or changed destinations/artifacts.
- Report cancellation, completion, and errors.

**Evidence distinction:** A cited URL establishes a recorded reference, not independent proof that the page was retrieved or its claims verified. The app and exported provenance preserve that distinction.

**Video angle:** Show a research result becoming a saved comparison, edit a conclusion, and export the finished Markdown with citations.

---

## 24. Memory knowledge graph

### Graph structure

- Local saved knowledge graph.
- Typed facts: Person, Project, Preference, Technology, Goal.
- Labeled relationships between saved nodes.
- Personal or project scope.
- Explicit project identity based on the selected canonical folder.
- Current and superseded versions.
- Stable lineage across edits.

### Visual interaction

- Pan.
- Zoom in/out.
- Fit view.
- Minimap.
- Drag nodes.
- Persist saved node positions.
- Color-coded node types.
- Select facts and relationships.
- Read details next to the graph.
- Inspect version history.
- Filter by personal/project scope.
- Filter by project.
- Search labels, meanings, types, and relevant scope text.
- Use optional on-device semantic/concept matching for English text.

### Authoring

- Add memory.
- Add relationship.
- Remember this from a user-authored task or draft.
- Review the fact's meaning, label, type, scope, and source.
- Save explicitly.
- Revise a fact into a new version.
- Mark the previous version Superseded.
- Preserve relationship and scope constraints.
- Keep source notes or source-task excerpts.

### Select memory for a task

- Review full meaning, source, and dates.
- Select current eligible facts in the Home composer.
- Apply the chosen profile's eligibility policy.
- Select supported relationships with endpoint labels.
- Validate scope and graph revision at task start.
- Keep historical references to the selected versions/lineages.
- Clear selection after relevant project/agent changes.

### Extraction proposals

- Paste text or choose an original saved live user task.
- Run deterministic local extraction rules.
- Recognize explicit preference, goal, and technology statements.
- Review up to 50 proposals.
- Proposals begin unchecked.
- Edit labels, meanings, types, source excerpts, and scope.
- Save only the reviewed selected proposals as a batch.
- Disclose omitted or overlong matches.
- Require a new review after expiry or graph changes.

### Duplicate review and deletion

- Review possible duplicates using local similarity.
- Compare compatible scopes and relationship endpoints.
- Inspect each candidate's meaning/source.
- Select visible results for bulk deletion.
- Clear bulk selection.
- Review the combined deletion impact.
- Delete a lineage and its historical versions after confirmation.
- Include affected relationship lineages and layout records in the impact review.
- Keep independent duplicates unless explicitly selected.

**Scope:** The current app does not silently learn from sessions, run model-based memory extraction, or use remote embeddings. Similarity is a review aid, not an automatic merge decision.

**Suggested voiceover:** “Save the facts that matter, see how they connect, and choose when they belong in a task.”

---

## 25. Memory portability and manual sync

- Export the real graph as versioned Theseus memory JSON.
- Include owner metadata, scopes, version chains, relationships, provenance, and positions.
- Import a compatible exported graph.
- Preview new, unchanged, and conflicting lineages.
- Choose the local or incoming whole lineage for a conflict.
- Preserve local-only lineages.
- Mark imported provenance as unverified.
- Refuse stale reviews after graph or file changes.
- Connect a user-chosen portable file for the current app session.
- Review sync pull using the same import/conflict workflow.
- Review sync publish before replacing the portable file with the local graph.
- Use a file in an externally synced folder if desired.
- Reconnect when owner metadata changes.
- Keep sample exports distinct from real graph exports.

**Scope:** Sync is manual, file-based, and reviewed. There is no background cloud synchronization, watcher, automatic deletion propagation, or encrypted portable file format.

**Video angle:** Export a memory graph, preview an import conflict, and choose which version to keep.

---

## 26. Persistent routines and automation

### Routine definition

- Routine name.
- Actual task to execute.
- Native-selected project folder.
- Current saved agent and its reviewed revision.
- Direct checkout or new managed worktree.
- Trigger configuration.
- Enabled/disabled state.
- Explicit automatic-execution consent when enabling.

### Triggers

- Interval from one minute to one week.
- Selected weekdays at a chosen UTC time.
- Daily scheduling by selecting all seven weekdays.
- A manual live run succeeds in the same project.
- A manual live run fails in the same project.

### Controls

- Create disabled by default.
- Review and enable.
- Disable.
- Edit.
- Run now for an enabled available routine.
- Confirmed delete from the full Routines page.
- Resume paused scheduling explicitly.
- See the next scheduled occurrence in local time.

### Execution behavior

- Use the saved task, project, and exact agent revision.
- Share the app's live slots and checkout locks.
- Allow one active occurrence per routine.
- Skip overlapping triggers.
- Skip missed/offline occurrences rather than catching up.
- Avoid recursively triggering routines from routine-generated work.
- Exclude unrelated projects from project event triggers.
- Keep already running work on its saved snapshot when a routine is edited or disabled.
- Cancel pending starts and queued work when the saved routine changes appropriately.
- Pause scheduling durably through Stop all.
- Fail visibly when the agent/project/configuration is unavailable.
- Keep unattended overflow behavior visible.

### History

- Latest 500 attempts across routines.
- Trigger category and execution time.
- Configuration revision.
- Status and diagnostics.
- Links to retained actual runs.
- Attempt history remains when a routine is deleted.
- Result links become unavailable when their run is removed from history.

**Scope:** Theseus must be open and awake. The current application does not install a daemon/cron service, replay missed work, automatically retry failed attempts, or accept external webhook triggers.

**Suggested voiceover:** “Turn repeatable work into a reviewed routine: choose the task, the agent, the project, and when it should run.”

---

## 27. Library and project-file search

### Saved records

- Browse saved agents.
- Browse current memories and relationships.
- Browse live run records.
- Filter by record category.
- Search record titles and descriptions.
- Inspect a record's details.
- Open its originating agent, memory, or run surface.
- Identify sample records separately.

### Project file indexing

- Select a project.
- Import individual files through a native picker.
- Import a folder within that project.
- Discover supported text files.
- Search filenames and indexed text.
- Show snippets and line numbers.
- Preview the actual file as plain text.
- Refresh the index.
- Discover new files inside an imported folder during refresh.
- See missing, inaccessible, unsupported, oversized, or limited-file states.
- Disclose partial indexing.

### Import management

- View imported selections.
- Remove one import.
- Respect coverage by overlapping imports.
- Clear a project's index after confirmation.
- Preserve original project files.
- Keep other projects' imports intact.
- Persist selection metadata without durably copying imported contents into an index database.

### Supported material

- UTF-8 text and Markdown.
- Common source-code and web files.
- JSON, YAML, TOML, and XML.
- CSV and TSV as searchable text.
- Dockerfile and Makefile.
- Other supported extensions explicitly recognized by the index.

**Scope:** This is text/source-file discovery, not a general PDF, Office, image, or binary document processing engine. Imported files become task context only after the separate review-and-include step.

---

## 28. Accounts, models, usage, and integrations

### Codex account

- Check runtime/account availability.
- Start runtime-managed browser sign-in.
- Cancel sign-in.
- Sign out when active work does not block the action.
- Open subscription/account management externally.
- Show available account identity and plan information.
- Keep authentication separate from the cosmetic local profile.

### Usage

- Show quota windows supplied by the runtime.
- Show usage percentages when available.
- Show available reset times.
- Refresh provider state.
- Reuse provider usage information on Home.
- Explain unavailable usage information.
- Distinguish actual runtime data from sample usage displays.

### MCP configuration

- Add app-owned MCP servers.
- Support HTTPS and local HTTP transports.
- Support absolute-path stdio executables.
- Configure JSON argument arrays.
- Refer to environment variable names rather than storing inline token values in URLs.
- Enable/disable a connection for future tasks.
- Check a connection.
- See configured/connected/disabled/error state.
- Remove local server configuration.
- Use OAuth where the supported HTTP server/runtime offers it.
- Prefill GitHub, Linear, and Slack service configurations.
- Pass enabled configurations explicitly into new live tasks.
- Keep active turns on their existing connection snapshot.

**Scope:** A saved configuration does not prove that a service is connected or that any particular remote tool exists. Other services require their own setup and permissions. Codex is the only integrated agent runtime.

**Video angle:** Show a configured service reaching Connected, then show that new work uses the app's explicit tool configuration.

---

## 29. Public GitHub agent imports and external launchers

### Import agent instructions

- Enter a public repository URL or `owner/repo`.
- Optionally choose a branch or tag.
- Discover a Markdown catalog.
- Search the catalog.
- Preview candidate instructions.
- Import `AGENTS.md`, `SKILL.md`, or another supported Markdown definition as agent instructions.
- Extract simple name/description frontmatter.
- Review the imported name, description, and instruction body.
- Choose read-only or writing access.
- Save a local agent profile.
- Keep a link to the exact imported commit.
- Pin and verify the selected source blob.
- Explain expiry, size, rate-limit, and connection failures.

**Scope:** Imports are local instruction copies from anonymous public GitHub access. They do not clone a repository, install a skill/tool, execute setup scripts, fetch linked files, update automatically, or reproduce another runtime's permission model.

### External launchers

- Store a launcher's name, description, repository URL, runtime label, command, and working folder.
- Create, edit, and remove launcher records.
- Keep the exact command visible.
- Select the working folder natively.
- Record when a launcher was handed off.
- On macOS, Launch opens the saved command in Terminal.
- Organize Claude, Codex, or Other labels for externally managed tools.

**Scope:** The tool must already be installed. Theseus does not capture that external Terminal's output, verify its startup, apply the integrated sandbox, or stop it through Stop all. The runtime label is organizational; it is not another integrated execution adapter.

---

## 30. Notifications, focus, and local profile

### In-app notification feed

- Bell control with unread indicator/count.
- Completed, failed, cancelled, or interrupted live Codex run items, plus separately labeled sample attention items.
- Open a linked session from a notification.
- Mark an item read when opening it.
- Mark all read.
- Inspect timestamps and result details.
- Open notification settings.
- Keep decisions/read state for the current app session.
- Allow a continued run to produce a fresh result notification.

### System notifications

- Completed live run notifications when enabled.
- Failed live run notifications when enabled.
- Banner delivery.
- Banner plus sound.
- Badge-only preference.
- Failure badge updates where supported.
- Clear failure badge on application focus where supported.
- Exclude task/project/output text from system notification bodies.

### Deep work

- Enable deep-work filtering.
- Use Monday–Friday, 09:00–12:00 local time.
- Allow only blockers or suppress new notifications.
- Apply category preferences as well.
- Keep the app badge behavior distinct from banner delivery.

### Local profile

- Edit display name.
- Edit optional bio.
- Save or cancel changes.
- Update the avatar initial/name shown in the application.
- See counts for real saved agents, current memories, and runs.
- Open those corresponding areas.
- Inspect coding runtime availability/authentication and selected project.
- Open app settings.

**Scope:** The local profile is cosmetic and device-local. It is not a Theseus online account or an agent memory source. Native notification delivery depends on OS permission/signing; macOS native notifications require a signed app.

---

## 31. Settings, keyboard shortcuts, and desktop lifecycle

### Settings areas

- General.
- Models & usage.
- Approvals & safety.
- Spaces & folders.
- Notifications & focus.
- Memory & privacy.
- Integrations.
- Keyboard.
- About.

### General preferences

- Start at Home or the last saved session.
- Choose a default space.
- Choose Focus, Split, or Grid as the default layout.
- Choose an eligible default saved agent.
- Comfortable or Compact density.
- Collapse tool cards by default.
- Show the app in the menu bar/system tray.
- Launch-at-login controls where installed packaging/platform support permits them.
- Persist supported renderer preferences locally.

### Keyboard

| Default shortcut | Action |
| --- | --- |
| Cmd/Ctrl+K | Open command palette |
| Cmd/Ctrl+N | Prepare a new task |
| Cmd/Ctrl+0 | Go Home |
| Cmd/Ctrl+1 | Focus layout |
| Cmd/Ctrl+2 | Split layout |
| Cmd/Ctrl+3 | Grid layout |
| J / K | Next / previous session |
| `/` | Search Settings |
| Cmd/Ctrl+Enter | Approve a selected waiting demo request |
| A / D | Approve / deny a selected demo request |

- Rebind individual actions.
- Reject conflicting bindings.
- Cancel capture with Escape.
- Reset shortcuts.
- Persist bindings across restarts.
- Avoid most navigation shortcuts while typing or in dialogs.
- Allow the modified command palette shortcut while typing.
- Treat Command/Control as the primary platform modifier.

### Lifecycle and updates

- Window close/minimize/maximize controls.
- Open/Quit actions from the menu bar/system tray.
- Keep work and scheduling alive when hiding the window to the tray.
- Stop owned execution on actual quit.
- Show application/runtime version information.
- Check public stable GitHub releases for updates.
- Distinguish current, available, unpublished, offline, and invalid update states.
- Open a validated release page for a newer version.

**Scope:** This source distribution has no signed installer or automatic in-place updater. Launch at login is conditional on installed macOS/Windows packaging and is unavailable for this source launch/Linux configuration.

---

## 32. Execution controls, storage, and privacy features

### Execution boundaries

- Main-owned project selection and execution IDs.
- Read-only and workspace-write file sandboxes.
- Read-only enforcement for planning, review, and research roles.
- Whole-run duration limits.
- Noninteractive approvals set to never.
- Deny escalation requests instead of showing a simulated live approval.
- Disable network access for agent sandbox commands.
- Disable built-in web search for the exec adapter.
- Configure browser/MCP access separately.
- Keep manual terminal permissions distinct from agent sandbox permissions.

### Stop all

- Cancel owned queued and active Codex work.
- Stop application-owned manual command runs and interactive shells.
- Close local previews.
- Revoke built-in browser grants.
- Stop demo activity.
- Durably pause routines until explicitly resumed.
- Preserve already-written project edits.

### Local application records

- Persist agent profiles.
- Persist run history and configuration snapshots.
- Persist memory graph versions and positions.
- Persist research sources and artifacts.
- Persist routines and attempts.
- Persist import selections and worktree ownership.
- Persist supported desktop settings and MCP configuration references.
- Keep temporary browser context, terminal transcripts, and grants separate from durable records.
- Validate versioned stored formats.
- Use atomic-write patterns in main-owned storage.
- Preserve damaged records with visible warnings.
- Redact known environment secrets and common token patterns in captured output.
- No configured crash-report upload service.

### Browser/renderer isolation

- Sandboxed application renderer with context isolation.
- Node integration disabled in the renderer.
- A narrow typed preload API instead of generic filesystem/shell IPC.
- Validate the owning renderer/frame for native calls.
- Native pickers and main-owned receipts for privileged file/destination selection.
- Separate isolated browser surfaces for external pages and local preview.

**Scope:** Stored records are plaintext rather than encrypted. Provider-bound tasks/context and configured MCP operations can leave the device. Do not describe Theseus as fully offline, completely private, a universal terminal sandbox, or a tool that prevents every possible data leak.

---

## 33. Demo and sample experiences

These surfaces are useful for explaining the interface and recording controlled footage, provided their demo identity remains clear.

### Demo conversations

- Fictional coding and research sessions.
- Agent messages and tool cards.
- Planning cards.
- Approval request examples.
- Error/retry examples.
- Review findings.
- Source cards.
- Comparison tables.
- Draft-writing examples.
- Choice/question cards.
- Suggested replies.
- Simulated message responses.
- Pausing/resuming simulated activity.

### Demo actions

- Review a simulated command.
- Edit a simulated approval command.
- Approve, deny, or use the demo always-allow choice.
- Simulate retry behavior.
- Fork a conversation at a message.
- Fork with a sample commit reference.
- Open the source conversation from a fork.
- Demonstrate sample diffs, commits, and checks.

### Populated sample data

- Twelve fictional agent configurations.
- Nineteen sample graph nodes.
- Eighteen sample relationships.
- Sample graph navigation, search, and filtering.
- Sample sources, outlines, and drafts.
- Saved/sample data toggle.
- Sample-preview preference retained locally.
- Sample editing/deletion or execution disabled where appropriate.
- Samples kept out of real profile selectors and agent memory context.

### Demo-only concepts visible in the UI

- Morning brief delivery schedule.
- Example brief content.
- Learned this week.
- Learn from my sessions preference.
- Demo memory preferences.
- Simulated approval/always-allow behavior.
- Some sample usage and activity displays.
- Fictional sample PR state.

**Scope:** Demo approval changes do not affect live execution permissions. Demo forks do not create Git checkouts. Sample usage is not a bill or a measured provider quota. A preference control labeled Demo does not establish a background learning or brief-delivery service.

---

## 34. Practical limits reference

These details are useful for accurate callouts and for preparing reliable recordings. They are generally secondary to the launch narrative.

| Area | Current limit or behavior |
| --- | --- |
| Live Codex slots | 1–8; default 1 |
| Global/profile run duration | 5–1,800 seconds, with the effective limit constrained by launch settings |
| Task/follow-up text | Up to 32,000 characters |
| Crew handoff | Up to 16,000 characters of predecessor final messages |
| Reviewed task files | Up to 5 |
| Characters per reviewed file | 32,000 |
| Total reviewed file characters | 64,000 |
| File review lifetime | 30 minutes |
| Selected memory context | Up to 20 distinct records / 24,000 serialized characters |
| Fact meaning | Up to 4,000 characters |
| Saved memory source excerpt | Up to 1,000 characters |
| Memory graph | 5,000 stored versions / 32 MB |
| Extraction input | Up to 32,000 characters |
| Extraction proposals | Up to 50 per review |
| Extraction/import review lifetime | Reviewed operations can expire; extraction review is 15 minutes |
| Duplicate scan | Up to 100 matches / 20,000 comparisons |
| Library file | Up to 256 KiB |
| Library known files | 1,000 per project |
| Library indexed text | 8 MiB per project |
| Library displayed search results | Up to 200 |
| Library folder traversal | 4,000 entries / 32 levels |
| Public GitHub Markdown catalog | Up to 1,000 entries |
| GitHub import catalog lifetime | 15 minutes |
| Imported agent instructions | Up to 32,000 characters |
| Saved browser links | Up to 100 |
| Optional browser visit history | Up to 200 visits |
| Page extracts | Up to 5 in memory |
| Text per page extract | Up to 20,000 characters |
| Research sources | Up to 200 per run record |
| Research artifact | Up to 200,000 characters |
| Research record | Up to 3 MB |
| Markdown destination receipt | Expires after 5 minutes or a relevant artifact change |
| Artifact shelf | Results displayed in batches of 20 |
| Routines | Up to 100 |
| Routine interval | 1–10,080 minutes |
| Routine history | Latest 500 attempts |
| Routine store | Up to 3 MB |
| Interactive shells | Up to 8 owned shells |
| Shell transcript | Up to 120,000 characters per scope |
| Retained shell scopes | Up to 24, in memory |
| One-off command history | Last 20 commands, in memory |
| One-off command output | Up to 120,000 characters per command |
| One-off command duration | 10 minutes |
| Run output projection | Approximately 150,000 characters / 300 entries per run |
| History retention | Forever, 30, 90, or 365 days |
| Git commit list | Latest 20 commits |
| Untracked Git preview | Up to 100 files / 200 KB of content |
| Desktop reference size | 1440 × 900 |
| Minimum supported window | 1100 × 700 |

---

## 35. Suggested workflow demonstrations

### A. From task to reviewed implementation

1. Choose a small Git project.
2. Select Build → Review.
3. Inspect the Forge and Sentinel role configuration.
4. Attach a relevant reviewed file.
5. Start the task.
6. Show real output and file events.
7. Show the second crew step starting after the first succeeds.
8. Open Overview.
9. Move to Git changes and review the actual diff.
10. Show findings or check results that genuinely exist.

**Story:** Task → implementation → independent review → inspectable result.

### B. A reusable agent from Home

1. Open Home → Crew.
2. Create an agent in the inline editor.
3. Add a short instruction set and choose permissions.
4. Save.
5. Expand Configuration & activity.
6. Select the agent for the existing Home draft.
7. Start a small task.
8. Return to the agent's recent runs.

**Story:** Configure a working style once and reuse it.

### C. Research to an exported deliverable

1. Prepare Research → Write with real supplied references.
2. Run the sequence.
3. Inspect the collected source references.
4. Create a comparison or draft from the saved results.
5. Edit and save a small conclusion.
6. Return to Home → Artifacts.
7. Search/filter for the saved work.
8. Preview it.
9. Export Markdown to a new file.
10. Show the saved deliverable with citations/provenance.

**Story:** Evidence → writing → editable artifact → exported file.

### D. Memory that is deliberately selected

1. Add a project preference.
2. Add a relationship to a project node.
3. Inspect the graph and version information.
4. Return to Home.
5. Select the fact in Memory context.
6. Show it in the reviewed task configuration.
7. Start a task that can use that preference.

**Story:** Save useful context and control when it is used.

### E. An isolated coding task

1. Choose New Git worktree.
2. Start a focused coding task.
3. Inspect the source and execution paths.
4. Open the task's terminal.
5. Show a command running in the worktree.
6. Inspect that checkout's Git changes.

**Story:** Separate the task's working folder from the source checkout.

### F. A real app result in view

1. Open a coding run.
2. Open Terminal.
3. Start a local dev server with an explicit command.
4. Find its printed local URL.
5. Open Preview.
6. Interact with the real app.
7. Return to the conversation or diff.

**Story:** Agent work and the running result share one workspace.

### G. A repeatable routine

1. Open Home → Routines.
2. Create a routine with a saved agent, project, and task.
3. Save it disabled.
4. Review the enable confirmation.
5. Enable it.
6. Use Run now to produce a real attempt for the recording.
7. Expand Task & recent results.
8. Open the actual result.
9. Return to Home with the original composer draft intact.

**Story:** Make repeated work easy to define, inspect, and run.

### H. Return to earlier work

1. Open Run history.
2. Search by project or task.
3. Open a saved run.
4. Show its original configuration.
5. Continue a saved thread when available.
6. Alternatively use Review rerun to prepare a fresh task.

**Story:** Work remains accessible beyond the moment it runs.

---

## 36. Possible launch-video structures

### Option 1: A focused 60–90 second product story

| Segment | Suggested footage | Main message |
| --- | --- | --- |
| Opening | Workspace reveal and Home composer | One place for agent work |
| Prepare | Project, saved agent, reviewed file | Give work a clear context |
| Execute | Build → Review and live output | Visible work and handoffs |
| Inspect | Overview, diff, checks | Understand the result |
| See it | Terminal and app Preview | Connect code to the running app |
| Keep it | Artifacts or Memory | Reuse what matters |
| Repeat it | Routine and recent result | Make recurring work accessible |
| Close | Home with a completed run | Return to a coherent workspace |

### Option 2: A 2–3 minute feature tour

- Start with Home and the project/task workflow.
- Show saved agents and crew routes.
- Demonstrate worktree isolation and a real code review.
- Show terminal and preview.
- Demonstrate research artifacts and export.
- Show explicit memory selection and graph inspection.
- Finish with routines, history, and notifications.

### Option 3: A research-focused video

- Research → Write.
- Browser/page reference selection.
- Collected sources and stable citations.
- Draft/outline/comparison creation.
- Home artifact shelf.
- Markdown export.
- Related project memory.
- Scheduled repeat research as a routine.

### Option 4: A developer-focused video

- Saved builder/reviewer profiles.
- Build → Review.
- Managed worktrees and parallel task slots.
- Diff/findings/fix loop.
- Interactive terminal.
- Local app preview.
- History and follow-ups.

---

## 37. Script wording grounded in current features

These lines can be adapted to the brand voice. They describe implemented behavior without promising a particular model outcome.

- “Bring your agent conversations and project tools into one workspace.”
- “Choose a project and prepare a task with the context you want to share.”
- “Save agents with their own instructions, models, and working permissions.”
- “Let Forge build, then hand the result to Sentinel for review.”
- “Move from research to writing with a visible handoff.”
- “See the status, checkout changes, and available checks from Home.”
- “Open the diff or the failing check directly from the next action.”
- “Keep each task's terminal and preview tied to its working folder.”
- “Use a Git worktree when a task needs its own checkout.”
- “Save useful facts in a graph, then choose them explicitly for a task.”
- “Find a saved draft, outline, or comparison in the Artifacts panel.”
- “Export the saved result as Markdown with its citations and provenance.”
- “Create routines for reviewed tasks while Theseus stays open.”
- “Return to earlier work through persistent run history.”
- “Connect configured MCP services to new Codex tasks.”

### Wording that needs qualification

| Tempting phrase | More accurate current wording |
| --- | --- |
| “An autonomous team that works in parallel” | “Run multiple tasks in separate worktrees; predefined crew steps run sequentially.” |
| “Learns everything about how you work” | “Save reviewed memory and explicitly select it for tasks.” |
| “Verified research” | “Collected source references with provenance; review the evidence and claims.” |
| “Always-on automation” | “Scheduled and event-triggered routines while the app is open and awake.” |
| “Supports every AI model/provider” | “Uses installed Codex with its advertised models; external launchers are separate.” |
| “Ask before every risky action” | “Live execution uses a noninteractive deny-escalation policy; displayed approval examples are demo-only.” |
| “GitHub integration handles the whole PR lifecycle” | “Inspect actual PR state/checks, run review/fix tasks, and confirm eligible merges; PR creation and automatic commit/push are not implemented.” |
| “Automatic cloud memory sync” | “Reviewed manual import/export and portable-file sync.” |
| “Publish anywhere” | “Export saved artifacts to new local Markdown files.” |
| “Everything stays on your machine” | “App records are stored locally; selected tasks/context go to Codex and configured services.” |
| “Runs on every platform with full parity” | “Electron desktop app, with feature-specific OS and packaging conditions.” |
| “One-click installers and automatic updates” | “Current source distribution with manual build/run and release-page update checks.” |

---

## 38. Recording preparation

### Environment

- Use the Electron desktop application for live execution, terminals, routines, native pickers, and artifact export.
- Build the current source before recording production-mode footage.
- Restart after main/preload/shared API changes; renderer hot reload alone does not update the desktop bridge.
- Use a deliberate, non-sensitive project with enough real content for the intended demo.
- Check Codex installation and authentication.
- Use an advertised model or Runtime default.
- Check GitHub CLI authentication if recording actual PR/check/merge features.
- Start only MCP services needed for the sequence.
- Use stable local-server assets that work within Preview's chosen-origin rules.
- Use a consistent window size and density throughout the main footage.
- Keep demo labels visible if recording samples.

### Demo data to prepare

- One small coding project with an understandable requested change.
- One builder and one reviewer saved configuration.
- One completed task with a visible real diff.
- One retained run with available GitHub check results, if showing checks.
- One research result with actual supplied or obtained source links.
- A saved Draft, Outline, and Comparison.
- A few meaningful project memories and relationships.
- One disabled routine ready to inspect and enable.
- A real retained routine result.
- A local app that starts reliably for Preview.
- A supported saved thread if filming follow-up continuation.

### Stable UI preview entry points

These are useful for interface-only footage and sample exploration, not proof of live execution:

| Entry point | Purpose |
| --- | --- |
| `?samples=1` | Populate sample agents and graph |
| `?s=c1&view=focus` | Sample coding session |
| `?s=r1&tab=sources` | Sample research sources |
| `?view=grid&page=session` | Grid of active demo sessions |
| `?page=settings&section=safety` | Safety settings |
| `?static=1` | Stop periodic simulated activity for steadier sample footage |

For Electron sample preview, launch with `THESEUS_SAMPLE_PREVIEW=1 pnpm dev:electron`. For real work, select saved data and Codex · Live, and show actual run output/results.

---

## 39. Current feature boundaries in one place

This section is a reference for the editor/scriptwriter, not a suggested sequence of negative callouts in the video.

- Codex is the only integrated execution runtime.
- Named crews use predefined sequential routes.
- Parallel tasks need separate checkouts/worktrees where checkout locking applies.
- Multi-step crews currently use direct shared-folder execution.
- Live approvals are noninteractive; demo approvals do not authorize a live process.
- No general command allowlist, ask-first rules, token budget, spending budget, per-step timeout, or network-domain allowlist.
- No automatic commit/push, PR creation, or live Git fork/merge conversation workflow.
- No arbitrary workflow DAG builder.
- No general browser form automation, arbitrary page JavaScript, or unrestricted browsing grants.
- No automatic personal learning, model-based memory extraction, remote embeddings, or Graphiti service.
- No background memory sync or automatic duplicate merging.
- No routine daemon, missed-run replay, automatic retries, or external webhooks.
- No guarantee that a cited page was fetched or its content independently verified.
- No remote artifact publication; exports are new local Markdown files.
- No built-in full-app encrypted backup/restore.
- No dictation or actual delivered morning brief.
- No fully supported mobile interface.
- No signed installer or automatic application replacement in the current source distribution.
- No claim that a successful agent exit proves task correctness.

---

## 40. Source map for checking and updating this catalog

The implementation reference at the top is the baseline for this document. Recheck capabilities when the code or release changes.

| Area | Main references |
| --- | --- |
| Overall product behavior, requirements, limitations | [README](../README.md) |
| Application composition/navigation | [App](../src/App.tsx), [layout shell](../src/components/layout/shell.tsx) |
| Home composer and templates | [Home](../src/components/pages/home.tsx), [task routing](../src/components/crew/task-routing.tsx) |
| Home/session right panels | [Inspector](../src/components/session/inspector.tsx), [Overview](../src/components/session/overview.tsx), [Home Overview](../src/components/session/home-overview.tsx) |
| Home crew management | [Home Crew](../src/components/session/home-crew.tsx) |
| Home artifact shelf | [Home Artifacts](../src/components/session/home-artifacts.tsx) |
| Saved agents and configuration editor | [Agents](../src/components/pages/agents.tsx), [profile backend](../electron/agent-profiles.ts) |
| Crew routing and role policies | [Crew contract](../shared/crew.ts), [agent runner](../electron/agent-runner.ts) |
| Live conversations and run details | [Live run UI](../src/components/session/live-run.tsx), [Codex event projection](../electron/codex-protocol.ts) |
| Reviewed files and built-in prompt workflows | [Task context UI](../src/components/composer/task-context.tsx), [task context contract](../shared/task-context.ts), [task context backend](../electron/task-context.ts) |
| Git review, fixes, and merges | [Git UI](../src/components/session/git-changes.tsx), [Git service](../electron/git-service.ts) |
| Worktrees | [Worktree settings](../src/components/pages/worktree-settings.tsx), [worktree backend](../electron/worktrees.ts) |
| Terminal and preview | [Project terminal](../src/components/project-terminal.tsx), [Project preview](../src/components/project-preview.tsx), [project tools contract](../shared/project-tools.ts) |
| Browser and context grants | [Browser page](../src/components/pages/browser.tsx), [browser tools](../electron/browser-tools.ts), [embedded browser](../electron/embedded-browser.ts) |
| Research, citations, and export | [Research UI](../src/components/session/research.tsx), [research backend](../electron/research.ts), [Markdown exporter](../electron/research-export.ts) |
| Memory graph and workflows | [Memory UI](../src/components/pages/memory.tsx), [memory workflows UI](../src/components/memory/workflows.tsx), [memory contract](../shared/memory.ts), [memory workflow backend](../electron/memory-workflows.ts) |
| Routine editor, right panel, and scheduling | [Routines UI](../src/components/pages/routines.tsx), [routine contract](../shared/routines.ts), [scheduler](../electron/routines.ts) |
| History and retention | [History UI](../src/components/pages/history.tsx), [history backend](../electron/run-history.ts) |
| Library and file search | [Library UI](../src/components/pages/library.tsx), [project file index](../electron/library-index.ts) |
| Accounts and MCP | [Provider settings](../src/components/provider-settings.tsx), [integration backend](../electron/integrations.ts) |
| GitHub imports and launchers | [GitHub import UI](../src/components/pages/github-agent-import.tsx), [launcher UI](../src/components/pages/agent-launchers.tsx) |
| Notifications and local profile | [Notifications](../src/components/layout/notifications.tsx), [Profile](../src/components/pages/profile.tsx) |
| Settings, shortcuts, and lifecycle | [Settings](../src/components/pages/settings.tsx), [keyboard bindings](../src/state/keyboard.ts), [desktop preferences](../shared/desktop.ts) |
| Execution policy and desktop API | [Safety contract](../shared/safety.ts), [desktop bridge](../shared/bridge.ts), [main process](../electron/main.ts) |
| Demo actions and sample fixtures | [Demo actions](../src/components/session/demo-actions.tsx), [mock data](../src/data/mock-data.ts), [sample preview data](../src/data/sample-preview.ts) |

