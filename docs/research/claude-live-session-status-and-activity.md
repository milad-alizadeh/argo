# How Argo follows a live Claude Session, and what Claude tells it

Researched 2026-10-01. Code paths are under `apps/desktop/src/` unless stated. SDK version 0.3.278.

## Inventory

| Source | Finding |
| --- | --- |
| [`harnesses/claude/registration.ts:31`](../../apps/desktop/src/harnesses/claude/registration.ts) | `openLiveSession` is `claudeSessionChannelOpener(executable)`. |
| [`claude-session-channel.ts:292`](../../apps/desktop/src/harnesses/claude/session/claude-session-channel.ts) | Live Sessions run through the Agent SDK `query()` stream. No pty, no TUI. |
| [ADR-0047](../adr/0047-vendor-protocols-drive-sessions-and-owned-workflows-use-xstate.md) | Decides the SDK path. Subscription only. PTY is a deferred fallback. |
| [ADR-0024](../adr/0024-session-drive-port-two-adapters.md) | Older PTY design. Superseded in part by ADR-0047. Dead end for today's code. |
| [`claude-feed-system.ts:217`](../../apps/desktop/src/harnesses/claude/session/claude-feed-system.ts) | `session_state_changed` is received and dropped (empty Feed content). |
| [`claude-session-channel.ts:141`](../../apps/desktop/src/harnesses/claude/session/claude-session-channel.ts) | Argo makes its own running/idle status from prompt sent and `result`. |
| [`feed-row-entries.ts:110`](../../apps/desktop/src/domains/sessions/api/feed/feed-row-entries.ts) | The activity line is computed from Feed rows, not sent by Claude. |
| [sdk.d.ts:5532](../../node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts) | `SDKSessionStateChangedMessage`: idle, running, requires_action. |
| [SDK changelog](https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md) | Names `CLAUDE_CODE_EMIT_SESSION_STATE_EVENTS=1` as the switch for that event. |
| [Agent loop docs](https://code.claude.com/docs/en/agent-sdk/agent-loop) | Lists init, assistant, user, stream_event, result. Silent on `session_state_changed`. Dead end for that event. |
| [Agent view docs](https://code.claude.com/docs/en/agent-view) | Documents `claude agents --json` and `busy/waiting/idle`. Silent on SDK sessions and on `~/.claude/sessions`. |
| `~/.claude/sessions/*.json` on this machine | Real files with `entrypoint: "sdk-cli"` and `status`. Local observation only. |
| github.com/anthropics/claude-code issues | Not searched in depth. A web search returned only SDK-port issues. Unconfirmed. |

## 1. How Argo launches a live Claude Session

Answer: with the Agent SDK `query()` stream, driving the `claude` binary as a child process. It is not a pty and not a TUI. ADR-0047 chose this.

- Confirmed. `claude-session-channel.ts:292`: `const session = query({ prompt: this.messages(), options: {...} })`. The prompt is an async generator of `SDKUserMessage` (lines 156-182), so input is streaming, one Session for many prompts.
- Confirmed. Options (lines 68-82): `cwd`, `resume` (a native id), `model`, `permissionMode`, `includePartialMessages: true`, `canUseTool`, `env`. Line 296 passes `pathToClaudeCodeExecutable` from the login-shell `claude`.
- Confirmed. `cli-environment.ts:1-5` deletes `ANTHROPIC_API_KEY`: "Claude must not inherit an API key that switches its subscription sign-in to API billing."
- Confirmed. ADR-0047 line 87: "Claude authorization is subscription-only. Argo does not accept an Anthropic API key or select API billing." It adds that SDK usage "currently draws from subscription limits. Argo will use that path." Also: "A future PTY adapter will provide the fallback, but it is deferred".
- Confirmed. ADR-0024 header: the "Claude PTY driver ... no longer appl[ies]". Older text in that ADR says only interactive TUI draws the subscription. Treat that text as history.
- Confirmed. No `node-pty`, `stream-json` or hook launch in `harnesses/claude/`. The grep found `query(` only in `catalog.ts` (model list) and the channel.
- Not used: hooks. `includeHookEvents` is not set. Hook `system` messages that arrive anyway become a "hook" notification (`claude-feed-system.ts:154`).

## 2. Where status and the activity line come from today

Answer: status is made by Argo, not read from Claude. The activity line is derived from Feed rows, which come from SDK messages (live) or from history files (watched and idle Sessions).

Status (running / idle):
- Confirmed. `claude-session-channel.ts:172` emits `running` when Argo yields a prompt to the SDK. Line 246 emits `idle` when a `result` message arrives (`finishTurn`). Both go out as a Feed event `{ type: 'status' }`.
- Confirmed. `live-session-machine.ts:168-171` stores `event.body.status` from a `Harness feed` event. The supervisor then raises `Session status changed` (`live-session-supervisor-machine.ts:218` and others). `session-list.ts:337` turns that into a Session List refresh.
- Confirmed. Waiting is Argo's own: `claude-channel-controls.ts:158` emits a status when `canUseTool` asks for a permission or question. (Line seen, body not read in full. The waiting value itself is Unconfirmed.)
- Confirmed. `result` with `is_error` and no interrupt throws "Claude Session turn failed." (line 242).
- Gap. A `result` ends the turn, but the SDK says `session_state_changed: idle` is "authoritative turn-over signal" after background agents exit. Argo reports idle at `result` and can be early when background tasks still run. (Inference from sdk.d.ts:5531 and the code. Unconfirmed in a live run.)

Watched (non-live) Sessions:
- Confirmed. `main.ts:420` comment: every history write "stores its activity line from the lines the watcher read". `SessionActivities` (`session-activities.ts`) reads the newest Turn via `historyFiles.readCurrentTurn` and runs `FeedRowProjector`. Status for these is set to `unknown` (`WatchedSessionStatus`).

Activity line:
- Confirmed. `feed-row-entries.ts:108-116`: "The current Turn's latest tool call or readable thought: the one line the Feed and the Session List both draw."
- Confirmed. Live, `feed-activity.ts` (`advanceFeedActivity`) keeps the latest tool, command or file change. `claude-feed-blocks.ts:25-29` uses a tool input `description` as the label and sets `agentDescription: true`. Else it builds a label from the tool name and input.
- Confirmed. Thinking blocks become `reasoning` content (`claude-feed-blocks.ts:142`).
- Confirmed. SDK message types Argo reads live: `system` (init, task_*, status, api_retry, notification, hook_*, and more), `assistant`, `user`, `stream_event` (text deltas via `ClaudeLiveText`), `tool_progress`, `tool_use_summary`, `result`.

## 3. What the SDK stream offers

Line numbers are in `node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts`.

| Signal | Type (line) | Carries | Argo uses it? |
| --- | --- | --- | --- |
| Turn state | `SDKSessionStateChangedMessage` (5532) | `state: 'idle' \| 'running' \| 'requires_action'` | No. Dropped in `lifecycleSubtypes` (`claude-feed-system.ts:219`). Also off by default, see below. |
| End of turn | `SDKResultMessage` (5416) | subtype, cost, usage, `session_id`, `is_error` | Yes. Sets idle and `turn.completed`. |
| Start of run | `SDKSystemMessage` init (5580) | `session_id`, model, cwd, tools, `claude_code_version`, `apiKeySource` | Yes, for the native id only. |
| Compact or request state | `SDKStatusMessage` (5565) | `status: 'compacting' \| 'requesting' \| null` | Yes, as a "status" notification. `null` is dropped. |
| Subagent progress | `SDKTaskProgressMessage` (5678) | `description`, `summary?`, `last_tool_name?`, `usage` | Yes, as a `task` row (`claude-feed-system.ts:48`). |
| Subagent one-line summary | `summary` on the above; option `agentProgressSummaries` (1986) | Model-written present-tense line, about every 30 s | Field mapped. Option not set, so it stays empty for subagents. |
| Task start and end | `SDKTaskStartedMessage` (5703), `SDKTaskUpdatedMessage` (5739), `SDKTaskNotificationMessage` (5648) | description, status, summary, `ambient` | Yes. `ambient` is ignored. |
| Background work level | `SDKBackgroundTasksChangedMessage` (3498) | Full set of live background tasks, replace semantics | No. Dropped as lifecycle. |
| Tool running | `SDKToolProgressMessage` (5774) | `tool_name`, `elapsed_time_seconds`, `task_id?` | Yes, as a running tool row. |
| Tool summary | `SDKToolUseSummaryMessage` (5795) | `summary`, `preceding_tool_use_ids` | Yes. |
| Thinking size | `SDKThinkingTokensMessage` (5761) | `estimated_tokens`, delta | No. Dropped. |
| Text and thinking deltas | `SDKPartialAssistantMessage` (5170) | Raw API stream event | Yes, text only (`ClaudeLiveText`). Set by `includePartialMessages`. |
| Tool call and description | `SDKAssistantMessage` (3405) `tool_use` block | `name`, `input` (Bash `description`: sdk-tools.d.ts:812) | Yes. Label comes from `description`. |
| Hooks | `SDKHookStartedMessage` (4922), `Progress` (4894), `Response` (4907) | `hook_name`, `hook_event`, output | As a notification. `includeHookEvents` (1785) not set. |
| Rate limit | `SDKRateLimitEvent` (5320) | Limit status | Ignored. |

Confirmed quotes:
- sdk.d.ts:5531: "'idle' fires after heldBackResult flushes and the bg-agent do-while exits — authoritative turn-over signal."
- sdk.d.ts:3489 area (`SDKBackgroundTasksChangedMessage`): "consumers that only need 'is background work running' should replace their set with each payload".
- sdk.d.ts:5695 (`summary`): "For a local_agent task it is the model-generated progress summary (only when the agentProgressSummaries option is on)".
- Changelog 0.3.280: "`session_state_changed` events (`CLAUDE_CODE_EMIT_SESSION_STATE_EVENTS=1`) ... report `requires_action` while an MCP elicitation waits on the user, as for permission prompts".

Gating of `session_state_changed`:
- Confirmed. The name `CLAUDE_CODE_EMIT_SESSION_STATE_EVENTS` appears in `sdk.mjs`. The changelog ties it to this event. A web search result said the opt-in arrived in SDK 0.2.83. That date is Unconfirmed (search snippet only, not opened).
- Confirmed. Argo does not set it. `claudeCliEnvironment` only copies `process.env` and drops the API key. A grep of `apps/desktop` for the variable found nothing. So Argo likely receives no `session_state_changed` today. Unconfirmed at runtime, since no session was run.
- Cheapest change would be to set that variable in `env` and map `state` to the status event. Not built. Research only.

## 4. Does a live SDK-run Session show up in `~/.claude/sessions/<pid>.json` and `claude agents --json`?

Answer: in `~/.claude/sessions`, yes, by observation. In `claude agents --json`, Unconfirmed.

- Confirmed (local files, no session started). 15 files in `~/.claude/sessions`. 10 have `"entrypoint":"sdk-cli"` and `"kind":"interactive"`. Fields seen: `pid`, `sessionId`, `cwd`, `startedAt`, `version`, `name`, `updatedAt`, `status`, `statusUpdatedAt`. Values of `status` seen: `idle`, `busy`, `waiting`. Terminal sessions show `entrypoint: "cli"`. A `kind: "bg"` file also exists.
- Caveat. The `sdk-cli` entrypoint is what the Agent SDK sets. These files may come from Claude Code launched by other tools on this machine, not only Argo. No file was tied to an Argo run.
- Confirmed. sdk.d.ts:1056: the SDK names "SDK entrypoints `sdk-cli`, `sdk-ts`, `sdk-py`" as programmatic sessions, so `sdk-cli` is the SDK's entrypoint value.
- Dead end. The [Agent view docs](https://code.claude.com/docs/en/agent-view) say `claude agents --json` "prints active sessions as a JSON array ... every live session, plus background sessions that are still working or blocked". "Every live session" suggests SDK runs are included, but the page never says so. The page lists `busy`, `waiting`, `idle` as `status` while the process lives. It does not mention `~/.claude/sessions`. It says `~/.claude/jobs/<id>/` is "not a stable interface".
- Unconfirmed. `~/.claude/sessions/<pid>.json` has no documented contract found. Treat its shape as private.
- Unconfirmed. Whether a `.key` file beside each JSON matters. It was not opened.

## Takeaways for ticket 2940

- For live Sessions Argo already has a status and an activity line. Both are Argo-made from prompt, `result` and Feed rows.
- The one signal Claude sends that Argo drops is `session_state_changed` (needs the env variable). It would fix early idle and add `requires_action`.
- `agentProgressSummaries` would fill subagent `summary`. Off today.
- For watched Sessions with no SDK stream, `~/.claude/sessions/<pid>.json` carries `status` and `updatedAt`. It is undocumented. Decide before relying on it.
