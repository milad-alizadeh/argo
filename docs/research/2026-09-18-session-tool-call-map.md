# Session tool-call map

Date: 2026-09-18

Scope: Feed and Roster projection for Claude Code and Codex transcript records.

## Sources

- `docs/domain/l3-runtime-tree.md` defines Agent, Session, Subagent, Turn, Message, Thought, Tool Call, Result, Plan, Workspace, Compaction, and Usage. It also says that Subagent grouping is derived rendering over the runtime tree, not a stored object. See `docs/domain/l3-runtime-tree.md:5`, `docs/domain/l3-runtime-tree.md:25`, `docs/domain/l3-runtime-tree.md:40`, `docs/domain/l3-runtime-tree.md:51`, and `docs/domain/l3-runtime-tree.md:60`.
- `docs/domain/not-domain-entities.md` says that Roster is a UI surface and that transcript-tailing parser is a runtime mechanism. See `docs/domain/not-domain-entities.md:3`.
- ADR-0024 says that there is one session-drive port with one adapter per CLI, and that observation is not on that port. See `docs/adr/0024-session-drive-port-two-adapters.md:38` and `docs/adr/0024-session-drive-port-two-adapters.md:47`.
- `SessionSource` is the observation adapter shape that shared Session code consumes today. It exposes transcript discovery, transcript-chain reads, optional full-record disposal, optional managed rows, optional shell output, optional Subagent transcript reads, optional Subagent usage, optional lock checks, and optional live overlays. See `apps/desktop/src/core/sessions/session-source.ts:30`.

## Shared projection model

The shared Feed schema has these reader-facing tool-call kinds: `command`, `read`, `edited`, `created`, `tool`, `skill`, and `searched`. It also has `delegation` rows for agent and shell background work, `marker` rows for compaction and interruption, and `ask` rows for structured questions. See `apps/desktop/src/core/sessions/feed-rows.ts:23`, `apps/desktop/src/core/sessions/feed-rows.ts:62`, `apps/desktop/src/core/sessions/feed-rows.ts:96`, and `apps/desktop/src/core/sessions/feed-rows.ts:151`.

`tool-feed.ts` is the main shared tool presentation catalogue. It maps raw CLI tool names to reader-facing kind, label, evidence, text, and status. See `apps/desktop/src/core/sessions/tool-feed.ts:40`, `apps/desktop/src/core/sessions/tool-feed.ts:96`, `apps/desktop/src/core/sessions/tool-feed.ts:117`, and `apps/desktop/src/core/sessions/tool-feed.ts:145`.

`tool-groups.ts` is the second shared presentation catalogue. It maps the same reader-facing kinds to icons, inline/evidence route, group verbs, and group nouns. It also controls which tools stand alone and how adjacent tool runs fold. See `apps/desktop/src/core/sessions/tool-groups.ts:24`, `apps/desktop/src/core/sessions/tool-groups.ts:44`, `apps/desktop/src/core/sessions/tool-groups.ts:56`, and `apps/desktop/src/core/sessions/tool-groups.ts:79`.

`signals.ts` reads Roster activity and work lists from the same transcript records. It reuses `toolPresentation` for the active text, but it also hard-codes Claude `Bash` as the shell tool. See `apps/desktop/src/core/sessions/signals.ts:12`, `apps/desktop/src/core/sessions/signals.ts:43`, `apps/desktop/src/core/sessions/signals.ts:69`, and `apps/desktop/src/core/sessions/signals.ts:133`.

## Claude map

