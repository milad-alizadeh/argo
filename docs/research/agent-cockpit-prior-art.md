# Agent cockpit prior art: external Sessions and status

Researched 2026-10-01. Stars and dates come from the GitHub API on that day. Open source repos were cloned and grepped. Closed products are judged from docs only.

Labels: **Confirmed** means a cited source says it. **Unconfirmed** means inferred or second-hand.

## Inventory

"External" means the tool shows Sessions it did not start.

| Product | External Sessions? | Status source | Activity source | Harnesses |
| --- | --- | --- | --- | --- |
| [agentsctl](https://github.com/tingtt/agentsctl) (TUI, small) | Partly. Codex: yes, any thread on the shared app-server; dormant or outside threads need a writer-lock check. Claude: only background sessions | `claude agents --json --all`; Codex `thread/list`, `thread/status/changed`, writer lock | Claude `summary` field from `claude agents`; Codex native thread data | Claude, Codex |
| [Claude Code agent view](https://code.claude.com/docs/en/agent-view) (vendor) | No. Open terminals do not appear until backgrounded | Per-user supervisor daemon | Supervisor state per session | Claude |
| Codex `codex agents` and [app-server daemon](https://github.com/openai/codex/blob/main/codex-rs/app-server-daemon/README.md) (vendor) | Only threads on the shared daemon | App-server `ThreadStatus` | App-server events | Codex |
| [VS Code Agents window](https://code.visualstudio.com/docs/agents/run/sessions/manage-sessions) (vendor) | Yes, hidden by default. Adopted on first message | Disk scan, once at startup ([#335215](https://github.com/microsoft/vscode/issues/335215)). Status for external is not documented | Transcript content from disk | Copilot CLI, Claude, Codex |
| [Warp](https://docs.warp.dev/agents/cli-agents/overview/) (closed) | Only agents run in Warp terminals | Plugin hooks (Claude), Codex config notify | Same hook events | Claude, Codex, others |
| [cmux](https://github.com/manaflow-ai/cmux) (27.5k stars, v0.64.25, 2026-09-17) | Only agents run in its terminals | Hooks installed into Claude and Codex config, sent to cmux CLI | Hook payloads plus Codex transcript monitor | Claude, Codex, more |
| [Superset](https://github.com/superset-sh/superset) (14.8k, desktop v1.33.0, 2026-09-30) | No, its own terminals | Hooks call local HTTP `/hook/complete` | Hook events | Claude, Codex, more |
| [Claude Squad](https://github.com/smtg-ai/claude-squad) (8.6k, v1.0.20, 2026-08-20) | No, spawns in tmux | tmux `capture-pane`, hash diff, prompt string match | Pane text as preview | Claude, Codex, Amp, OpenCode |
| [CCManager](https://github.com/kbwo/ccmanager) (1.3k, v4.4.4, 2026-09-27) | No, own PTYs | Terminal screen parsing per harness | Screen text | 8 CLIs incl. Claude, Codex |
| [coder/agentapi](https://github.com/coder/agentapi) (1.5k, archived 2026-09-13) | No, wraps one agent in a PTY | Screen stability tracking | Screen snapshot | Claude, Codex, others |
| [Vibe Kanban](https://github.com/BloopAI/vibe-kanban) (28k, v0.1.44, 2026-04-24) | No. **Sunsetting** per README | Own spawned process | Claude `--output-format=stream-json` | Claude, Codex, more |
| [Crystal](https://github.com/stravu/crystal) (3.1k, v0.3.5, 2026-02-26), now Nimbalyst | No for live. Nimbalyst has a manual "Import Claude Code Sessions" | Own PTY and DB | Own stream; import reads Claude disk storage ([docs](https://docs.nimbalyst.com/session-management/import-claude-code-sessions)) | Claude, Codex |
| [Opcode](https://github.com/winfunc/opcode) (22k, v0.2.0, 2025-08-31) | History only. Lists `~/.claude/projects` | Own process registry for spawned runs | Reads `.jsonl` for history | Claude |
| [CloudCLI / claudecodeui](https://github.com/siteboon/claudecodeui) (13.9k, v1.37.3, 2026-09-08) | Yes, as history. Scans and watches transcript dirs | None for live state found | Transcript parse | Claude, Codex, more |
| [Sculptor (Imbue)](https://github.com/imbue-ai/sculptor) (233, v0.48.0, 2026-09-21) | No. Agents run in its containers | Own harness (Claude Code SDK) | SDK stream | Claude |
| [Conductor](https://www.conductor.build/) (closed) | Unconfirmed. Docs describe its own workspaces | Unconfirmed | Unconfirmed | Claude, Codex |
| [Omnara](https://github.com/omnara-ai/omnara) (2.9k, v0.1.31, 2026-09-30) | No. Now a managed-agents platform | Own platform | Own platform | Model-agnostic |
| [Terragon](https://github.com/terragon-labs/terragon-oss) (259) | No. Cloud agents. Repo is only the old site | Dead end | Dead end | Claude, Codex |
| [ccusage](https://github.com/ryoppippi/ccusage) (18.8k, v20.0.26, 2026-09-27) | Yes, but cost only | None. No live state | Reads Claude and Codex JSONL | Claude, Codex |
| [Claude-Code-Usage-Monitor](https://github.com/Maciek-roboblog/Claude-Code-Usage-Monitor) (8.7k, v4.0.0, 2026-06-27) | Yes, usage only (Unconfirmed, not opened) | None | Transcript usage | Claude |
| Cursor agent panel | Unconfirmed. Not researched in depth | Unconfirmed | Unconfirmed | Cursor agents |

## Q1. Which programs act as a multi-session cockpit?

Answer: about a dozen. Only Claude Code, Codex and VS Code are vendor products. The rest are third parties. Most third parties manage Sessions they spawn or host. See the table.

- Confirmed: terminal multiplexers (Claude Squad, CCManager, cmux, Warp, Superset) host the agent in their own terminal.
- Confirmed: Vibe Kanban says it is sunsetting ([README](https://github.com/BloopAI/vibe-kanban)). Crystal is replaced by Nimbalyst ([repo description](https://github.com/stravu/crystal)). agentapi is archived.
- Confirmed: agentsctl is the closest match to Argo. It lists Claude and Codex in one Agent View using vendor APIs only ([README](https://github.com/tingtt/agentsctl/blob/main/README.md)).
- Unconfirmed: Conductor, Cursor, and Claude-Code-Usage-Monitor internals.

## Q2. External Sessions, and how status and activity are found

Answer: almost nobody shows live external Sessions. Three exceptions read disk or vendor APIs.

**Vendor tools**
- Claude agent view hides foreground terminals. Quote: "Interactive sessions you have open in other terminals don't appear until you background them" ([docs](https://code.claude.com/docs/en/agent-view)). Confirmed.
- `claude agents --json` is the documented read path. Fields: `state`, `status` (`busy`, `waiting`, `idle`), `waitingFor`, `pid`, `sessionId`. Docs say to use it "rather than the files under `~/.claude/jobs/`". The docs say it omits interactive sessions. Confirmed.
- `~/.claude/sessions/<pid>.json` exists and holds pid, sessionId, cwd, name, kind, entrypoint, startedAt, status. It covers terminal sessions. It is not in the docs: "The file format is internal" ([claude-vitals #1](https://github.com/jancimertel/claude-vitals/issues/1)). Known bugs: [#36213](https://github.com/anthropics/claude-code/issues/36213) (`/clear` leaves a stale sessionId), [#96438](https://github.com/anthropics/claude-code/issues/96438) (stray `}`). Confirmed from issue titles and that thread. Whether `claude agents --json` itself lists these rows was not confirmed. Docs say no.
- VS Code scans disk catalogs such as `~/.claude/projects` once at startup, so later sessions never appear ([#335215](https://github.com/microsoft/vscode/issues/335215), open). For external Codex it is read-only while another app owns the chat ([docs](https://code.visualstudio.com/docs/agents/run/sessions/manage-sessions)). Confirmed.

**Hook-based hosts**
- cmux installs `SessionStart`, `Stop`, `UserPromptSubmit` and more into Claude settings ([source](https://github.com/manaflow-ai/cmux/blob/main/CLI/CMUXCLI%2BClaudeHookSettings.swift)). It also keeps a Codex transcript monitor ([CodexTranscriptMonitorStopReplay.swift](https://github.com/manaflow-ai/cmux/blob/main/CLI/CodexTranscriptMonitorStopReplay.swift)). Confirmed.
- Superset's local server takes hook calls at `/hook/complete` ([server.ts](https://github.com/superset-sh/superset/blob/main/apps/desktop/src/main/lib/notifications/server.ts)). Confirmed.
- Warp uses a Claude plugin and Codex config for notifications ([docs](https://docs.warp.dev/agents/cli-agents/overview/)). Confirmed.

**Screen scrapers**
- Claude Squad hashes `tmux capture-pane` output and looks for the string "No, and tell Claude what to do differently" ([tmux.go](https://github.com/smtg-ai/claude-squad/blob/main/session/tmux/tmux.go)). Confirmed.
- CCManager has a per-harness state detector with an idle debounce, because Claude "appears idle in terminal output while still actively processing" ([claude.ts](https://github.com/kbwo/ccmanager/blob/main/src/services/stateDetector/claude.ts)). Confirmed.

**Own-process streams**
- Vibe Kanban launches Claude with `--output-format=stream-json` ([claude.rs](https://github.com/BloopAI/vibe-kanban/blob/main/crates/executors/src/executors/claude.rs)). Sculptor uses the Claude Code SDK in its harness. Confirmed.

**Disk readers**
- CloudCLI scans `~/.claude/projects` and `~/.codex/sessions` and polls them with chokidar every 6 s ([sessions-watcher.service.ts](https://github.com/siteboon/claudecodeui/blob/main/server/modules/providers/services/sessions-watcher.service.ts)). Confirmed. It gives history, not live state.
- Opcode reads `~/.claude/projects/*.jsonl` for history ([agents.rs](https://github.com/winfunc/opcode/blob/main/src-tauri/src/commands/agents.rs)). Confirmed.
- ccusage reads Claude and Codex JSONL for cost only. Confirmed.
- Nimbalyst imports CLI sessions by scanning Claude storage, on demand. Confirmed from docs.

**agentsctl, in detail** (same problem as Argo)
- Claude: runs `claude agents --json --all` ([provider.go](https://github.com/tingtt/agentsctl/blob/main/internal/provider/claude/provider.go)). Summary comes from the `summary`, `description` or `lastMessage` fields. Confirmed.
- Codex: maps `ThreadStatus` to Working, NeedsInput, Idle, Failed ([activity.go](https://github.com/tingtt/agentsctl/blob/main/internal/provider/codex/activity.go)). For `notLoaded`, it checks the thread writer lock. No lock means dormant. A lock means a runtime outside the daemon, shown as Unknown and External. Confirmed. This is the same writer-lock trick Argo uses.
- It keeps no copy of transcripts (DesignDoc, "agentsctl は native session record や transcript を複製せず"). Confirmed.
- Its Codex path needs a shared app-server that Codex TUIs connect to. A plain terminal Codex that runs its own embedded server stays "outside". Its Codex support needs CLI 0.156.1 or later.

## Q3. Is there a common pattern that avoids file scanning?

Answer: yes, two. Nobody has a clean third one for external Sessions.

1. **Own what you spawn** (Claude Squad, CCManager, Vibe Kanban, Sculptor, Crystal, Superset terminals, agentapi). Status is exact, because you hold the pty or stream. Cost: you never see Sessions started elsewhere. Screen scraping is brittle. Both CCManager and Claude Squad carry workarounds for false idle and string matching.
2. **Install hooks that report to the app** (cmux, Superset, Warp). Works for a Session only if the hook was present when it started. Covers Sessions in any terminal if hooks live in global settings. Costs: edits the user's vendor config, hooks may not fire (issue [#94620](https://github.com/anthropics/claude-code/issues/94620): "Fragile and relies on reliable hook firing", background task hooks "don't fire reliably"), needs pid matching, and misses Sessions that predate install. Even cmux keeps a Codex transcript monitor as a backstop. Confirmed.
3. **Use the vendor's own listing** (agentsctl, `claude agents --json`, Codex app-server). Cleanest, but each vendor scopes it: Claude to background sessions, Codex to the queried app-server.

Files are still the norm for history. For live external status, the only tools that cover it read the pid registry (community tools such as claude-vitals, SESH_MAN) or scan disk once (VS Code). Disk scanning also has a known cost: VS Code's scan goes stale ([#335215](https://github.com/microsoft/vscode/issues/335215)).

## Q4. Supported cross-process status API from Anthropic or OpenAI?

Answer: partly. Nothing supported covers every live external Session for either vendor.

**Anthropic**
- Supported today: `claude agents --json` for background sessions, plus hooks and the Agent SDK. Confirmed ([agent view docs](https://code.claude.com/docs/en/agent-view), [hooks](https://code.claude.com/docs/en/hooks)).
- Requested, open, no Anthropic reply: [#94620](https://github.com/anthropics/claude-code/issues/94620) (2026-09-16, labels `area:agent-view`, `area:hooks`) asks for a documented way to list running sessions and their state. Related: [#76437](https://github.com/anthropics/claude-code/issues/76437) Session API, [#88511](https://github.com/anthropics/claude-code/issues/88511), [#38494](https://github.com/anthropics/claude-code/issues/38494), [#35607](https://github.com/anthropics/claude-code/issues/35607). Titles confirmed; bodies not all read.
- The pid registry is undocumented and buggy (see Q2). Treat it as internal.
- Separate: the hosted [Managed Agents Sessions API](https://platform.claude.com/docs/en/api/beta/sessions/list) has `running` and `idle`. It is for cloud sessions, not local ones. Confirmed, not applicable.

**OpenAI**
- Supported: app-server `thread/list`, `thread/loaded/list`, `thread/read`, `thread/status/changed`. Status values `notLoaded`, `idle`, `active` (with `waitingOnApproval` and similar flags), `systemError` ([docs](https://learn.chatgpt.com/docs/app-server)). Confirmed.
- Limit: `notLoaded` only means this app-server does not have it loaded. Docs do not say whether threads run by other processes are visible. Unconfirmed in docs, and the agentsctl code treats it as unknown.
- `codex agents` and the app-server daemon exist from about v0.149 (secondary source, [daniel vaughan](https://codex.danielvaughan.com/2026/04/12/codex-cli-remote-development-app-server-websocket/), Unconfirmed). The daemon README says a TUI falls back to an embedded server if it cannot connect. Confirmed. So terminal TUIs may not share one.
- Open requests with no OpenAI reply: [#35676](https://github.com/openai/codex/issues/35676) (read-only subscriber presence, 2026-07-27) and [#38883](https://github.com/openai/codex/issues/38883) (VS Code live status, 2026-08-16). The first says today's workarounds are "SQLite inspection or file timestamps".

## Recommendation for Argo

Watching files for external Sessions is not the norm for live status. It is the norm only for history and cost (ccusage, Opcode, CloudCLI, Nimbalyst, VS Code). The products that track live status either own the process or install hooks. The one product that lists external Sessions from both harnesses (agentsctl) uses vendor listing calls and keeps a writer-lock check for Codex. It does not scan transcripts.

The owner's doubt is fair for Claude. `claude agents --json` is the supported call, but the docs say it leaves out interactive terminals. The pid registry is the only cheap source for those, and it is undocumented. For Codex, `thread/list` plus `thread/status/changed` is supported, but it cannot see a Session run in another process's embedded server. Transcript watching and the writer lock remain the fallback there.

A lower-cost option is to treat live status for external Sessions as best effort. Use vendor calls first. Show "unknown" when the vendor cannot say. Keep transcript reads only for history and the one-line summary. Add optional hooks for users who want exact status. Watch issues #94620 and #35676: if either ships, the watchers can go.
