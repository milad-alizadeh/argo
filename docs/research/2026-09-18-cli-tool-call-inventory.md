# CLI tool-call inventory: Claude Code and Codex, full surface

Date: 2026-09-18

Scope: every tool call and lifecycle event each CLI can emit (not only the subset Argo parses today), from real transcripts on this machine, from the Codex source, and from Claude Code's own docs. Feeds a future single Argo-owned Feed schema. Extends, and does not repeat, `docs/research/2026-09-18-session-tool-call-map.md` and `docs/research/2026-09-18-2437-feed-parity-event-shapes.md`.

## Sources consulted

| Source | What it gave | Link or path |
| --- | --- | --- |
| Claude Code main transcripts, 365 files, modified within the last 60 days, across many repos on this machine | Every `tool_use` name and input key set, every top-level record `type`/`subtype`, every XML-like envelope tag, `isMeta` field set | `~/.claude/projects/**/*.jsonl` (sampled every 3rd file by mtime order) |
| Claude Code subagent transcripts, 438 files sampled from 2,192 found | Confirms the subagent-only tool surface (`SubagentHandback` in particular) and that subagent transcripts carry the same record shapes as a main session | `~/.claude/projects/**/<sessionId>/subagents/agent-*.jsonl` |
| Claude Code subagent meta sidecar | Confirms `agentType`, `description`, `toolUseId`, `spawnDepth` fields | `~/.claude/projects/**/<sessionId>/subagents/agent-*.meta.json` |
| Codex rollout transcripts, 714 files, modified within the last 60 days | Every top-level `type`/`payload.type`, `event_msg` item type, `function_call` name and argument keys, `custom_tool_call` name, nested `tools.<name>(` calls | `~/.codex/sessions/**/*.jsonl` |
| `openai/codex` GitHub repo, tag `rust-v0.155.1` (published 2026-09-18) | Canonical `TurnItem` enum (the modern per-item protocol Codex's app-server v2 emits), `SubAgentActivityKind`, `AgentStatus`, `CollabAgentTool`, `RequestUserInputQuestion`/`RequestUserInputEvent`, `UpdatePlanArgs` | `codex-rs/protocol/src/items.rs`, `codex-rs/protocol/src/protocol.rs`, `codex-rs/protocol/src/request_user_input.rs`, `codex-rs/protocol/src/plan_tool.rs`, `codex-rs/core/src/agent_communication.rs` at commit tag `rust-v0.155.1` |
| `openai/codex` app-server-protocol JSON schema directory listing | Confirms a large v2 JSON-RPC surface (notifications for command exec, file change, MCP tool call, context compaction, hooks, account, plugins) exists beyond the legacy rollout format. Too large to read schema-by-schema in this pass | `codex-rs/app-server-protocol/schema/json/v2/*.json` at tag `rust-v0.155.1` (listing only, not read) |
| Claude Code docs, settings reference | Canonical built-in tool name list: Bash, Edit, Read, Write, Glob, Grep, WebFetch, WebSearch, Task, TodoWrite, NotebookEdit, Skill, AskUserQuestion, ExitPlanMode, BashOutput, KillShell, SlashCommand, `mcp__*`, Artifact, Advisor, SendFeedback | `https://code.claude.com/docs/en/settings-reference` |
| Claude Code docs, hooks reference | Full hook event list including SubagentStart/Stop, TaskCreated/Completed, PreCompact/PostCompact, Notification (with its `notification_type` enum), MessageDisplay, WorktreeCreate/Remove | `https://code.claude.com/docs/en/hooks` (the URL the docs render under. Fetched content is titled "Claude Code Hook Events Reference") |
| Claude Code docs, sub-agents page | Agent tool input fields, foreground vs background execution, how results return (notification on next turn vs immediate), TaskOutput/TaskStop/SendMessage/Monitor tools, subagent transcript path convention, depth and concurrency limits | `https://code.claude.com/docs/en/sub-agents` |
| Claude Code docs, authentication page (dead end) | Not the tools reference. Wrong page, abandoned after one fetch | `https://code.claude.com/docs/en/iam` |
| Installed CLI versions on this machine | `claude --version` → `2.1.277 (Claude Code)`. `codex --version` → `codex-cli 0.147.0` | local shell |
| Argo source: `apps/desktop/src/domains/sessions/contract/tool-feed.ts`, `apps/desktop/src/agents/claude/sessions/`, `apps/desktop/src/agents/codex/sessions/` | What Argo parses today, to flag gaps against the real-transcript inventory | local repo, read via the two prior research notes rather than re-read in full here |

Two caveats on the transcript sample. First, `~/.claude/projects` on this machine holds sessions from a richer orchestration harness layered on top of the `claude` binary (this very research task runs inside it), so it carries tool names such as `ToolSearch`, `EnterWorktree`, `Monitor`, `SendMessage`, `TaskOutput`, `TaskStop`, `TaskList`, `TaskGet`, `ReadNotifications`, `SendFeedback`, `PushNotification`, `ScheduleWakeup`, `SendUserFile`, `ListAgents`, `ReadMcpResourceTool`, `Artifact`, `ArtifactComments`, `Workflow`, `EnterPlanMode`/`ExitPlanMode`, and `SubagentHandback`. Claude Code's own docs (sub-agents page, hooks reference) confirm `SendMessage`, `TaskOutput`, `TaskStop`, and `Monitor` are genuine, currently-documented Claude Code tools, not local inventions, so they belong in the inventory below. I could not verify from a primary source whether the exact `claude` binary that Argo's desktop spawns in a pty (a plain interactive/headless CLI session, not this fleet harness) ever emits all of them. Flagged per-row below. Second, the Codex rollout sample was produced by whatever Codex CLI/app-server build wrote each file on this machine over the last 60 days, which is one or more versions behind the `rust-v0.155.1` source tag I read. The source's modern `TurnItem` protocol (`CommandExecutionItem`, `McpToolCallItem`, `FileChangeItem`, and so on) only partly matches the legacy `function_call`/`custom_tool_call` shapes still seen in most sampled rollout lines. Both are noted per-row.

## Claude Code: full tool inventory

Counts are occurrences across the 365-file main-session sample (508,959 lines) unless marked "subagent sample" (438 files, 59,197 lines) or "docs only" (not seen in the sample).

### Already known to Argo (per the prior two notes)

| Tool | Input keys seen | Count (main sample) | Lifecycle | Background? | Argo parses it |
| --- | --- | --- | --- | --- | --- |
| `Bash` | `command`, `description`, `run_in_background`, `timeout`, `dangerouslyDisableSandbox` | 37,698 | call → `tool_result`, optional background receipt | yes, via `run_in_background` and a later `<task-notification>` | yes, `command` kind |
| `Read` | `file_path`, `limit`, `offset` | 4,014 | call → result | no | yes, `read` kind |
| `Write` | `file_path`, `content` | 2,263 | call → result | no | yes, `created` kind |
| `Edit` | `file_path`, `old_string`, `new_string`, `replace_all` | 5,141 | call → result | no | yes, `edited` kind |
| `Skill` | `skill`, `args` | 363 | call → result, plus a later `isMeta` skill-body record | no | yes, `skill` kind |
| `AskUserQuestion` | `questions` | 142 | call → result carrying the answer | no | yes, `ask` row |
| `Agent` (current name. Transcripts also show the older name `Task`, per Claude's own docs, "formerly the Task tool") | `description`, `prompt`, `subagent_type`, `model`, `name`, `run_in_background`, `isolation` | 590 | call → result, or spawn record → `<task-notification>` when backgrounded | yes, default in interactive sessions with fork mode on, per the sub-agents doc | yes, delegation rows |
| `TaskCreate` / `TaskUpdate` | `tasks`, `activeForm`, `description`, `prompt`, `subject`, `state`, `status`, `taskId`/`task_id`/`task_ids`, `updates` | 1,096 / 1,854 | call → result | no | yes, Plan projection |

### Seen in real transcripts but NOT in Argo's tool-feed catalogue

These fall to the generic `kind: "tool"` / "Ran `<name>`" fallback today.

| Tool | Input keys seen | Count (main sample) | Notes |
| --- | --- | --- | --- |
| `WebFetch` | `url`, `prompt` | 83 | Same tool the docs list. Matches ADR gap already flagged in the #2437 note ("Claude web tools such as `WebFetch` are permission-gated in the driver, but the Feed catalogue has no Claude web mapping") |
| `WebSearch` | `query`, `allowed_domains`, `blocked_domains` (blocked_domains confirmed from the tool's own schema, not the sample) | 40 | No Feed mapping |
| `ToolSearch` | `query`, `max_results` | 650 | Loads a deferred tool's schema. Harness-level, see caveat above |
| `Monitor` | `command`, `shellId`, `tasks`, `until`, `wait_for_completion`, `persistent`, `poll_seconds`, several timeout variants | 69 | Docs-confirmed: "observes progress of running background tasks without interfering" |
| `EnterWorktree` | `name`, `path` | 255 | Argo-repo-specific tool named directly in this repo's own `AGENTS.md`. Not a generic Claude Code tool |
| `ExitWorktree` | `action`, `discard_changes` | 19 | Pairs with `EnterWorktree` |
| `SendMessage` | `to`, `message`, `recipient`, `content`, `summary`, `type` | 110 | Docs-confirmed: resumes a finished/stopped subagent |
| `TaskStop` | `task_id` | 46 | Docs-confirmed: stops a running subagent |
| `TaskOutput` | `task_id`, `block`, `timeout` | 55 | Docs mention this as the tool a subagent uses to mark its final output |
| `TaskList` | (none seen) | 3 | Lists running tasks, companion to `/tasks` |
| `TaskGet` | `taskId` | 1 | |
| `ListAgents` | (none seen) | 47 | |
| `ScheduleWakeup` | `delaySeconds`, `prompt`, `reason`, `stop`, `noop` | 160 | Scheduling/wakeup surface, not in either prior note |
| `SendUserFile` | `files`, `caption`, `display`, `status` | 8 | |
| `Workflow` | `script`, `args`, `description` | 4 | |
| `Artifact` / `ArtifactComments` | `action`, `file_path`, `url`, `description`, `favicon`, `label`, `page` | 17 / 2 | |
| `ReadNotifications` | (none seen) | 15 | |
| `SendFeedback` | `area`, `details`, `failure_mode`, `task_category`, `title`, `type` | 3 | |
| `PushNotification` | `message`, `status` | 1 | |
| `EnterPlanMode` / `ExitPlanMode` | `plan`, `planFilePath` | 1 / 1 | `ExitPlanMode` is docs-confirmed as a standard Claude Code built-in. `EnterPlanMode` was not in the docs page I read |
| `ReadMcpResourceTool` | `server`, `uri` | 1 | |
| `NotebookEdit` | docs-confirmed, keys not sampled (0 occurrences in this sample) | 0 | Standard Claude Code built-in per docs. Just absent from this sample |
| `BashOutput` / `KillShell` | docs-confirmed, keys not sampled (0 occurrences) | 0 | Standard Claude Code built-ins per docs. Likely superseded in newer sessions by `Monitor`/background `Bash`, but I could not confirm that supersession from a primary source |
| `SlashCommand` | docs-confirmed, not sampled as a distinct `tool_use` name | 0 | Claude's command envelopes (`<command-name>`, `<command-args>`) carry slash-command invocations in the transcripts I sampled, which is the shape the two prior notes already document. I did not find a `tool_use` named `SlashCommand` itself |
| `mcp__<server>__<tool>` (dozens of distinct names, e.g. `mcp__linear__save_issue`, `mcp__figma__get_screenshot`, `mcp__claude-in-chrome__computer`, `mcp__sentry__search_issues`, `mcp__supabase-production__execute_sql`) | varies per server, always an object matching that MCP tool's own schema | hundreds combined | Confirms the `mcp__<server>__<tool>` naming convention live in real transcripts. Argo's tool-feed catalogue has no generic MCP row today |
| `SubagentHandback` | (subagent sample only) | seen, count not separately tallied | The tool a subagent calls to deliver its final report to its caller, per this very environment's own tool description. Explains one concrete mechanism for how a delegation's "response" surfaces (see the delegation section below) |

### Top-level record types beyond `user`/`assistant`

These are Claude Code CLI record types, not tool calls. Several are not covered by either prior note. Counts from the main sample (508,959 lines).

| Record `type` | Count | What it plausibly is |
| --- | --- | --- |
| `attachment` | 204,007 | Bulk. Likely one row per rendered content attachment, not one per turn |
| `assistant` | 92,357 | Standard assistant message record |
| `user` | 60,892 | Standard user message record |
| `bridge-session` | 17,966 | Unclear. Name suggests a session-bridging/relay record. Not verified against any primary source beyond the record's own `type` string |
| `atis-latch` | 19,073 | Unclear, name not self-explanatory. Not verified |
| `last-prompt` | 19,383 | Likely a cached-prompt marker |
| `mode` | 19,133 | Likely tracks permission/interaction mode changes |
| `permission-mode` | 16,281 | Likely a distinct permission-mode-change record from `mode` |
| `worktree-state` | 13,980 | Likely worktree lifecycle bookkeeping, paired with the `WorktreeCreate`/`WorktreeRemove` hooks in the docs |
| `relocated` | 13,521 | Unclear |
| `ai-title` | 10,172 | Likely an auto-generated session title record |
| `queue-operation` | 4,978 | Likely queued-message bookkeeping |
| `pr-link` | 4,197 | Matches the `pull-request` record the #2437 note says Argo's Roster already reads generically |
| `file-history-snapshot` / `file-history-delta` | 1,803 / 3,157 | File version history, unrelated to the Feed's own diff evidence |
| `system/stop_hook_summary` | 2,171 | Ties to the `Stop` hook event in the docs |
| `system/turn_duration` | 2,160 | Turn timing |
| `agent-name` | 1,437 | Likely names a spawned subagent. Candidate anchor for a "delegation sent" row's label |
| `cost-state` | 561 | Token/cost bookkeeping |
| `custom-title` | 697 | User-set session title |
| `system/compact_boundary` | 238 | Already known: Claude's compaction marker |
| `system/local_command` | 103 | Ties to the `<local-command-stdout>` envelope both prior notes already document |
| `history-suppression` | 80 | Unclear |
| `system/scheduled_task_fire` | 29 | Ties to `ScheduleWakeup` |
| `frame-link` | 138 | Unclear |
| `system/informational` | 89 | Generic system note |
| `system/away_summary` | 321 | Likely an idle/away recap |
| `artifact-autoreact-ledger` / `artifact-comment-monitor` | 13 / 20 | Tie to the `Artifact`/`ArtifactComments` tools above |
| `continued-in` | 2 | Likely a session-continuation pointer |

None of these unclear ones are claims. They are the record's own `type` string plus a plausible reading from its name and neighboring records. I could not verify most of them against Claude Code's public docs, which do not document the transcript JSONL format itself.

### Envelope tags inside message text (confirmed against the prior notes' list, plus additions)

Counts from the main sample. The regex swept broadly and also matched ordinary Markdown/JSX/HTML tags from code the sessions wrote or quoted (for example `div`, `button`, `svg`, many React component names). Those are noise from this being a coding-agent transcript, not Claude Code envelope syntax, and are excluded below.

| Tag | Count | Status |
| --- | --- | --- |
| `task-notification` | 3,552 | Already known |
| `task-id`, `tool-use-id`, `output-file`, `status`, `summary`, `note`, `result`, `usage`, `subagent_tokens`, `tool_uses`, `duration_ms` | 628–3,536 each | Already known as the fields inside a `<task-notification>` body, per the #2437 note's cited `task-notification.ts` |
| `command-name`, `command-message`, `command-args` | 589 / 587 / 401 | Already known |
| `local-command-stdout`, `local-command-caveat` | 185 / 163 | Already known |
| `local-command-stderr` | 1 | New: not named in either prior note. A stderr sibling of `<local-command-stdout>` |
| `fixed-point` | 470 | New tag, not in either prior note. Meaning not verified from a primary source in this pass |
| `system-reminder` | 29 | New tag. Matches the "system-reminder" framing seen throughout this very conversation's own tool outputs, so likely a generic injected-context wrapper, not Session-specific |
| `cross-session-message` | 78 | New tag. Name suggests a message relayed from a different session |
| `bash-input`, `bash-stdout`, `bash-stderr` | 16 / 17 / 13 | New tags. Likely a more granular sibling of the plain `Bash` tool result, separating command echo from stdout and stderr |
| `agent-message` | 125 | New tag. Candidate anchor for "agent responded" text distinct from the `<task-notification>` `<summary>` |
| `worktree-path`, `worktreePath`, `worktreeBranch` | 1 / 32 / 32 | New. Worktree bookkeeping, ties to the `worktree-state` record type above |
| `environment_context` | 2 | Already known by name from the #2437 note's `<environment_context>` |

## Codex: full tool and event inventory

Counts are occurrences across the 714-file rollout sample (148,384 lines) unless marked "source only" (from `codex-rs` at `rust-v0.155.1`, not confirmed live in this sample).

### Legacy rollout shapes (what the sampled transcripts mostly contain, and what Argo parses today)

| Shape | Count | Argo parses it | Notes |
| --- | --- | --- | --- |
| `function_call` name `exec_command` | 1,119 | yes, `command` kind | Keys: `cmd`, `justification`, `max_output_tokens`, `prefix_rule`, `sandbox_permissions`, `tty`, `workdir`, `yield_time_ms`. The prior notes did not list `justification`, `prefix_rule`, `sandbox_permissions`, or `tty` |
| `custom_tool_call` name `exec` | 9,996 | yes, decomposed into nested `tools.<name>(...)` calls | Nested names found: `exec_command` (7,901), `web__run` (526), `write_stdin` (574), `apply_patch` (1,168), `update_plan` (228), `view_image` (131) |
| `custom_tool_call` name `apply_patch` (top-level, not nested) | 2 | yes, `edited`/`created` kind | Rare. Almost always nested inside `exec` in this sample |
| `function_call` name `update_plan` | 3 | yes, Plan projection | Key: `plan` (array of `{step, status}`) |
| `function_call` name `write_stdin` | 30 | no, filtered | Keys: `chars`, `max_output_tokens`, `session_id`, `yield_time_ms` |
| `function_call` name `sleep` | 14 | no, filtered | Key: `duration_ms` |
| `function_call` name `spawn_agent` | 130 | no (filtered as collaboration) | Keys: `fork_turns`, `message`, `model`, `reasoning_effort`, `task_name`. Matches the prior note's list but the prior note did not record `fork_turns` |
| `function_call` name `wait_agent` | 317 | no (filtered) | Key: `timeout_ms` |
| `function_call` name `send_message` | 146 | no (filtered) | Keys: `message`, `target` |
| `function_call` name `followup_task` | 64 | no (filtered) | Keys: `message`, `target` |
| `function_call` name `list_agents` | 78 | no (filtered) | Key: `path_prefix` |
| `function_call` name `interrupt_agent` | 8 | no (filtered) | Key: `target` |
| nested `tools.view_image(...)` | 131 | not in either prior note | New: an image-viewing tool call nested the same way `apply_patch` and `web__run` are. No Argo Feed row for it today |
| nested `tools.mcp__codex_app__*(...)` (e.g. `attach_artifact`, `list_projects`, `create_thread`, `list_threads`, `send_message_to_thread`, `wait_threads`, `read_thread`, `capture_screen_context`, `open_in_codex`, `load_workspace_dependencies`) | 9–18 each, ~91 combined | not mapped | New: Codex's own MCP-tool naming convention for a first-party "codex_app" server that manages projects/threads. Not documented in either prior note |
| nested `tools.mcp__codex_apps__*(...)` (e.g. `github_fetch_issue`, `google_drive_search`, `gmail_search_emails`, `gmail_read_attachment`, `gmail_read_email_thread`, `google_drive_fetch`) | 1–5 each | not mapped | New: third-party connector MCP tools surfaced the same nested way |
| nested `tools.update_goal(...)`, `tools.create_goal(...)`, `tools.get_goal(...)` | 27 / 13 / 16 | not mapped | New: a goal-tracking surface distinct from `update_plan`. Corresponds to `event_msg` type `thread_goal_updated` below |
| nested `tools.image_gen__imagegen(...)` | 28 | not mapped | New: image generation, corresponds to source's `ImageGenerationItem` |
| `function_call` name `js` / `js_reset` | 600 / 1 | not mapped | New: a JavaScript-scripted exec surface distinct from plain `exec_command`. Keys: `code`, `timeout_ms`, `title` |
| `function_call` name `wait` | 367 | not mapped | New: a generic wait/yield call distinct from `wait_agent`. Keys: `cell_id`, `max_tokens`, `terminate`, `yield_time_ms` |

### `event_msg` item types (from `payload.item.type` inside `event_msg`/`item_completed` records)

| Item type | Count | Argo parses it | Notes |
| --- | --- | --- | --- |
| `UserMessage` | 3,588 | yes | |
| `AgentMessage` | 6,432 | yes | |
| `Reasoning` | 12,888 | yes, as `thought` | |
| `CommandExecution` | 9,253 | partially. Argo reads the legacy `exec_command`/`exec` shapes, not this typed item, in this sample's Codex version | Fields per source: `id`, `plugin_id`, `script_path`, `process_id`, `command` (array), `cwd`, `parsed_cmd`, `source`, `interaction_input`, `status` (`InProgress`/`Completed`/`Failed`/`Declined`), `stdout`, `stderr`, `aggregated_output`, `exit_code`, `duration`, `formatted_output`, which is richer than the legacy `cmd` string |
| `SubAgentActivity` | 524 | yes, `started`/`completed` only | Real-transcript `kind` values: `interacted` 208, `started` 127, `completed` 181, `interrupted` 8. Argo's adapter (per the prior note) maps only `started`→running and `completed`→completed. `interacted` and `interrupted` are unmapped. Source confirms these are the full enum: `SubAgentActivityKind { Started, Interacted, Interrupted, Completed }` (`codex-rs/protocol/src/protocol.rs:4318`) |
| `Extension` | 562 | no | `kind` values seen: `web.search` 501, `image_gen.generation` 47, `clock.sleep` 14. Source: item schema is owned by an extension (`items.rs:65`, comment: "Standalone web search uses Self::Extension instead"), fields `type`, `kind`, `id`, `query`, `action`, `results` |
| `McpToolCall` | 730 | no | Fields per source (`items.rs:419`): `id`, `server`, `tool`, `arguments`, `connector_id`, `mcp_app_resource_uri`, `link_id`, `app_name`, `action_name`, `plugin_id`, `read_only_hint`, `status` (`InProgress`/`Completed`/`Failed`), `result`, `error`, `duration`. Real-sample `status`: `completed` 613, `failed` 117 |
| `ImageView` | 161 | no | Fields: `id`, `path` |
| `FileChange` | 1,104 | no (Argo only structures Codex file edits through nested `apply_patch`) | Fields: `id`, `changes` (map of path → `{type, content}` in the sample I inspected), `status`, `auto_approved`, `stdout`, `stderr`. All 1,104 sampled had `status: completed` |
| `ContextCompaction` | 100 | partially. Argo reads the top-level `compacted` record (118 seen), not this typed item | Source fields: just `id` |
| `CollabAgentToolCall` | 314 | no | Fields per source (`items.rs:330`): `id`, `tool` (enum below), `status` (`InProgress`/`Completed`/`Failed`/`Interrupted`), `sender_thread_id`, `receiver_thread_ids`, `receiver_agents`, `prompt`, `model`, `reasoning_effort`, `agents_states` (map of thread id → `AgentStatus`). Source enum `CollabAgentTool`: `SpawnAgent`, `SendInput`, `ResumeAgent`, `Wait`, `CloseAgent`, `SendMessage`, `FollowupTask`, `InterruptAgent`, `ListAgents` (`items.rs:308`). Real sample only showed `tool: wait`, `status: completed` (all 314), which undercounts the enum's breadth versus source |
| `WebSearch` | 14 | no | Hosted Responses-API web search, separate code path from the `Extension`/`web.search` kind above per the source comment |
| `FunctionCallOutput` | 43 | partially, only the `create_thread` case per the prior note | |

### Top-level record `type` values

| `type` | Count | Notes |
| --- | --- | --- |
| `session_meta` | 772 | Already known |
| `response_item` (all `payload.type` variants combined) | ~76,000+ | Already known as the envelope. Variants listed above and below |
| `event_msg` (all variants combined) | ~83,000+ | Already known as the envelope |
| `turn_context` | 4,730 | Already known |
| `token_usage_record` | 16,570 | Already known |
| `compacted` | 118 | Already known, legacy compaction marker |
| `world_state` | 1,036 | New: not in either prior note. Fields: `full`, `state`. Meaning not verified against source in this pass |
| `inter_agent_communication_metadata` | 522 | New. Field seen: `trigger_turn`. Source confirms a parallel `InterAgentCommunication` concept used for spawn/message/followup/result logging (`codex-rs/core/src/agent_communication.rs`), though the exact rollout-record shape was not cross-checked line-for-line |
| `realtime_item` (with `payload.type` `realtime_session_started`, `transcript_segment`, `bem_item_promoted`, `realtime_session_closed`) | 3 / 46 / 20 / 3 | New: ties to the voice/realtime surface this repo's own memory notes already mention (`codex-realtime-voice-webrtc-on-subscription.md`). Not previously catalogued at the record-shape level |

### `response_item` payload types

| `payload.type` | Count |
| --- | --- |
| `message` | 14,116 |
| `reasoning` | 16,208 |
| `custom_tool_call` | 9,998 |
| `custom_tool_call_output` | 10,036 |
| `function_call` | 2,877 |
| `function_call_output` | 2,921 |
| `agent_message` | 522 |
| `compaction` | 268 |
| `web_search_call` | 14 |

`web_search_call` is new relative to the prior notes. It is a `response_item` payload type distinct from the nested `web__run` custom tool call and from the `Extension`/`web.search` event item, giving Codex at least three different observed shapes for a web search depending on CLI/protocol version.

### `event_msg` types not covered above

| `payload.type` | Count | Notes |
| --- | --- | --- |
| `task_started` | 4,663 | Fields: `type`, `turn_id`, `started_at`, `model_context_window`, `collaboration_mode_kind`. New: not in either prior note. Candidate turn-start anchor |
| `task_complete` | 4,598 | Fields: `type`, `turn_id`, `last_agent_message`, `completed_at`, `duration_ms`, `time_to_first_token_ms`. Argo reads this per the #2437 note as a `turn` record |
| `turn_aborted` | 16 | Already known |
| `thread_settings_applied` | 4,380 | New. Fields: `type`, `thread_id`, `thread_settings` (not expanded further in this pass) |
| `thread_goal_updated` | 19 | New. Fields: `type`, `threadId`, `goal`. Ties to the `update_goal`/`create_goal`/`get_goal` nested calls above |
| `patch_apply_end` | 5 | New. Fields: `type`, `call_id`, `turn_id`, `stdout`, `stderr`, `success`, `changes`, `status`. A file-edit-lifecycle event distinct from `FileChange` and legacy `apply_patch` |
| `sub_agent_activity` | 5 | New top-level-lowercase sibling of the `event_msg`/`SubAgentActivity` item shape. Count is small in this sample, likely an older/alternate wire shape |
| `agent_reasoning` | 16 | New. Field: `type`, `text`. A flatter reasoning shape than `response_item`/`reasoning` |
| `token_count` | 16,846 | New. Not expanded in this pass. Likely usage telemetry parallel to `token_usage_record` |

### Modern app-server `TurnItem` protocol (source-only, `rust-v0.155.1`)

Not confirmed live in the rollout sample (which mostly used the legacy shapes above), but this is the canonical, current per-item enum a Codex app-server client (including a JSON-RPC-driven managed session) would see, per `codex-rs/protocol/src/items.rs:45`:

`UserMessage`, `FunctionCallOutput`, `HookPrompt`, `AgentMessage`, `Plan`, `Reasoning`, `CommandExecution`, `DynamicToolCall`, `CollabAgentToolCall`, `SubAgentActivity`, `WebSearch`, `ImageView`, `Extension`, `ImageGeneration`, `EnteredReviewMode`, `ExitedReviewMode`, `FileChange`, `McpToolCall`, `ContextCompaction`.

Two of these were not seen anywhere in the rollout sample and are not in either prior note: `DynamicToolCall` (fields: `id`, `namespace`, `tool`, `arguments`, `status` `InProgress`/`Completed`/`Failed`, `content_items`, `success`, `error`, `duration`, source `items.rs:284`) and `EnteredReviewMode`/`ExitedReviewMode` (fields: `target`, `user_facing_hint` / `review_output`, source `items.rs:172`, `items.rs:179`), which correspond to Codex's `/review` code-review mode. `HookPrompt` (fields: `fragments` of `{text, hook_run_id}`, source `items.rs:99`) is Codex's own hook-injection mechanism, analogous to Claude's `PreToolUse`/`PostToolUse` hook prompts.

### Request-user-input (Codex's "ask") protocol, source-confirmed

`RequestUserInputEvent` (`codex-rs/protocol/src/request_user_input.rs:54`): `call_id`, `turn_id`, `questions` (each `{id, header, question, isOther, isSecret, options?}`), `isBlocking`, deprecated `autoResolutionMs`. The response is `RequestUserInputResponse { answers: HashMap<question_id, {answers: [String]}> }`. This matches the #2437 note's claim that Codex questions are live-only (no persisted transcript row), since nothing in this event shape is a rollout item. It is a JSON-RPC request/response pair.

## Delegation and subagents, in depth

### Claude Code: how a delegation is spawned, tracked, and answered

- **Spawn**: the `Agent` tool call (`tool_use` name `Agent`, older transcripts and the docs' own history name it `Task`). Input fields, confirmed both from the docs (`https://code.claude.com/docs/en/sub-agents`) and from real transcript input keys: `subagent_type` (required), `description`, `prompt`, `model`, `run_in_background`, `name`, `isolation`. `subagent_type` selects a named agent definition (built-in `general-purpose`, `Explore`, `Plan`, or a custom `.claude/agents/*.md` file). `name` lets a later `SendMessage` call address that instance.
- **Progress**: the docs describe a "subagent panel" in the TUI showing a tree with an `(+N)` descendant-count indicator, and `/tasks` for detailed status. None of this is transcript-visible today except through the `agent-name` record type (1,437 occurrences in the sample) and the `<task-notification>` envelope's `<status>` field (3,287 occurrences), both already partly covered by the #2437 note.
- **Response, two distinct anchors**:
  1. **Foreground call**: the `Agent` tool's own `tool_result` carries an `output` field with the subagent's final summary directly, per the docs. This is the existing `spawned-agents.ts` path the #2437 note already documents.
  2. **Background call**: the docs say "Results return as completion notification when Claude processes next turn." In the transcript, this notification is the `<task-notification>` envelope (3,552 occurrences), whose body carries `<task-id>`, `<tool-use-id>`, `<status>`, `<summary>`, `<result>`, `<output-file>`, `<usage>`, `<subagent_tokens>`, `<tool_uses>`, `<duration_ms>`, and `<note>`. `<summary>` (3,529 occurrences) is the most direct "agent responded" text candidate. `<tool-use-id>` is the join key back to the spawning `Agent` call, so "delegation sent" and "delegation response" are two events joined by that id, exactly as Argo's existing `spawned-agents.ts`/`task-notification.ts` already do.
  3. **A third path found in this pass, not in either prior note**: `SubagentHandback`, the tool a subagent itself calls to deliver its report. Per the subagent-sample tool inventory, a subagent's own transcript contains `SubagentHandback` calls. The caller side of that exchange is presumably still the `<task-notification>`, but I could not directly confirm the caller-side linkage from these transcripts, because seeing both sides requires joining a subagent file to its parent, which this scan did not do.
- **Resume**: `SendMessage` (110 occurrences) resumes a stopped or finished named subagent without a new `Agent` call, per the docs. `TaskStop` (46 occurrences) stops one. `TaskOutput` (55 occurrences) is described in the docs as the tool a subagent uses to mark its structured final output. None of `SendMessage`, `TaskStop`, or `TaskOutput` appear in either prior note or in Argo's Claude adapter code as read by those notes.
- **Subagent transcript**: a side file at `<sessionId>/subagents/agent-<id>.jsonl` plus `agent-<id>.meta.json`, already documented by the first prior note. The meta file's fields, confirmed by direct read in this pass: `agentType`, `description`, `toolUseId`, `spawnDepth` (a synthetic example: `{"agentType": "general-purpose", "description": "Spec review of #1172", "toolUseId": "toolu_01FvhEvFnmzQhzTKZzAHL1c9", "spawnDepth": 1}`). `spawnDepth` was not previously documented. The docs confirm a "Depth limit: Subagents can spawn subagents up to 3 layers deep."

### Codex: how a delegation is spawned, tracked, and answered

- **Spawn**: `spawn_agent` function call. Real-transcript keys: `fork_turns`, `message`, `model`, `reasoning_effort`, `task_name`. Source enum `CollabAgentTool::SpawnAgent` (`items.rs:308`) is the modern-protocol equivalent, carried inside a `CollabAgentToolCallItem` with `sender_thread_id`, `receiver_thread_ids`, `receiver_agents`, `prompt`, `model`, `reasoning_effort`.
- **Progress**: `SubAgentActivity` items, `kind` one of `started`, `interacted`, `completed`, `interrupted` (source: `SubAgentActivityKind`, `codex-rs/protocol/src/protocol.rs:4318`. Live counts in this sample: interacted 208, started 127, completed 181, interrupted 8). Argo's adapter, per the prior note, maps only `started` and `completed`. `interacted` (the largest bucket in the live sample) and `interrupted` fall through unmapped.
- **Response, two distinct anchors**:
  1. **Poll-based**: `wait_agent` function call (317 occurrences, key `timeout_ms`) blocks until the spawned thread yields, and its `function_call_output` carries the result text. This is the "delegation sent" (`spawn_agent`) / "delegation response" (`wait_agent`'s own result, or the `SubAgentActivity` `completed` item) split Argo would want.
  2. **Push-based**: `send_message` (146, keys `message`/`target`) and `followup_task` (64, same keys) push a message into a running or finished sub-thread rather than waiting on it. `interrupt_agent` (8, key `target`) cancels one. `list_agents` (78, key `path_prefix`) enumerates them.
- **Delegated prompt recovery**: as the prior note already documents, the delegated thread's own prompt shows up as a `FunctionCallOutput` for `create_thread` containing a `<codex_delegation><input>` envelope, or via a `<realtime_delegation>` envelope. Both are already covered.
- **Modern protocol equivalent**: `CollabAgentToolCallItem.agents_states` is a live map from thread id to `AgentStatus` (`PendingInit`, `Running`, `Interrupted`, `Completed(message)`, `Errored(message)`, `Shutdown`, source `codex-rs/protocol/src/protocol.rs:1828`). This is a richer status surface than the `SubAgentActivity` `kind` enum alone. A Feed schema aiming for the deepest available signal would prefer this map when a client speaks the modern protocol.

## Running commands, in depth

| Aspect | Claude Code | Codex |
| --- | --- | --- |
| Foreground command | `Bash` tool call/result pair | `exec_command` function call, or nested `tools.exec_command(...)` inside an `exec` custom tool call |
| Background start | `Bash` with `run_in_background: true` | not directly seen as a boolean flag in the sampled `exec_command` keys. Codex's model is closer to "yield and poll" (see below) |
| Polling/streaming | not modeled as separate calls in the sample. Argo reads background receipts and later notifications | `wait` (367, keys `cell_id`, `max_tokens`, `terminate`, `yield_time_ms`) and `write_stdin` (574 nested, 30 top-level) are the poll/interact primitives. Both are already filtered by Argo's adapter as "command polls" |
| Kill | `KillShell` tool, docs-confirmed, not seen in this sample | `interrupt_agent` targets an agent thread, not a single command. A command-level kill primitive was not found in this pass |
| Output shape | plain stdout/stderr text in the tool result, plus the newly found `bash-input`/`bash-stdout`/`bash-stderr` envelope tags | modern `CommandExecutionItem` (source) carries `stdout`, `stderr`, `aggregated_output`, `exit_code`, `duration`, `formatted_output`, and a `status` of `InProgress`/`Completed`/`Failed`/`Declined`, which is richer than the legacy shape Argo reads today |
| Richer new tool | `js`/`js_reset` function calls (600/1) are a JavaScript-scripted execution surface separate from `exec_command`. Not documented in either prior note or in Argo's adapter | |

## Compaction, in depth

| Aspect | Claude Code | Codex |
| --- | --- | --- |
| Settled marker | `system/compact_boundary` record type (238 occurrences), already known | `compacted` top-level record (118 occurrences, legacy) or `ContextCompaction` item / `response_item`/`compaction` payload (268 occurrences) in the modern shapes |
| Live start | `PreCompact` hook, already known | `ContextCompaction` item's lifecycle (`item/started`/`item/completed` per the #2437 note). Source item itself carries only an `id`, so the richer state (manual vs auto, summary) lives in the surrounding JSON-RPC notification, not in this pass's inventory |
| Manual vs auto | docs: `PreCompact`/`PostCompact` hooks support a matcher of `manual`/`auto` | not directly confirmed in this pass. The `ContextCompactedNotification` app-server v2 schema file exists (listing only, not read) and likely carries this |
| Summary | replayed into the transcript per the first prior note | `response_item`/`compaction` payload (268 occurrences). Shape not expanded further in this pass |

## Questions to the user, in depth

| Aspect | Claude Code | Codex |
| --- | --- | --- |
| Mechanism | `AskUserQuestion` tool call/result, a normal persisted tool call | `RequestUserInputEvent`, a JSON-RPC push (`request_user_input` tool internally, surfaced as `item/tool/requestUserInput` per the prior note). Source confirms fields `call_id`, `turn_id`, `questions[].{id, header, question, isOther, isSecret, options?}`, `isBlocking`, deprecated `autoResolutionMs` |
| Durability | Persisted: the question and its answer both live in the transcript as call/result | Not persisted as a rollout item. Live-only, matching the prior note's finding |
| Secret answers | not modeled distinctly in the sample | `isSecret` per question, confirmed from source. The prior note already says secret questions are unsupported in Argo's live overlay |
| Answer shape | free text or option strings inside the tool result | `RequestUserInputResponse { answers: { <questionId>: { answers: [String] } } }`, confirmed from source |

## Plan and skills, in depth

- Claude: `TodoWrite` (legacy, not seen in this sample but named in the first prior note), `TaskCreate` (1,096) and `TaskUpdate` (1,854) are today's incremental plan tools. `TaskList`/`TaskGet` (3/1) read plan state back, not previously catalogued.
- Codex: `update_plan` (3 top-level, 228 nested) takes a whole-plan snapshot, confirmed by source `UpdatePlanArgs { explanation: Option<String>, plan: Vec<PlanItemArg> }` where `PlanItemArg { step, status: Pending|InProgress|Completed }` (`codex-rs/protocol/src/plan_tool.rs`). The `explanation` field was not previously documented by either prior note.
- Skills: Claude's `Skill` tool call plus a later `isMeta` skill-body record, already documented. No Codex equivalent tool name was found in this pass. Codex's closest concept is a plugin/extension (`Extension` item, `plugin_id` fields scattered across several item types), which is a different mechanism (harness-level capability, not a user-invoked skill).

## Web search / fetch, in depth

Codex alone now has at least three distinct observed shapes for "search the web" across CLI versions on this machine: legacy nested `tools.web__run(...)` (526, already mapped by Argo), `Extension` item with `kind: web.search` (501, live, unmapped), and `response_item`/`web_search_call` (14, live, unmapped) plus the source-level `WebSearch` TurnItem (`items.rs:65`, explicitly a separate hosted-Responses-API code path from the extension). Claude has `WebFetch` (83) and `WebSearch` (40), both unmapped in Argo's Feed catalogue, confirmed docs-standard tools.

## File read / search, edit, create

- Claude: `Read` (structured, mapped), `Glob`/`Grep` (docs-confirmed built-ins, not seen as distinct `tool_use` names in this sample, unmapped), `Edit`/`Write` (structured diffs, mapped), `NotebookEdit` (docs-confirmed, unmapped, not seen in sample).
- Codex: legacy nested `apply_patch` (1,168, mapped) is the only structured edit path Argo reads. The modern `FileChangeItem` (1,104 live occurrences under `item:FileChange`, unmapped) carries `changes: Map<path, {type, content}>` plus `stdout`/`stderr`/`status`/`auto_approved`, which is richer than the legacy patch-text parse Argo does today. File search/read via a shell command (`cat`, `grep`, `find` inside `exec_command`) stays command text on both sides, unchanged from the prior note's finding.

## MCP tools

- Claude: `mcp__<server>__<tool>` naming, dozens of distinct live examples in this pass (Linear, Figma, Sentry, Supabase, Maestro, claude-in-chrome, Expo). No Feed mapping exists. Every one falls to the generic tool fallback.
- Codex: two mechanisms found. Legacy: nested `tools.mcp__<server>__<tool>(...)` calls inside an `exec` custom tool call (the `mcp__codex_app__*` and `mcp__codex_apps__*` names above). Modern: the `McpToolCall` item (730 live occurrences, fields including `server`, `tool`, `arguments`, `connector_id`, `mcp_app_resource_uri`, `app_name`, `action_name`, `plugin_id`, `read_only_hint`, `result`, `error`, `duration`), which is a first-class typed item, not a nested string-parsed call. Neither is mapped by Argo today.

## Turn boundaries, interrupts, approvals, errors

| Aspect | Claude Code | Codex |
| --- | --- | --- |
| Turn start | not modeled as a distinct record type in the sample. Inferred from message sequencing | `event_msg`/`task_started` (4,663 live), fields `turn_id`, `started_at`, `model_context_window`, `collaboration_mode_kind`. New, not in either prior note |
| Turn end | `system/turn_duration` record (2,160 live), new, not in either prior note | `event_msg`/`task_complete` (4,598), already known to Argo as a `turn` record |
| Interrupt | not directly seen as a distinct tag in the sample | `turn_aborted` (16), already known |
| Approval / permission request | `permission-mode` (16,281) and `mode` (19,133) record types track mode changes. The actual per-call approval decision is not a distinct record type in this transcript format, consistent with approvals being a live TUI interaction rather than a persisted row | source confirms `ExecCommandApprovalParams`, `ApplyPatchApprovalParams`, `FileChangeRequestApprovalParams`, `CommandExecutionRequestApprovalParams`, `PermissionsRequestApprovalParams` JSON-RPC request/response pairs exist in the app-server v2 schema (listing only. Not read in this pass), so Codex's approval surface is richer and more typed per-action-kind than Claude's |
| Error | not found as a distinct top-level record type in the Claude sample | `McpToolCallError { message }` (source) is the one typed error shape found. A generic turn-level error record was not found in this pass for either CLI |

## Semantic equivalence table

Columns: Argo-neutral concept. Claude source. Codex source. Fields on Claude not on Codex (or vice versa). Where the Feed must degrade.

| Concept | Claude source | Codex source | Claude-only fields | Codex-only fields | Degrade note |
| --- | --- | --- | --- | --- | --- |
| Command (foreground) | `Bash` call/result | `exec_command` (legacy) or `CommandExecution` item (modern) | `description`, `dangerouslyDisableSandbox` | `justification`, `prefix_rule`, `sandbox_permissions`, `tty`, `parsed_cmd`, `exit_code`, `formatted_output` (modern only) | Codex's modern item is strictly richer (typed exit code, parsed command, four-state status) than Claude's plain text result. Claude has no declined-vs-failed distinction, Codex's modern `status` does (`Declined` for a rejected approval) |
| Command (background/poll) | `Bash` with `run_in_background`, later `<task-notification>` | `wait`/`write_stdin` nested calls | receipt with output-file path | `cell_id`, `yield_time_ms`, `terminate` | Both poll-based. Join keys differ (`toolUseId`/`task-id` vs `call_id`) |
| File read | `Read` | shell `cat`/similar inside `exec_command`, or the sample never showed a typed Codex file-read tool | `limit`, `offset` (partial-file read) | none typed | Codex has no structured file-read row at all in this sample. It is always command text |
| File search | `Glob`/`Grep` (docs-confirmed, unmapped, not seen as distinct tool_use in sample) | shell `grep`/`find` inside `exec_command` | pattern-based structured search | none typed | Neither side has a structured Feed row for this today |
| Edit | `Edit` | nested `apply_patch` (legacy) or `FileChangeItem` (modern) | `old_string`/`new_string` (line-level diff) | `auto_approved`, `stdout`/`stderr` (from a hook running against the patch) | Both sides can build a diff. Codex's modern item is keyed by path with `{type, content}` per file rather than old/new string pairs |
| Create | `Write` | same as Edit, `FileChange.type` distinguishes add/update/delete | `content` (whole-file) | `type` enum on each change | |
| Web search | `WebSearch` | nested `web__run` (legacy), `Extension`/`web.search` (modern), `response_item`/`web_search_call` (Responses-API) | `allowed_domains`/`blocked_domains` | `results` (structured JSON results array) | Codex has three shapes on this machine alone. Feed needs one canonical Codex-side classifier before it can equal Claude's single shape |
| Web fetch | `WebFetch` | nested `web__run` when given a URL (same tool as search, distinguished by `url` vs `q`) | `prompt` (extraction instruction) | none | Codex conflates fetch and search into one tool. Claude splits them |
| Delegation sent | `Agent`/`Task` call, or `spawned-agents.ts` spawn record | `spawn_agent` call, or `CollabAgentToolCallItem` with `tool: SpawnAgent` | `subagent_type`, `isolation`, `name` (resumable identity) | `fork_turns`, `receiver_agents` (can target more than one agent) | Codex can address multiple receivers in one call. Claude's `Agent` call is always one spawn |
| Delegation progress | `agent-name` record, `<task-notification>` `<status>` | `SubAgentActivity` `kind: interacted` | none typed beyond status string | `agents_states` map (modern), richer live status per agent | Codex's `interacted` kind has no described Claude equivalent. Claude has no distinct "still working, here's an update" record separate from status |
| Delegation response | `<task-notification>` `<summary>`/`<result>`, or foreground `Agent` `tool_result.output`, or a subagent's own `SubagentHandback` call | `wait_agent` result, or `SubAgentActivity kind: completed`, or `AgentStatus::Completed(message)` (modern) | `output-file`, `usage`, `subagent_tokens`, `tool_uses`, `duration_ms` (rich completion telemetry) | `agents_states` per-thread completion messages (can report several agents finishing independently) | Claude's completion telemetry (token/tool-call counts for the delegated run) has no seen Codex equivalent. Codex's multi-agent completion map has no Claude equivalent |
| Question | `AskUserQuestion` call/result | `RequestUserInputEvent`/`RequestUserInputResponse` (JSON-RPC only) | persisted transcript row | `isSecret`, `isBlocking`, multiple choice `options` with `label`/`description` pairs | Codex questions never persist. A Feed row for a Codex question must come from a live overlay and will vanish on session reopen unless Argo starts persisting it itself |
| Plan change | `TaskCreate`/`TaskUpdate` (incremental), legacy `TodoWrite` | `update_plan` (whole-snapshot) | per-task `activeForm` | `explanation` (free-text reasoning for the plan change) | Already known asymmetry (incremental vs snapshot). `explanation` is a newly found Codex-only field with no Claude counterpart |
| Compaction | `system/compact_boundary` record, `PreCompact`/`PostCompact` hooks | `compacted` (legacy) / `ContextCompaction` item (modern) / `response_item`/`compaction` payload | hook-level `manual`/`auto` matcher | none typed found in this pass | Both settle to one marker. Live-state richness differs, and Codex's modern item is nearly empty (`id` only) so live richness must come from an accompanying JSON-RPC notification not inventoried here |
| Skill | `Skill` call + skill-body record | no equivalent tool name found | skill-body text | none | Codex's nearest concept, a plugin/extension, is a harness capability, not a user-invoked skill. There is no Codex row to equate here |
| MCP tool | `mcp__<server>__<tool>` call/result | nested `tools.mcp__<server>__<tool>(...)` (legacy) or `McpToolCall` item (modern) | none beyond the generic tool call/result shape | `connector_id`, `mcp_app_resource_uri`, `app_name`, `action_name`, `plugin_id`, `read_only_hint` (modern only) | Codex's modern item carries app-store/connector metadata Claude's MCP call shape does not |
| Turn boundary | not a distinct persisted record in this sample | `task_started`/`task_complete`/`turn_aborted` | none found | `model_context_window`, `collaboration_mode_kind`, `time_to_first_token_ms` | Codex has an explicit, richer turn-boundary record. Claude's turn boundary must be inferred from message sequencing in this transcript format |
| Approval | live TUI-only in this transcript format. `permission-mode`/`mode` records track mode changes, not per-call decisions | typed per-action-kind JSON-RPC approval requests exist in the app-server v2 schema (`ExecCommandApprovalParams` etc., listing only, not read) | none typed found | typed, per-action-kind (exec, patch, file-change, command-execution, generic permissions) | Neither CLI persists an approval decision as a rollout/transcript row in what this pass read. A Feed "approval" row on either side would have to come from a live hook/JSON-RPC overlay, not the settled transcript |

## What I could not verify

- The exact meaning of several new Claude Code record types (`bridge-session`, `atis-latch`, `relocated`, `history-suppression`, `frame-link`, `last-prompt`, `mode`, `permission-mode`, `queue-operation`, `worktree-state`, `file-history-snapshot`/`file-history-delta`, `cost-state`, `ai-title`, `custom-title`) beyond their own `type` string and a plausible reading from neighboring records. Claude Code's public docs do not document the transcript JSONL format itself, only the hooks and hook-input shapes.
- Whether Argo's desktop, spawning a plain `claude` binary in a pty for an interactive or headless session, would ever produce the harness-level tools (`ToolSearch`, `Monitor`, `SendMessage`, `TaskOutput`, `TaskStop`, `ScheduleWakeup`, and similar) found in this machine's transcripts. These are documented Claude Code features per the docs I read, but I did not run a bare `claude` session outside this harness to confirm which subset appears there.
- The exact JSON-RPC notification shapes behind `ContextCompactedNotification`, `CommandExecutionRequestApprovalParams`, `FileChangeRequestApprovalParams`, `McpToolCallProgressNotification`, and the rest of the ~150-file `codex-rs/app-server-protocol/schema/json/v2/` directory. I listed the directory and read none of the individual schema files. Each is a small, well-named JSON Schema file and reading the ones most relevant to Feed rows (compaction, approvals, file change, MCP tool call, command exec) would be the natural next step.
- Whether the Codex CLI version(s) that wrote this machine's sampled rollouts ever emit the modern `TurnItem` shapes at all, or whether those only appear via the JSON-RPC app-server transport (used by managed/IDE-driven sessions) and never in a plain rollout file. The rollout sample showed almost entirely legacy shapes. I did not find a rollout file containing a `CommandExecutionItem`, `McpToolCallItem`, or `FileChangeItem` literally, only their `event_msg`/`item_completed` wrapper with an `item.type` naming them, which suggests these do appear in rollout files (via `event_msg` framing) but I did not verify a full item body's field-for-field match against the source struct from a live sample beyond `FileChange.changes` and the enum fields already quoted above.
- The full `AgentMessageContent`/`AgentMessageDelivery`/`AsyncUserInputQuestion` async-question mechanism in `items.rs:124-148` (an `AgentMessageItem` can itself carry `questions: Option<Vec<AsyncUserInputQuestion>>` with an `Async` delivery mode) was read from source but not cross-checked against any live transcript in this pass. It may be a second, newer Codex question mechanism alongside `RequestUserInputEvent`.
