# Electron as the desktop runtime

**Context.** The cockpit is a native-feeling desktop app that must host real interactive terminals and a React/shadcn UI. Going greenfield (ADR-0001) reopened the runtime choice — there is no inherited shell. Tauri was a serious contender because its lighter RAM footprint directly serves the low-spec hard constraint.

**Decision.** Build on **Electron** (Chromium + Node main), all-TypeScript end to end.

**Why.** Argo is terminal-first: `node-pty` + `xterm.js` is the core organ, and Electron is where that combination is most proven (the VS Code path). Tauri's PTY story (`portable-pty` / community plugins) is thinner, and betting the central feature on it is a worse "done properly" violation than the RAM cost. The low-spec constraint's real costs are the GPU orb and N concurrent PTYs — neither changes with the shell — so they get mitigated by GPU-tier scaling, not by the runtime choice. All-TypeScript also keeps velocity high; the heavy processes (voice model, router) run as sidecars regardless.

**Consequences.** Heavier RAM baseline than Tauri; accepted and mitigated at the orb/GPU and PTY-concurrency layers, not the shell. Rust is off the table for the app shell.
