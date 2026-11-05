# Issue 60: shared small-text contrast

The R09 findings were reproduced on base commit `7d8e4e3c4705c789dd47a88502f3445dba6bfe32` using the built renderer in Google Chrome, Playwright, and axe-core 4.14.0. The new rendered regression suite also ran against the unchanged palette in Electron and failed as expected. No provider execution was used.

| Reported text | Before, normal | After, normal/focus | After, hover/hover + focus |
| --- | --- | --- | --- |
| White primary labels (New, Create agent, Use agent, New routine, dialog actions) | 3.327:1 | 5.176:1 | 4.686:1 |
| Command/search trigger | 4.351:1 | 5.824:1 | 5.824:1 |
| Selected Home session summary | 3.985:1 | 5.334:1 | 5.334:1 |

Before the fix, hover reduced New to 2.895:1 and primary `.btn.p` labels to 2.774:1. The darker shared filled-violet tokens replace both the light primary fill and the white hover overlay. The existing decorative violet and focus ring remain. The metadata foreground is lighter so it also works on the raised dark surfaces used by selected sessions and metadata chips. Semantic `--primary` aliases the same filled palette; GitHub import and launcher primary buttons inherit it rather than maintaining identical local overrides.

## Reproduce and verify

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm test:contrast
```

The suite uses an ephemeral loopback preview port, a fresh headless Chrome context, and a hidden Electron window bootstrapped from the production main bundle. Electron gets a disposable canonical user-data directory, a local synthetic Codex control runtime, one saved read-only agent, and one disabled routine saved through the real preload/IPC paths. Home has populated labeled sample sessions; Agents is checked with sample and saved profiles; Routines is checked with the saved routine. Command, agent-editor, routine-editor, and enable-consent dialogs are scanned. The consent action is never submitted, and the suite asserts zero routine executions.

The completed run passed 52 rendered text/state measurements and 61 axe `color-contrast` scans, including normal, hover, keyboard focus, and simultaneous hover/focus. Every targeted axe scan completed conclusively and every measured ratio exceeded 4.5:1. The measurement helper reads computed foreground and ancestor backgrounds, composites transparent fills, applies the sRGB luminance formula, and rejects gradients, opacity, filters, or blending it cannot measure reliably. Focus coverage also asserts keyboard `:focus-visible` and a computed focus indicator.

Local evidence is regenerated under ignored `artifacts/verification/text-contrast/`: `contrast.json` contains measurements, axe results, incomplete results, and failures; nine PNGs show the populated pages and dialogs. Screenshots were visually inspected for preserved palette/layout. The routine editor screenshot is scrolled to its primary action.

## Results and limits

- Passed: `pnpm typecheck`.
- Passed: `pnpm test` — 33 files, 348 tests.
- Passed: `pnpm build` — existing Vite large-chunk advisory remains.
- Passed: `pnpm test:smoke` — browser navigation/interactions plus production Electron security/bridge checks, no page errors or missing assets. Port 4173 was coordinated and released afterward.
- Passed: `pnpm test:contrast` — minimum measured ratio 4.686:1, zero axe contrast violations in the scanned states.
- Expected failure before the fix: the complete new suite recorded 52 measurements, 61 scans, and 112 failed measurements/scan summaries. All three published R09 ratios were reproduced.

Page-wide axe scans retain incomplete results for the profile initial, gradient greeting, sample activity pseudo-elements/citations, and partially clipped/overlapping dialog labels after scrolling. These are recorded as incomplete, not passes; none are the targeted reported controls. Disabled controls are outside the enabled-text assertion. This evidence addresses the reported contrast combinations, not full WCAG conformance, zoom/layout acceptance (issue 61), other platform rendering, or real provider/account access.
