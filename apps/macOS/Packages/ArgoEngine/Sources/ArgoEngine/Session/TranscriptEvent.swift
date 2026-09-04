/// One thing a transcript said, typed. The engine's output: a file becomes a stream of these, in
/// the order the records carrying them were written. Folding these meanings into Turns and Agents
/// is the Hub's job, since it needs the whole session in memory to do it.
public enum TranscriptEvent: Sendable, Equatable {
    /// A message-bearing record's stable identity. The Hub uses these identities to resolve a
    /// resumed file's `headLeaf` back to the physical transcript that owns it.
    case recordIdentity(uuid: String)
    /// The head of the resume chain, off the line-0 `last-prompt` record.
    case headLeaf(uuid: String)
    /// The id of the session this chain STARTED as, off the snake_case `session_id` every
    /// message-bearing record carries. Equal to the file's own id for all but a relocated
    /// transcript, where it is the only key the two halves share (#735).
    case originSession(id: String)
    /// The host's own title for the session, verbatim.
    case title(String)
    /// The working directory the records report. LATEST reading wins, and it is emitted only when
    /// it changes rather than once per record: `EnterWorktree` moves a run's root mid-session, and
    /// a Workspace pinned to the folder it started in reads the wrong repository (#1118).
    case cwd(String)
    /// The model id off an assistant record. Its LATEST reading is what the session is on now.
    case model(String)
    /// The effort level the records report, in the CLI's OWN word for it and unread — what it means
    /// on Argo's own scale is `SessionEffort`'s to say (#558). Latest reading wins, like the model
    /// above and for the same reason: `/effort` moves it mid-session and the file keeps both.
    case effort(cli: String)
    /// The branch the records report. Latest reading wins: a run can switch branch mid-session.
    case branch(String)
    /// How the process was started, in the CLI's OWN word for it and unread — what it means on
    /// Argo's own axis is `SessionEntry`'s to say. First reading only, like the cwd above and for
    /// the same reason: a file's entrypoint is settled when it is opened.
    case entry(cli: String)
    /// The standing autonomy stance the records report, in the CLI's OWN word for it and unread —
    /// what it means on Argo's ladder is `ClaudePermissionMode`'s to say (ADR-0025). Latest reading
    /// wins: the stance can be cycled mid-session, and the file keeps both.
    case mode(cli: String)
    /// What someone asked for, verbatim and unclamped, and the pictures it was sent with. Steering
    /// text typed mid-run arrives here too: a steer is a prompt into the same sequence.
    ///
    /// The text is verbatim but for the CLI's own `[Image #3]` placeholders, which are taken out
    /// one per picture actually carried — see `HarnessRecord`.
    case prompt(text: String, images: [MediaEvidence], atMs: Int?)
    /// What the agent SAID, verbatim.
    case message(markdown: String)
    /// What the agent REASONED, verbatim. Never read as a message: a turn's final message
    /// routinely contradicts its own reasoning.
    case thought(markdown: String)
    /// A skill was handed to the Session, and what Argo can read behind it (#688). The record files
    /// this as plumbing beside the prompt rather than as something anyone said, which is why it is
    /// an event of its own and not a second reading of the user's own line.
    case skillLoaded(SkillLoad)
    /// A call was emitted.
    case toolCall(ToolCall)
    /// A call's result came back. Carries the call's id rather than the call, because the two are
    /// read from two different records.
    case toolCallOutcome(ToolCallOutcome)
    /// A Turn ended, and why. Emitted only where the record's reason SAYS the turn is over: one
    /// that continues into a tool call closes nothing.
    case turnEnded(StopReason)
    /// A Turn started again with nobody typing: a background agent reported, and the CLI put the
    /// agent back to work on it (#1299). A fan-out ends its Turn to wait for its delegates, so the
    /// report is the only record that says the next one began.
    ///
    /// A boundary and nothing else — there is nothing here for anyone to DRAW. The moment rides
    /// along because the Turn it opens has no prompt behind it to be clocked from
    /// (`SessionRosterProjection+Clock`).
    case turnResumed(atMs: Int?)
    /// Somebody stopped the Turn. Its own case rather than a `.prompt` carrying the CLI's marker
    /// (#1189), because the marker is the one user entry that is not a thing anybody asked for:
    /// read as a prompt it opens a Turn on the very act that ended one, and the Session never comes
    /// back off `running`. The sentence behind it is `ClaudeInterrupt`'s — the reading lives beside
    /// the keystroke that produces it.
    ///
    /// A boundary AND a mark: the Hub closes the Turn `cancelled` on it, and the feed draws it as
    /// punctuation rather than in the reader's own voice.
    case interrupted(atMs: Int?)
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
    /// A branch the CLI abandoned starts at the named record, and everything the reading took from
    /// it onward belongs to a Turn that was submitted again (#1202).
    ///
    /// A transcript is a TREE — every record names the one it answers — and a Turn submitted twice
    /// leaves two children on one parent. Only the later child is the branch the CLI went on with,
    /// but the file keeps both, so a reading that appends every line in file order draws the same
    /// words twice with one answer under them.
    ///
    /// It names the record the abandoned branch OPENED rather than carrying the events to drop:
    /// what has to go is everything the reading has taken since, and only the reading knows how
    /// much that is.
    case superseded(fromRecord: String)
    /// The reading skipped a stretch of the file here — the seam a BOUNDED read leaves between a
    /// transcript's two ends (`TranscriptExcerpt`), which is what a launch sweep takes.
    ///
    /// An explicit event, in its own place in the sequence, because every fact folded out of the
    /// stream afterwards is a fact about a reading with a hole in it. A sum is the honesty
    /// question: `HubSession.transcriptExtent` is what this sets, and what keeps a partial total
    /// from being rendered as a whole one (`CONTEXT.md` Honesty tier).
    case excerpted
}
