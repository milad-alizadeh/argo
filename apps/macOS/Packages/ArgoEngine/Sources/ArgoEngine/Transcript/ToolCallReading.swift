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
    planTool: .plan,
    "ExitPlanMode": .plan,
    // The two that write the same list an entry at a time. `plan` and not `other`: the pill draws
    // what they wrote, and a feed drawing them too would say it a second time in rows
    // (`FeedCallReading`). Named by the constants below rather than repeated as strings, so a third
    // one is added in one place.
    //
    // `TaskList` is deliberately NOT here, and neither are `TaskStop`/`TaskOutput`: none of them
    // writes to the list, and `plan` is not an inert label — it hides the row. A read the agent
    // performed would disappear from the rendering without joining the pill.
    taskCreateTool: .plan,
    taskUpdateTool: .plan,
    // Tools that CHANGE something outside the agent, which a feed must not fold away as a look.
    // `execute` rather than `edit`: none of them produces a patch, and `execute` is precisely the
    // kind whose effect the record does not describe.
    "EnterWorktree": .execute,
    "ExitWorktree": .execute,
    "Skill": .skill,
]

/// The tool whose input IS the whole Plan.
let planTool = "TodoWrite"

/// The two that write it one entry at a time instead, folded into a list by `PlanLedger`.
let taskCreateTool = "TaskCreate"
let taskUpdateTool = "TaskUpdate"

/// The fields those two write it in. `taskId` is camel-cased where the background-task tools spell
/// the same idea `task_id` — which is the host telling two vocabularies apart, not a typo, and the
/// reason `TaskStop` is not read as a write to this list.
let taskSubjectKey = "subject"
let taskStatusKey = "status"
let taskIDKey = "taskId"

/// Where a create's RESULT reports the id updates will name it by — the only place it is written.
let taskResultKey = "task"
let taskResultIDKey = "id"

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

/// A status the record actually wrote, or nothing.
///
/// Strict, because an incremental write is only worth folding in where it SAYS something: an update
/// that carried no status — a rewording — must leave the entry's own status alone rather than reset
/// it to a default. A whole-list write reads it the other way and falls back to `pending`: that
/// list is replaced entire, so the entry exists either way and the only question is what it says.
func writtenPlanEntryStatus(_ raw: String?) -> PlanEntryStatus? {
    switch raw {
    case "pending": .pending
    case "in_progress": .inProgress
    case "completed": .completed
    default: nil
    }
}

/// `TodoWrite`'s input → the Plan. An entry with no text is dropped rather than shown blank, and a
/// plan with no readable entries at all is absent rather than empty: the agent replaced its list
/// with something, and claiming it emptied it would be a different statement.
func plan(from input: JSONValue) -> Plan? {
    let entries = input["todos"]?.array.compactMap { todo -> PlanEntry? in
        guard let text = todo.stringField("content") else { return nil }
        let written = writtenPlanEntryStatus(todo.stringField(taskStatusKey))
        return PlanEntry(text: text, status: written ?? .pending)
    } ?? []
    return entries.isEmpty ? nil : Plan(entries: entries)
}
