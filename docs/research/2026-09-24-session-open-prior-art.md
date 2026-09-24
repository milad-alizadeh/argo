# Opening an existing agent session: prior art

Checked on 2026-09-24. This note uses product documentation, an app's own repository, and the Agent Client Protocol (ACP) specification. A live channel is a connection that can send a prompt to the agent.

## Product behavior

| Product | What the user can open | Documented restore or adoption point |
| --- | --- | --- |
| Conductor | A saved chat tab or workspace. Conductor saves local chat history in its own Application Support directory. Its History pane can restore an archived workspace with saved chat and workspace state. [Saved tabs](https://www.conductor.build/changelog/0.17.5-tab-beautification), [storage](https://www.conductor.build/docs/reference/privacy), [restore](https://www.conductor.build/docs/troubleshooting/issues) | The public sources do not say whether opening a saved chat starts or resumes Claude Code, Codex, Cursor, or OpenCode. They do not establish a separate import path for conversations created outside Conductor. [Harnesses](https://www.conductor.build/docs/reference/harnesses), [restore](https://www.conductor.build/docs/troubleshooting/issues) |
| VS Code | Its Agents window can discover and open sessions created by Copilot CLI, the Copilot app, Claude Code, and Codex. External sessions are hidden by default. [Manage sessions](https://code.visualstudio.com/docs/agents/run/sessions/manage-sessions) | The docs put adoption at the first message sent from VS Code. They say that opening an external session shows a one-time banner. They do not describe the underlying channel setup at either point. [Manage sessions](https://code.visualstudio.com/docs/agents/run/sessions/manage-sessions), [session concept](https://code.visualstudio.com/docs/agents/concepts/sessions) |
| Zed | Its import command asks configured external agents over ACP for existing threads. It adds them as archived history entries. Opening an entry restores it for continued work. [External Agents](https://zed.dev/docs/ai/external-agents) | Restoration occurs on open, according to the user documentation. The docs do not state whether Zed uses ACP `session/load` or `session/resume` for each agent. External agents run in separate processes. [External Agents](https://zed.dev/docs/ai/external-agents) |
| agent-sessions terminal app | Its list and preview show conversations from Claude Code, Gemini CLI, Codex, Cursor Agent, and Windsurf. The repository names native history locations for each provider. [Repository](https://github.com/vineethkrishnan/agent-sessions) | Pressing `p` previews the conversation. Pressing Enter resumes it through the agent's native command. The preview and resume are separate actions. [Repository](https://github.com/vineethkrishnan/agent-sessions) |

## Protocol distinction

ACP defines three separate operations. `session/list` returns session metadata for discovery and does not restore a session. `session/load` restores an agent session and streams its complete conversation to the client. `session/resume` restores the session context without replaying prior messages. Each operation depends on an advertised agent capability. These are protocol choices, not proof that a named product uses each method. [List](https://agentclientprotocol.com/protocol/v1/session-list), [load and resume](https://agentclientprotocol.com/protocol/v1/session-setup).

## Speed and the design question

The cited sources provide no comparable measurement of click-to-history or click-to-ready time for Conductor, VS Code, Zed, or agent-sessions. Conductor reports broad performance improvements and a shorter delay before an agent's first action, but gives no measurement for opening an existing chat. [Conductor change](https://www.conductor.build/changelog/0.46.0-bug-fixes-instant-archiving-terminal).

The documented behavior supports showing history before the user asks to drive a session: VS Code opens an external session before adoption, and agent-sessions has a separate preview action. Zed documents a different path: open restores an imported archived thread. Conductor's public docs leave this timing undecided. None of these sources proves that native resume must happen on selection, or that deferring it improves measured latency.
