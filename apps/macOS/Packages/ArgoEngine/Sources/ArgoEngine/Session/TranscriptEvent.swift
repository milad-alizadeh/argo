/// One thing a transcript said, typed. The engine's output: a file becomes a stream of these, in
/// the order the records carrying them were written. Folding these meanings into Turns and Agents
/// is the Hub's job, since it needs the whole session in memory to do it.
public enum TranscriptEvent: Sendable, Equatable {
    /// A message-bearing record's stable identity. The Hub uses these identities to resolve a
    /// resumed file's `headLeaf` back to the physical transcript that owns it.
    case recordIdentity(uuid: String)
    /// The head of the resume chain, off the line-0 `last-prompt` record.
    case headLeaf(uuid: String)
    /// The host's own title for the session, verbatim.
    case title(String)
    /// The working directory the records report. Emitted on its first reading and again only when
    /// it changes, rather than once per record.
    case cwd(String)
    /// The model id off an assistant record. Its LATEST reading is what the session is on now.
    case model(String)
    /// The branch the records report. Latest reading wins: a run can switch branch mid-session.
    case branch(String)
    /// What someone asked for, verbatim and unclamped. Steering text typed mid-run arrives here
    /// too: a steer is a prompt into the same sequence.
    case prompt(text: String, atMs: Int?)
    /// What the agent SAID, verbatim.
    case message(markdown: String)
    /// What the agent REASONED, verbatim. Never read as a message: a turn's final message
    /// routinely contradicts its own reasoning.
    case thought(markdown: String)
    /// A call was emitted.
    case toolCall(ToolCall)
    /// A call's result came back. Carries the call's id rather than the call, because the two are
    /// read from two different records.
    case toolCallOutcome(ToolCallOutcome)
    /// A Turn ended, and why. Emitted only where the record's reason SAYS the turn is over: one
    /// that continues into a tool call closes nothing.
    case turnEnded(StopReason)
    /// The host noted that a prompt was QUEUED rather than run. It is the one thing that tells a
    /// queued prompt's file apart from a Session whose agent simply has not answered yet.
    case queued
    /// What a record reported spending. One per assistant record that carries a `usage` object —
    /// the grain the host actually prices, since every request is billed on its own.
    ///
    /// A SIDECHAIN record reports none of these: a subagent's spend is read off the delegating
    /// call's result, and reading both would count the same tokens twice.
    case usage(Usage)
    /// The agent replaced its to-do list.
    case plan(Plan)
    /// History was condensed here. The resume chain stitches across it.
    case compaction(atMs: Int?)
    /// A line that is not a readable record: malformed JSON, or JSON that is not an object. An
    /// explicit event, so "nothing happened" stays distinguishable from "I could not read what
    /// happened"; the raw text rides along.
    case unreadableLine(raw: String)
}
