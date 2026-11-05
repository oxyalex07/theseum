# Repository map

The working app is now a TypeScript React + Vite renderer with an Electron main process and narrow preload bridge. See `README.md` for installation, browser/Electron commands, verification, architecture, and incomplete features.

- `src/`: reusable React screens, components, typed demo model, mock data, Tailwind and preserved prototype styles.
- `electron/`: native lifecycle, validated IPC, Codex JSONL adapter, process lifecycle/cancellation, and output projection/redaction.
- `shared/`: typed desktop bridge contract.
- `public/assets/brand/`: Theseus sail-and-sun logos and browser icons.
- `reference/orbit/`: the original standalone `orbit-app.html` prototype, scripts, CSS, assets, and metadata, preserved unchanged.
- `scripts/`: Electron build and combined development launcher.
- `tests/`: model/security/agent-protocol tests, production browser/Electron smoke checks, and explicit real-Codex Electron verification (`pnpm test:agent`).

Generated `dist/`, `dist-electron/`, dependency directories, and verification artifacts are ignored by Git. The separate Crew and Mission Control predecessor prototypes were removed after the approved audit; the app's Crew screen is preserved as a React page.
