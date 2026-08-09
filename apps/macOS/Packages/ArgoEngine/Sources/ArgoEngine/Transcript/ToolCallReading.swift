// One `tool_use` part becomes one Tool Call. The host's tool NAME travels verbatim; the coarse
// `kind` beside it is what makes the record CLI-agnostic. A name this table does not know reads as
// `other` — never as a guessed kind.

import Foundation

private let kindByName: [String: ToolCallKind] = [
    "Read": .read,
    "NotebookRead": .read,
    "Edit": .edit,
    "MultiEdit": .edit,
    "Write": .edit,
    "NotebookEdit": .edit,
    "Bash": .execute,
    "BashOutput": .execute,
    "KillShell": .execute,
    "Grep": .search,
    "Glob": .search,
    "ToolSearch": .search,
    "WebFetch": .fetch,
    "WebSearch": .fetch,
    "Task": .delegate,
    "Agent": .delegate,
    "Workflow": .delegate,
    "TodoWrite": .plan,
    "ExitPlanMode": .plan,
    // Tools that CHANGE something outside the agent, which a feed must not fold away as a look.
    // `execute` rather than `edit`: none of them produces a patch, and `execute` is precisely the
    // kind whose effect the record does not describe.
    "EnterWorktree": .execute,
    "ExitWorktree": .execute,
    "Skill": .skill,
]

/// The tool whose input IS the Plan.
let planTool = "TodoWrite"

/// How a host names a tool it reached over MCP: `mcp__<server>__<tool>`. A prefix rather than a
/// registry, because the tools behind it are arbitrary — the name is the only thing that says where
/// one came from, and it says it verbatim.
public let mcpToolPrefix = "mcp__"

/// The delimiter the same convention puts between the server and the tool it exposes.
public let mcpNameSeparator = "__"

func toolCallKind(_ name: String) -> ToolCallKind {
    if let known = kindByName[name] {
        return known
    }
    return name.hasPrefix(mcpToolPrefix) ? .mcp : .other
}

/// The one field worth naming for the kinds that name something. Read in order because a tool
/// carries at most one of these; nothing is synthesized when it carries none.
private let targetKeys = [
    "file_path", "path", "command", "pattern", "url", "skill", "description",
]

func toolCallTarget(_ input: JSONValue) -> String? {
    for key in targetKeys {
        if let value = input.stringField(key) {
            return value
        }
    }
    return nil
}

/// The key a host asks the agent to narrate its call in. One key rather than a table: every tool
/// that carries an account of itself carries it under this name, and a tool that carries none is
/// the honest silence rather than a gap to fill from somewhere else.
private let narrationKey = "description"

/// The agent's own account of what a call was for, verbatim, or nothing.
///
/// Blank is nothing said rather than an empty thing said — the same reading prose already gets, and
/// for the same reason: a row whose subject is the empty string is a row that lost its subject.
func toolCallNarration(_ input: JSONValue) -> String? {
    guard let written = input.stringField(narrationKey),
          !written.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return nil }
    return written
}

private func planEntryStatus(_ raw: String?) -> PlanEntryStatus {
    switch raw {
    case "in_progress": .inProgress
    case "completed": .completed
    default: .pending
    }
}

/// `TodoWrite`'s input → the Plan. An entry with no text is dropped rather than shown blank, and a
/// plan with no readable entries at all is absent rather than empty: the agent replaced its list
/// with something, and claiming it emptied it would be a different statement.
func plan(from input: JSONValue) -> Plan? {
    let entries = input["todos"]?.array.compactMap { todo -> PlanEntry? in
        guard let text = todo.stringField("content") else { return nil }
        return PlanEntry(text: text, status: planEntryStatus(todo.stringField("status")))
    } ?? []
    return entries.isEmpty ? nil : Plan(entries: entries)
}
