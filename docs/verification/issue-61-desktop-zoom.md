# Issue 61 — desktop zoom and keyboard access

## Reproduction

On main `7d8e4e3`, a real Electron `BrowserWindow` at 1440×900 with `webContents.setZoomFactor(2)` reported a 720×450 CSS viewport, an 1100×700 app, root `scrollWidth: 1100`, and root `overflow: hidden`. This substantiates the inaccessible overflow in issue 61. The initial hidden-window screenshot attempt timed out; the dimensions were measured successfully before implementation.

## Changes

- Remove the renderer's forced 1100×700 minimum while retaining the native desktop window minimum in Electron.
- At effective widths of 1250 CSS pixels or less, use keyboard-accessible Workspace, Sessions / Settings sections, and Inspector controls. The hidden panels leave the tab order; navigation returns to Workspace without unmounting draft content.
- Restoring a hidden session inspector selects the compact Inspector panel and moves focus to its panel control; at wider widths it focuses the first inspector control. Hiding the compact inspector returns focus to Workspace.
- Allow the rail, tabs, workspace, inspector, and dialogs to scroll. Wrap action groups, stack Split conversations, reflow Grid and page grids, and let the short viewport scroll around a useful conversation/composer height.
- Keep long agent editors in one scrolling column, constrain dialogs to the effective viewport, and restore focus to the opening control for controlled dialogs without a Radix Trigger.
- Keep the command-palette label and shortcut within the title bar. No palette/color token changes; issue 60's approved token hunks were inspected read-only and remain independent.

## Rendered verification

Run `pnpm build` followed by `pnpm test:desktop-zoom`. The suite uses a disposable Electron profile and a deliberately missing Codex executable. A test-only entry point (`tests/fixtures/hidden-desktop.cjs`) loads the production build after installing visibility guards: prohibited macOS app activation, blocked app focus/dock show, blocked window show/showInactive/focus/restore, and hidden, nonfocusable offscreen BrowserWindow construction with background throttling disabled. Native notification/dialog requests fail before presenting UI. No production launch behavior changes. The suite exercises the production app activation handler, asserts offscreen/hidden/inactive state, and checks visibility before every capture. It calls native `setSize` and `webContents.setZoomFactor`; it does not substitute CSS zoom or a CSS transform.

| Native window | Electron zoom | Measured CSS viewport |
| --- | --- | --- |
| 1440×900 | 125% | 1152×720 |
| 1440×900 | 150% | 960×600 |
| 1440×900 | 200% | 720×450 |
| 1100×700 | 125% | 880×560 |
| 1100×700 | 150% | 733×467 |
| 1100×700 | 200% | 550×350 |

All six cases passed. The one-pixel app-height rounding at minimum-window 150% is allowed; the document has no corresponding inaccessible overflow. Each case verifies:

- App/document dimensions follow the effective viewport.
- Tab navigation scrolls to the native project chooser and Home composer; Start Codex remains reachable and correctly disabled without a selected project.
- Keyboard-only demo Start and session Send work, while primary actions have viewport bounds and unobscured center points.
- Sessions, inspector Terminal, Settings sections, Focus/Split/Grid, and the Grid new-session action remain reachable.
- Keyboard Hide panel → Show inspector reveals the previously selected Terminal content, removes the restore control, selects Inspector, and leaves focus on its visible, unobscured panel control. Hiding first restores focus to Workspace.
- The command palette opens and its primary action is reachable.
- A confirmation dialog can be dismissed with Escape and returns focus to its opener.
- A long agent editor scrolls to its primary button and saves a local fixture agent using the keyboard.
- A recovered Research draft remains accessible in the status bar after Home → Agents navigation. Keyboard access opens its long recovery dialog, shows enabled Save, reaches close, restores opener focus on Escape, and deliberately discards the fixture draft. This uses disposable local draft storage; it does not invoke Save for the synthetic run.

Screenshots for Home, inspector, restored inspector, Grid, confirmation, agent editor, and Research recovery at every size and a structured `results.json` are written to ignored `artifacts/verification/desktop-zoom/`. The results include restoration visibility/focus, Research recovery and hidden-fixture evidence. The hidden offscreen run rounds the minimum-window 150% height to 467 CSS pixels; the earlier native-surface run measured 466.

## Checks and limits

- `pnpm typecheck`: passed (also part of the production build).
- `pnpm test`: the pinned-main integration run passed 32 files / 360 tests, with three timeout failures in unchanged browsing/library tests during contention. The focused rerun of both failed files passed all 29 tests; all 34 files / 363 tests therefore passed across the two runs. The initial failure is retained in the integration report.
- `pnpm build`: passed; existing Vite large-chunk warning remains.
- `pnpm test:desktop-zoom`: passed, all six native cases and no renderer errors.
- `pnpm audit --prod --audit-level high`: passed with no known vulnerabilities on the pinned-main integration.
- `pnpm test:smoke`: passed in the original implementation; not rerun for the focused inspector revision or pinned-main integration, as directed by the coordinator. No port 4173 use in these runs.
- `git diff --check`: passed.

The independent review reproduced a restoration defect at original implementation `abfd507aa73d4ca9fb86077c59635f6ac19e0323`: Show inspector left `compact-workspace`, hid the mounted inspector, and dropped focus to the body. The added rendered keyboard regression reproduced it before the revision and passes after the fix across all six sizes.

Pinned-main integration uses a normal merge of `6b337a900d6dfe50f8c980390de491ea7442e305` into the independently approved feature SHA `4f44b535934432df77b5dc24a9999c8866c50bb8`. The sole conflict was the App return line: preserve compact navigation, panel wrappers and restoration references, and mount main's `ResearchDraftRecovery` inside `StatusBar`. Main's contrast tokens, research persistence and worktree recovery remain intact. The added recovery matrix covers this combined shell without expanding product behavior.

Verification ran on macOS. Earlier hidden native-surface capture was unavailable and the original suite used an inactive visible window; the revised suite renders and captures fully offscreen from construction and closes its owned process/removes its disposable profile during cleanup. No visible-window fallback remains. It does not launch live/provider tasks, alter OS settings, prove Windows/Linux acceptance, or validate every product workflow. The app remains a source distribution; this change does not add installers or a mobile layout.