| Source shape | Adapter read | Shared record or row | Source |
| --- | --- | --- | --- |
| `tool_use` block | `readToolCalls` keeps `id`, `name`, and object input. | `ToolCall` on a `message`; later Feed projection resolves it into a tool row. | `apps/desktop/src/agents/claude/sessions/block-reader.ts:56` |
| `tool_result` block | `readToolResults` joins by `tool_use_id`, extracts text/media blocks, failed state, and optional background receipt. | `ToolResult`, keyed by call id. | `apps/desktop/src/agents/claude/sessions/block-reader.ts:90` |
| `Bash` | Shared `tool-feed.ts` maps it to `command`; shared `signals.ts` treats it as the shell-command source. | Feed tool row and Roster shell command. | `apps/desktop/src/core/sessions/tool-feed.ts:42`, `apps/desktop/src/core/sessions/signals.ts:14` |
| `Edit` | Shared presentation maps it to `edited`. `tool-changes.ts` builds a diff from `old_string` and `new_string`. | Feed tool row with diff evidence. | `apps/desktop/src/core/sessions/tool-feed.ts:46`, `apps/desktop/src/core/sessions/tool-changes.ts:15` |
| `Read` | Shared presentation maps it to `read`; shared evidence route treats its result as a document. | Feed tool row with document evidence. | `apps/desktop/src/core/sessions/tool-feed.ts:47`, `apps/desktop/src/core/sessions/tool-feed.ts:73` |
| `Write` | Shared presentation maps it to `created`. `tool-changes.ts` builds a created-file diff from `content`. | Feed tool row with diff evidence. | `apps/desktop/src/core/sessions/tool-feed.ts:48`, `apps/desktop/src/core/sessions/tool-changes.ts:21` |
| `Skill` | Shared presentation maps it to `skill`, and the adapter reads a later `skill-body` record keyed by call id. | Standalone Feed tool row with body text. | `apps/desktop/src/core/sessions/tool-feed.ts:49`, `apps/desktop/src/core/sessions/tool-feed.ts:118`, `apps/desktop/src/agents/claude/sessions/records.ts:89` |
| `AskUserQuestion` | Shared `tool-feed.ts` validates the Claude question input. | Feed `ask` row with answer text when the result lands. | `apps/desktop/src/core/sessions/tool-feed.ts:24`, `apps/desktop/src/core/sessions/tool-feed.ts:161` |
| `Task` or `Agent` | Claude adapter removes the tool row and emits `delegation` records for spawned and landed states. | Feed/Roster Subagent card. | `apps/desktop/src/agents/claude/sessions/spawned-agents.ts:6`, `apps/desktop/src/agents/claude/sessions/spawned-agents.ts:62` |
| `<task-notification>` | Claude command-envelope parser reads agent or shell completion notification and optional background-task ending. | `delegation` record and optional `background-task` record. | `apps/desktop/src/agents/claude/sessions/command-envelope.ts:125`, `apps/desktop/src/agents/claude/sessions/background-task.ts:14` |
| `<local-command-stdout>` | Claude command-envelope parser strips terminal output. | `command-output` record. | `apps/desktop/src/agents/claude/sessions/command-envelope.ts:119` |
| `<realtime_delegation>` | Claude command-envelope parser reads a live delegation event. | `delegation` record. | `apps/desktop/src/agents/claude/sessions/command-envelope.ts:88` |
| `TodoWrite`, `TaskCreate`, `TaskUpdate` | Claude plan reader maps these tools to `PlanChange`. | Session Plan projection. | `apps/desktop/src/agents/claude/sessions/plan-changes.ts:39` |
| `compact_boundary` and compaction summary replay | Claude records parser emits compaction records and folds replayed summary into the marker path. | Feed `marker` row. | `apps/desktop/src/agents/claude/sessions/records.ts:129`, `apps/desktop/src/agents/claude/sessions/command-envelope.ts:165` |

## Codex map

