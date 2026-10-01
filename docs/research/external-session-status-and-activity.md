# External Session status and activity: vendor sources

Date: 2026-09-30. Question: how to tell that a Claude Code or Codex Session started outside Argo is mid-turn, and get a one-line activity summary, without parsing JSONL ourselves.

## Source inventory

Codex source links pin to `openai/codex` commit `60947e2` (main when read). Lines were also checked against tag `rust-v0.159.2` where noted.

| # | Source | What it says | Q |
|---|---|---|---|
| 1 | [Claude docs: agent view](https://code.claude.com/docs/en/agent-view) | `claude agents --json` is "the supported way to read session state from outside Claude Code"; fields `status` busy/waiting/idle, `waitingFor`, `state`. | 1 |
| 2 | [Claude docs: hooks](https://code.claude.com/docs/en/hooks) | 32 hook events incl. UserPromptSubmit, Stop, StopFailure, Notification; user-level `~/.claude/settings.json` hooks apply to all sessions. | 1, 5 |
| 3 | [claude-code CHANGELOG.md](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md) | History of `claude agents --json` (2.1.145 added; later `waitingFor`, `state`, `--all`). Mentions `~/.claude/sessions` only as a cleanup fix. | 1 |
| 4 | [claude-code #87131](https://github.com/anthropics/claude-code/issues/87131) | Registry `status` stuck at `busy` after parking a mid-flight turn. Closed by stale bot, not fixed. Bug confirmed by a Claude reply on 2.1.234. | 1 |
| 5 | [claude-code #96438](https://github.com/anthropics/claude-code/issues/96438) | `~/.claude/sessions/<pid>.json` sometimes has a stray trailing `}` (invalid JSON). Open. | 1 |
| 6 | [claude-code #64036](https://github.com/anthropics/claude-code/issues/64036) | Reporter treats `sessions/<pid>.json` `.status` as ground truth; text-classifier `state` is stale. Open. | 1 |
| 7 | Local: `claude agents --json`, `~/.claude/sessions/*.json` (CLI 2.1.285) | Run here. Lists interactive sessions with `status`. Registry has the fields we listed. | 1 |
| 8 | Local: `@anthropic-ai/claude-agent-sdk` 0.3.278 `sdk.d.ts`, `sdk-tools.d.ts` | No busy field on `SDKSessionInfo`; `getSessionMessages` head-based paging; Bash input has `description?`. | 1, 2 |
| 9 | [claude-agent-sdk-typescript #426](https://github.com/anthropics/claude-agent-sdk-typescript/issues/426) | Asks for streaming reads of big `SessionStore` transcripts. Not a tail read. Open. | 2 |
| 10 | [claude-agent-sdk-typescript #387](https://github.com/anthropics/claude-agent-sdk-typescript/issues/387) | `getSessionMessages()` lags a live session's last turn by ~100 ms. Open. | 2 |
| 11 | Searches in claude-agent-sdk-typescript issues: "tail", "running", "busy" | No issue asks for newest-turn-only or for a busy flag. Dead end. | 2 |
| 12 | [codex thread_processor.rs:5805-5836](https://github.com/openai/codex/blob/60947e234156ac12bdb7fba2477d3965f166bd34/codex-rs/app-server/src/request_processors/thread_processor.rs#L5805-L5836) | Rewrites a reconstructed `inProgress` turn to `interrupted` unless this server sees a live turn. | 3 |
| 13 | [codex thread_history_projection.rs:23-68](https://github.com/openai/codex/blob/60947e234156ac12bdb7fba2477d3965f166bd34/codex-rs/app-server-protocol/src/protocol/thread_history_projection.rs#L23-L68) | `TurnStarted` line gives `InProgress`; `TurnComplete` gives Completed/Failed; `TurnAborted` gives Interrupted. | 3 |
| 14 | [codex thread_status.rs:113-115, 290-304, 384-387](https://github.com/openai/codex/blob/60947e234156ac12bdb7fba2477d3965f166bd34/codex-rs/app-server/src/thread_status.rs) | Status is in-memory per server; unknown thread is `NotLoaded`. | 3, 4 |
| 15 | [codex app-server-daemon README](https://github.com/openai/codex/blob/60947e234156ac12bdb7fba2477d3965f166bd34/codex-rs/app-server-daemon/README.md) | Daemon is "experimental"; TUI attaches implicitly, else starts an embedded server. | 4 |
| 16 | [codex tui startup_orchestration.rs:302-312, 494-499](https://github.com/openai/codex/blob/60947e234156ac12bdb7fba2477d3965f166bd34/codex-rs/tui/src/startup_orchestration.rs) | TUI probes the default daemon socket unless `--no-daemon` or an exclusion applies. | 4 |
| 17 | [codex features/src/lib.rs](https://github.com/openai/codex/blob/60947e234156ac12bdb7fba2477d3965f166bd34/codex-rs/features/src/lib.rs) | `daemon_auto_start` is Stable, default on. `hooks` is Stable, default on. | 4, 5 |
| 18 | [codex exec/src/lib.rs](https://github.com/openai/codex/blob/60947e234156ac12bdb7fba2477d3965f166bd34/codex-rs/exec/src/lib.rs) | `exec` uses `InProcessAppServerClient`, with no daemon mention. | 4 |
| 19 | [codex tui agents_overview.rs](https://github.com/openai/codex/blob/60947e234156ac12bdb7fba2477d3965f166bd34/codex-rs/tui/src/app/agents_overview.rs) | `codex agents` is a "daemon-wide overview"; groups by `ThreadStatus`. Shows only threads the daemon knows. | 4 |
| 20 | [codex #41014](https://github.com/openai/codex/issues/41014), [#41112](https://github.com/openai/codex/issues/41112), [#31991](https://github.com/openai/codex/issues/31991) | Desktop only uses the shared daemon with `CODEX_APP_SERVER_USE_LOCAL_DAEMON=1`, and a Desktop update regressed it to private stdio. Open. | 4 |
| 21 | [codex #35542](https://github.com/openai/codex/issues/35542) | App and VS Code extension register thread ownership on `~/.codex/ipc/ipc.sock`; TUI does not. Open. | 4 |
| 22 | [codex #25914](https://github.com/openai/codex/issues/25914) | Asks for a documented way to find and attach to the active Desktop thread. Open, no answer. | 4 |
| 23 | [codex #38883](https://github.com/openai/codex/issues/38883) | Proposes mapping `thread/status/changed` into the VS Code sessions list. Shows the status contract exists. Open. | 4 |
| 24 | [codex #37398](https://github.com/openai/codex/issues/37398) | Confirms the IPC router fans "thread-owner-discovery" out to every client on `ipc.sock`. Open. | 4 |
| 25 | [Codex docs: app-server](https://developers.openai.com/codex/app-server) (redirects to learn.chatgpt.com) | `thread/status/changed` "emitted whenever a loaded thread's runtime status changes"; `thread/turns/list` is experimental. | 3, 4 |
| 26 | [Codex docs: hooks](https://developers.openai.com/codex/hooks) (same redirect) | Events incl. UserPromptSubmit, Stop, Interrupt; docs do not say which surfaces run hooks. | 5 |
| 27 | Searches: openai/codex issues "thread notLoaded running", "external thread status running another process" | No matching issue. Dead end. | 3, 4 |
| 28 | Fetch of `learn.chatgpt.com/docs/config-advanced` (`notify`) | HTTP 404. Dead end. | 5 |

Method note: sources 15, 25 and 26 were read through a summarising fetch tool, so quotes from them are the tool's rendering. Quotes from GitHub code, issues and local files are verbatim.

## Q1. Claude: can we know an external session is mid-turn?

**Answer: yes, through `claude agents --json`, which is documented and supported. The `~/.claude/sessions/<pid>.json` registry is what it reads, but the registry itself is not documented and has known bugs.**

What is documented (Confirmed):
- Source 1: "`claude agents --json` is the supported way to read session state from outside Claude Code, for example from a status bar, a scheduler, or another Claude session that supervises background work."
- Source 1 field table: "`pid`, `status` | While the process is alive | Process ID and one of `busy`, `waiting`, or `idle`". And "`waitingFor` | When `status` is `waiting` | ... `permission prompt` ... `input needed` ... `sandbox request` ... `worker request`, or `dialog open`".
- Meaning of `busy`: source 1 says `status` "tells you whether its process is `busy` right now". The doc gives no finer definition. Unconfirmed: exact trigger points for busy/idle.
- Changelog 2.1.145: "Added `claude agents --json` to list live Claude sessions as JSON for scripting (tmux-resurrect, status bars, session pickers)".
- Local run (source 7, Confirmed): 37 entries, including 14 `kind: interactive` (13 `idle`, 1 `busy`) with `pid`, `cwd`, `sessionId`, `name`, `status`. Interactive entries carry no `summary` or activity text.
- Caveat (Confirmed, source 1): the doc says "Interactive sessions you have open in other terminals don't appear until you background them". That sentence is about the agent view UI. The local JSON run did list interactive sessions, so trust the run, and re-test per CLI version.

The registry (`~/.claude/sessions/<pid>.json`):
- Documentation: not found in docs, CLI reference, or the changelog, apart from one cleanup fix in 2.1.145 ("Fixed headless sessions not cleaning up stale entries in `~/.claude/sessions`") and one `/rename` line ("session registry could not be updated"). Unconfirmed that it is meant as public. Source 1 only calls `~/.claude/jobs/<id>/` files "not a stable interface".
- Contents seen locally (Confirmed, source 7): `pid, sessionId, cwd, startedAt, procStart, version, peerProtocol, peerFeatures, kind, entrypoint, pidDomain, messagingSocketPath, name, nameSource, updatedAt, status, statusUpdatedAt, bridgeSessionId`.
- Stability problems (Confirmed, issues):
  - #87131: "Parking a turn that is **mid-flight** rewrites the interactive session's probe file ... but leaves `status: "busy"` in place". Two sessions sat "working" for 22h and 32h. A Claude reply on 2.1.234 reproduced it, and `claude agents --json` kept listing the session. So the supported command inherits the bug.
  - #96438: a stray trailing `}` makes the file invalid JSON, persistently.
  - #87131 uses "the documented way to know what a session is doing" for the probe files. That is the reporter's wording, not a vendor statement.
- Design guard from #87131: a busy entry whose `updatedAt` is newer than `statusUpdatedAt`, or that has `parkedJobId`, is suspect. Genuinely busy probes had `updatedAt == statusUpdatedAt`.

Peer socket and `notify_idle`:
- `messagingSocketPath` (`/tmp/cc-socks/<pid>.sock`) and `peerFeatures: ["notify_idle", ...]` appear in the registry. The changelog mentions "cross-session peer messages" (line 2075) and #24798 (closed) asked for inter-session messaging. No doc describes the wire protocol or `notify_idle`. Unconfirmed what it does. Do not build on it.

Hooks: see Q5.

## Q2. Claude: cheap newest-turn read, and tool `description` as summary

**Answer: no tail read exists and no issue asks for one. The Bash `description` is in the transcript tool_use input, but the SDK does not surface it as a summary for external sessions.**

- Confirmed (source 8, `sdk.d.ts:836-852`): `GetSessionMessagesOptions` has `dir`, `limit` ("Maximum number of messages to return."), `offset` ("Number of messages to skip from the start."), `includeSystemMessages`. No negative offset, no `fromEnd`, no `turn` option.
- Searches of claude-agent-sdk-typescript issues (source 11) found nothing asking for tail or newest-turn reads. Closest: #426 (streaming `SessionStore.load`, about memory on resume) and #387 (latency of the last turn). Neither is a tail API.
- `SDKSessionInfo` (`sdk.d.ts:5486-5530`) has `summary` (title, not activity), `lastModified`, `fileSize`, `cwd`, `gitBranch`, `firstPrompt`. No activity or busy field. Confirmed.
- Bash input (Confirmed, `sdk-tools.d.ts:790-812`): `command: string;` and `description?: string;`. The docstring tells the model to write a "Clear, concise description of what this command does in active voice". It is optional, so fall back to `command`.
- Live-only summaries (Confirmed, `sdk.d.ts:5675-5700, 5796-5802`): `task_progress.summary` ("model-generated progress summary (only when the agentProgressSummaries option is on)") and `tool_use_summary.summary` are stream messages from a `query()` you run. They are not in `getSessionMessages` output. Unconfirmed that they are written to the transcript.
- `session_state_changed` with `state: 'idle' | 'running' | 'requires_action'` (`sdk.d.ts:5528-5538`) exists, but only as a stream message for a query you own. It does not observe other processes. Confirmed.

## Q3. Codex: newest Turn status for a thread running in ANOTHER process

**Answer: `interrupted`, not `inProgress`. The app-server deliberately rewrites any rollout-derived `inProgress` turn to `interrupted` unless this same server sees the turn running.**

Code path (Confirmed, source 12, `thread_processor.rs`, same logic at tag 0.159.2 lines 5811-5822):
1. `thread_turns_list_response_inner` (line 3073) reads the rollout and calls `build_thread_turns_page_response` (5752).
2. Line 3129: `has_live_running_thread` is true only if `thread_manager.get_thread(...)` finds the thread loaded in THIS server and its `agent_status()` is `Running`. Otherwise false.
3. `reconstruct_thread_turns_for_turns_list` (5805) builds turns, then calls `normalize_thread_turns_status` (5823).
4. `normalize_thread_turns_status` (5823-5836):
   ```rust
   let status = resolve_thread_status(loaded_status, has_live_in_progress_turn);
   if matches!(status, ThreadStatus::Active { .. }) { return; }
   for turn in turns {
       if matches!(turn.status, TurnStatus::InProgress) {
           turn.status = TurnStatus::Interrupted;
   ```
5. `loaded_status` comes from the in-memory watch manager (source 14, `thread_status.rs:384-387`): `unwrap_or(ThreadStatus::NotLoaded)`. A thread owned by another process is never loaded here, so it is `NotLoaded`, and `resolve_thread_status` (290-304) only upgrades to Active when `has_in_progress_turn` is true.
- Where raw `InProgress` comes from (Confirmed, source 13, `thread_history_projection.rs:23-28`): a `TurnStarted` rollout line maps to `TurnStatus::InProgress`. `TurnAborted` maps to `Interrupted` (56-64).
- Consequence: `thread/turns/list` cannot tell "running elsewhere" from "crashed mid-turn". Our measured `notLoaded` from `thread/list` matches step 5.
- Source 25 says `thread/turns/list` "is marked as experimental".

Practical reading of the rollout tail (our inference, Unconfirmed by vendor): the last turn is `interrupted` and its last rollout line is `TurnStarted` or an item, with no `TurnAborted`/`TurnComplete`. Combine with file mtime and the writer lock to guess "running". The lock is held after the turn ends (your measurement), so it only says "process has the thread open".

## Q4. Codex: observing threads run by another process

**Answer: only by sharing one app-server. A client sees live status for a thread only if the thread is loaded in the server it talks to. There is no supported cross-process status query. Clients do not all share the daemon, and no issue shows a plan to make them do so.**

- `thread/status/changed` (Confirmed, source 25): "emitted whenever a loaded thread's runtime status changes". `thread/loaded/list` "returns thread IDs currently loaded in memory". Both are per-server. The docs do not address multiple processes (per the fetch summary).
- Shared daemon clients (Confirmed from code unless noted):
  - TUI: attaches implicitly. Source 16 lines 302-312 probe the default daemon socket when there is no `--remote` and reuse is allowed. Line 494-499 auto-starts the daemon when feature `daemon_auto_start` is on, which is `Stable`, `default_enabled: true` (source 17). Source 15: "If an implicitly discovered daemon cannot initialize the connection, the TUI starts an embedded server instead." `CODEX_EXEC_SERVER_URL` and `--no-daemon` skip it.
  - `codex exec`: in-process client (source 18). No daemon code found. Unconfirmed that exec never attaches; we read only `exec/src/lib.rs` lines matching "daemon|embedded|InProcess".
  - ChatGPT Desktop: private stdio app-server by default. The shared daemon needs `CODEX_APP_SERVER_USE_LOCAL_DAEMON=1`, and #41014 / #41112 report that a 26.820 update ignores it even then (still open, 2026-08-27). Issue comments: "Desktop keeps a private stdio app-server when `codex_app` / `CODEX_APP_TOOLS_PIPE_PATH` is injected".
  - VS Code / Cursor extension: closed source. #35542 says the extension and App "register as the owner of its loaded thread" on `$CODEX_HOME/ipc/ipc.sock`. Whether the extension uses the daemon is Unconfirmed.
- Discrepancy with our measurement: code says the TUI uses the daemon by default, but our TUI threads showed `notLoaded` on the shared daemon. Possible causes (Unconfirmed): the TUI was started with `--no-daemon`/`CODEX_EXEC_SERVER_URL`, the daemon was started after the TUI, or 0.157 predates this behavior. Re-test with a TUI started after `codex app-server daemon start`.
- `codex agents` (source 19): "Daemon-wide overview of recent and locally retained sessions and their subagents", grouped by `ThreadStatus`. It shows only what the daemon has loaded, so it has the same blind spot. It is also the TUI with `--agents-overview`, not a script API.
- IPC `~/.codex/ipc/ipc.sock`: a same-user router used by App and extension for thread-owner discovery and follower requests (#35542, #37398). It is not documented. #37398 says the router fans discovery out to all clients, and "the open TUI client uses" a negative response shape in `codex-rs/tui/src/ide_context/ipc.rs`. Unconfirmed that it exposes turn status. Do not build on it.
- Remote control: `codex app-server daemon enable-remote-control` is for ChatGPT mobile and desktop (source 15). No evidence it reports other processes' threads.
- Requests and plans:
  - #25914 (2026-06-02, open): asks for "a supported, documented app-server path" to find the active Desktop thread and whether "there is an in-flight turn". It reports `thread/loaded/list` returning zero. No maintainer answer.
  - #35542 (open): asks the TUI to register as thread owner on the IPC router.
  - #11907 (open, since 2026-02): the App does not show live CLI turns.
  - No issue or doc found announcing that Desktop, extension and exec will all join one daemon. Searches: "app-server daemon", "shared app-server", "thread/status/changed", "ipc.sock". Unconfirmed that none exists.
- The daemon README calls itself "experimental and its lifecycle contract may change".

Design reading (inference): an Argo-owned daemon connection would see TUI threads only if each TUI attaches to that same daemon. Desktop and extension threads will stay invisible. For those, file-based signals remain the only option.

## Q5. Anything else that changes the design

**Answer: hooks are the vendor-supported push signal for both harnesses, and `claude agents --json` is the vendor-supported poll for Claude. Codex has no poll equivalent.**

Claude hooks (Confirmed, source 2):
- Events include `UserPromptSubmit` ("When you submit a prompt, before Claude processes it"), `Stop` ("When Claude finishes responding"), `StopFailure` ("When the turn ends due to an API error"), `Notification`, `PreToolUse`, `PostToolUse`, `PermissionRequest`, `SessionStart`.
- Scope table: `~/.claude/settings.json` hooks apply to "All your projects". So an Argo-installed user-level hook could report turn start and stop for every session, including external ones, plus `PreToolUse` input with `command` and `description` for the one-line summary. Installing it edits the user's settings, which is intrusive. Unconfirmed: hook input field names (read the hooks reference before use).
- Hooks do not report an interrupted turn (Esc). `Stop` does not fire on user interrupt in our recollection. Unconfirmed, test it.

Codex hooks (source 26; fetch tool rendering):
- Events: SessionStart, SessionEnd, PreToolUse, PostToolUse, PermissionRequest, PreCompact, PostCompact, UserPromptSubmit, SubagentStart, SubagentStop, Stop, Interrupt. `UserPromptSubmit`, `Stop` and `Interrupt` carry `turn_id` and `session_id`. `Stop` has `last_assistant_message`.
- Feature `hooks` is `Stable`, default on (source 17). Doc warning: "Treat tool hooks as a useful guardrail, not a complete enforcement boundary."
- The docs do not say which surfaces (TUI, exec, extension, Desktop) run hooks. Unconfirmed.
- A global hooks file would again change user config. Same intrusion trade-off as Claude.

Other points:
- Claude `claude agents --json` `waitingFor` gives "permission prompt" or "input needed", which maps to a needs-input state for free.
- Claude changelog line 2965: sessions "waiting on a sandbox, MCP-input, or managed-settings prompt now show as 'Needs input' instead of 'Working'". Shows the status semantics are still changing, so pin behavior to a CLI version range.
- Claude #64036 (open): the job `state` (text classifier) is stale while `status` is live. Prefer `status` for "working now".
- Codex `thread/turns/list` replays the entire rollout on every call (comment in `thread_processor.rs` near line 3120: "it still replays the entire rollout on every request"). With `limit:1` it is not cheap for long threads. Confirmed.
- Codex session file locks: `codex-rs/rollout/src/writer_lock.rs` exists. We did not read it; your measurement that the lock outlives the turn stands. Unconfirmed vendor intent.
