// Reading a to-do list out of a CLI transcript, shared by the nudge hook and the coverage scan.
// One module rather than a constant in each: the hook asks "has this Session written a list?" and
// the scan asks "how many Sessions did?", and two answers to the same question that can drift are
// two numbers nobody can compare (#1254).
//
// Verified against ~/.claude/projects: a call is `message.content[]` with `type: "tool_use"` and a
// `name`. Records carry `isSidechain` when a sub-agent made them.

/** The tools that write the list. `TodoWrite` stays because a harness still exposing it writes a
 * list Argo reads; its absence from every transcript is what made the AGENTS.md line naming it a
 * no-op. Codex is absent on purpose: across 62 rollouts under ~/.codex/sessions, `update_plan` is
 * never a call name — Codex reaches it through `exec`, as `tools.update_plan({...})` inside a
 * script — so listing it would detect nothing and read as though it did. */
export const LIST_TOOLS = new Set(['TaskCreate', 'TaskUpdate', 'TodoWrite'])

/** The tools that change a file, which is what makes a session one that owed a list. */
export const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit'])

/**
 * The tool calls one transcript line made, or nothing.
 *
 * Structural, never a substring search over the raw text: the harness writes its own tool listing
 * and its "task tools not used recently" reminder into transcripts, and a bare match on
 * `"name":"TaskCreate"` reads those as a list the session wrote.
 *
 * A half-written last line and a corrupt one both read as nothing. Neither is worth abandoning
 * the file over, and the hook that calls this must never wedge a prompt.
 *
 * @returns {{ names: string[], sidechain: boolean } | null}
 */
export function toolCallsIn(line) {
  if (!line.startsWith('{')) return null
  let record
  try {
    record = JSON.parse(line)
  } catch {
    return null
  }
  const content = record.message?.content
  if (!Array.isArray(content)) return null
  const names = content.filter((block) => block.type === 'tool_use').map((block) => block.name)
  return names.length === 0 ? null : { names, sidechain: Boolean(record.isSidechain) }
}

/** True when the SESSION wrote a list on this line. A sub-agent's does not count: the Plan is
 * Session-scoped (ADR-0020), so a delegate's own to-do list is never the Session's, and letting
 * one answer for the Session would silence the nudge for a session that still owes a list. */
export function writesSessionList(made) {
  return !made.sidechain && made.names.some((name) => LIST_TOOLS.has(name))
}