| Source shape | Adapter read | Shared record or row | Source |
| --- | --- | --- | --- |
| `response_item` `function_call` | Codex adapter reads JSON string arguments into a shared `ToolCall`. | Feed tool row unless filtered as collaboration. | `apps/desktop/src/agents/codex/sessions/tool-calls.ts:63` |
| `response_item` `custom_tool_call` | Codex adapter keeps non-`exec` input as one string; for `exec`, it parses nested `tools.<name>(...)` calls. | One or more shared `ToolCall` records. | `apps/desktop/src/agents/codex/sessions/tool-calls.ts:68`, `apps/desktop/src/agents/codex/sessions/nested-tool-call.ts:60` |
| `function_call_output` or `custom_tool_call_output` | Codex adapter reads rich results and emits an empty user message with tool results. | `ToolResult`, keyed by call id. | `apps/desktop/src/agents/codex/sessions/tool-calls.ts:119` |
| `exec_command` and `exec` | Shared presentation maps them to `command` and reads `cmd` or raw `input` as inline text. | Feed command row and Roster activity. | `apps/desktop/src/core/sessions/tool-feed.ts:53`, `apps/desktop/src/core/sessions/tool-feed.ts:135` |
| Nested `tools.apply_patch(...)` | Codex adapter extracts patch text from a script constant or argument; shared presentation maps it through `apply-patch.ts`. | Feed edit/create row with diff evidence. | `apps/desktop/src/agents/codex/sessions/tool-calls.ts:35`, `apps/desktop/src/core/sessions/tool-feed.ts:65`, `apps/desktop/src/core/sessions/apply-patch.ts:1` |
| Nested `tools.web__run(...)` | Codex adapter extracts query or URL from script-like arguments; shared presentation maps it to `searched`. | Feed search row and Roster activity. | `apps/desktop/src/agents/codex/sessions/tool-calls.ts:49`, `apps/desktop/src/core/sessions/tool-feed.ts:62` |
| `write_stdin`, `wait`, `sleep` | Codex adapter filters these command-poll calls. | No Feed row. | `apps/desktop/src/agents/codex/sessions/tool-calls.ts:86` |
| `spawn_agent`, `wait_agent`, `send_message`, `followup_task`, `list_agents`, `interrupt_agent` | Codex adapter filters collaboration calls. If all calls are collaboration calls, it emits a boundary trace. | No tool row; activity comes from `SubAgentActivity`. | `apps/desktop/src/agents/codex/sessions/tool-calls.ts:89`, `apps/desktop/src/agents/codex/sessions/tool-calls.ts:105` |
| `SubAgentActivity` item | Codex adapter maps `started` to `running` and `completed` to `completed`, using `agent_thread_id` as group id and `agent_path` as label source. | Feed/Roster Subagent card. | `apps/desktop/src/agents/codex/sessions/subagent-activity.ts:4`, `apps/desktop/src/agents/codex/sessions/subagent-activity.ts:14` |
| `FunctionCallOutput` item for `create_thread` | Codex adapter recovers the delegated prompt from the output. | User prose message in the child-thread context. | `apps/desktop/src/agents/codex/sessions/records.ts:16` |
| `CommandExecution` item | Codex adapter reads command cwd and branch place facts. | Session place metadata. | `apps/desktop/src/agents/codex/sessions/records.ts:41` |
| `update_plan` function call or nested tool call | Codex plan reader parses `{ plan: [{ step, status }] }`, including script-local `plan` arrays. | Session Plan projection. | `apps/desktop/src/agents/codex/sessions/plan-changes.ts:1`, `apps/desktop/src/agents/codex/sessions/plan-changes.ts:53` |
| `reasoning` response item | Codex adapter strips Markdown headline markers and emits `thought` blocks. | Feed thought row and Roster activity. | `apps/desktop/src/agents/codex/sessions/reasoning-summary.ts:1` |
| `compacted` record | Codex parser emits a compaction marker. | Feed `marker` row. | `apps/desktop/src/agents/codex/sessions/records.ts:147` |
| `session_meta` with subagent source | Codex parser marks subagent threads and records parent/path metadata. Discovery drops them from the main Roster and reads them only when a parent delegation opens. | Graceful degradation to parent card plus optional child Feed. | `apps/desktop/src/agents/codex/sessions/records.ts:114`, `apps/desktop/src/agents/codex/sessions/discover.ts:48`, `apps/desktop/src/agents/codex/sessions/discover.ts:127` |

## Friction map

The shared projection already has the right domain terms. `ToolCall`, `Result`, `Subagent`, `Plan`, and `Compaction` match the domain model. The leak is that several shared modules still know raw CLI tool names. `tool-feed.ts` knows Claude names (`Bash`, `Edit`, `Read`, `Write`, `Skill`, `AskUserQuestion`) and Codex names (`exec_command`, `exec`, `web__run`, `apply_patch`). `signals.ts` also knows `Bash` as the only shell tool. See `apps/desktop/src/core/sessions/tool-feed.ts:40` and `apps/desktop/src/core/sessions/signals.ts:14`.

The Feed and Roster share `Session.activity`, which is good. They still depend on a shared presentation catalogue that mixes domain kind, label grammar, evidence route, fallback text, and CLI-specific extraction. See `apps/desktop/src/core/sessions/feed-rows.ts:53`, `apps/desktop/src/core/sessions/signals.ts:133`, `apps/desktop/src/core/sessions/tool-feed.ts:96`, and `apps/desktop/src/core/sessions/tool-groups.ts:24`.

Subagent projection is close to the desired shape. Claude `Task`/`Agent` and Codex `SubAgentActivity` both become `delegation` rows. The difference is in where the adapter emits the lifecycle: Claude derives it from spawning calls and task notifications, while Codex derives it from explicit activity items. See `apps/desktop/src/agents/claude/sessions/spawned-agents.ts:62` and `apps/desktop/src/agents/codex/sessions/subagent-activity.ts:14`.

Graceful degradation exists in several places. Unknown tools become `kind: "tool"` with a `Ran <name>` label. Unknown text inputs can still render as raw text or JSON. Optional adapter features on `SessionSource` can be absent. See `apps/desktop/src/core/sessions/tool-feed.ts:92`, `apps/desktop/src/core/sessions/tool-feed.ts:105`, and `apps/desktop/src/core/sessions/session-source.ts:38`.

The next deeper module is probably not another renderer helper. It is a shared Tool Call projection module with adapter-owned raw decoding and one reader-facing presentation shape. The interface must be small enough that a future CLI can provide records without changing shared Feed/Roster text logic.
