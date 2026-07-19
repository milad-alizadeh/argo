# The cockpit backend lives in Electron's main process, not a daemon

**Context.** The cockpit must host a PTY host, an MCP server (the companion-plugin channel), the state store (roster/tree hub), and supervision of the router process. This could live in Electron's main process, or in a separate long-lived daemon the window attaches to as a client.

**Decision.** Electron's **main process is the backend**. It owns the PTY host, an in-process MCP server, the store, and spawns the router. The renderer is pure React UI over IPC. Separate processes exist only at genuine runtime boundaries: the voice model, the headless `claude`/`codex` router, and each observed session (its own PTY'd process).

**Why.** The state worth surviving a cockpit crash — the *sessions* — already survives it: they are independent PTY'd processes reattached via `--resume` (see the render-only decision). The store and MCP server are cheap to rebuild from the live sessions on relaunch, so a daemon would buy resilience for reconstructable state at the cost of a second IPC boundary and process-lifecycle management before anything runs.

**Consequences.** No headless/CLI-only mode without a future refactor — accepted, because the window is the app for the foreseeable future. If headless Argo (drive with no window, over SSH / as a service) becomes a real goal, the backend must be extracted into a daemon, which is a deliberate, non-trivial migration.
