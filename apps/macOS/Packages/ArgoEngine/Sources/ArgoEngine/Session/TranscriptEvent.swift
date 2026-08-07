/// One thing a transcript said, typed. The engine's output: a file becomes a stream of these, in
/// the order the records carrying them were written.
///
/// A stream rather than an assembled tree, deliberately. Records arrive one at a time and a live
/// file has no end, so the reader's job is to say what each record MEANS; folding those meanings
/// into Turns and Agents is the Hub's job, and it needs the whole session in memory to do it.
public enum TranscriptEvent: Sendable, Equatable {
    /// A message-bearing record's stable identity. The Hub uses these identities to resolve a
    /// resumed file's `headLeaf` back to the physical transcript that owns it.
    case recordIdentity(uuid: String)
    /// The head of the resume chain, off the line-0 `last-prompt` record. Read here so the shape
    /// is not lost; the chain that stitches files by it is the Hub's.
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
    /// too: a steer is a prompt into the same sequence, and needs no second concept.
    case prompt(text: String, atMs: Int?)
    /// What the agent SAID, verbatim.
    case message(markdown: String)
    /// What the agent REASONED, verbatim. Never read as a message: the two are different
    /// provenance claims, and a turn's final message routinely contradicts its own reasoning.
    case thought(markdown: String)
    /// A call was emitted.
    case toolCall(ToolCall)
    /// A call's result came back. Carries the call's id rather than the call, because the two are
    /// read from two different records.
    case toolCallOutcome(ToolCallOutcome)
    /// The agent replaced its to-do list.
    case plan(Plan)
    /// History was condensed here. The resume chain stitches across it.
    case compaction(atMs: Int?)
    /// A line that is not a readable record: malformed JSON, or JSON that is not an object.
    ///
    /// An explicit event and not a silent skip. The line existed, something wrote it, and a reader
    /// that drops it on the floor cannot tell "nothing happened" from "I could not read what
    /// happened". The raw text rides along so nothing is lost by observing it.
    case unreadableLine(raw: String)
}
