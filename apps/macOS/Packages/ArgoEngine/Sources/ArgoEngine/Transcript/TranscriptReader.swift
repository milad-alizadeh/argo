import Foundation

/// One transcript's lines → the events they mean.
///
/// Stateful, and only just: a `tool_result` is read against the call it answers, which was declared
/// in an earlier record. Feeding it lines in order is the contract.
///
/// An `actor` because a live reader is fed from a file-watching stream while a caller consumes its
/// output, which under Swift 6 is a compile error unless something serialises it.
///
/// This file holds the reader's state and the routing. The readings themselves are three extension
/// files, split by the record each reads: `+Assistant`, `+Outcome` for the record answering a call,
/// and `+Report` for the one a background agent files.
public actor TranscriptReader {
    /// What a call needs to be remembered by until its result lands: the kind decides which
    /// evidence its result is read as, and the target is the path a disk fallback would re-read.
    ///
    /// This, and every member marked internal below, is internal rather than `private` only
    /// because the reader's own extension files read it, and `private` in Swift is file-scoped.
    /// The actor's isolation is what protects them; nothing outside this type touches any of it.
    struct OpenCall {
        let kind: ToolCallKind
        /// The host's own name, kept because one reading is gated on it rather than on the kind:
        /// a question's answer is worth keeping and this vocabulary has no kind for a question.
        let name: String
        let target: String?
    }

    var openCalls: [String: OpenCall] = [:]
    /// The reader's second memory, and for the same reason as its first: a host that writes its
    /// plan one entry at a time leaves the list itself nowhere in the record.
    var planLedger = PlanLedger()
    private var context = TranscriptContextCursor()
    /// The reader's third memory: where the file's prompts forked, so a Turn put twice draws one
    /// row rather than two (`TranscriptForks`, #1202).
    private var forks = TranscriptForks()
    /// The reader's fourth memory: the model the last `/model` asked for, held until that command's
    /// own output says whether the CLI took it (`CommandedModel`, #1411).
    private var askedModel: String?
    let readImage: ImageReader
    private let readSkill: SkillReader
    /// The file being read, where there is one, and where in it the line in hand starts. Set by
    /// `read(_:)` and read by the media reading alone: it is what lets a picture be addressed
    /// instead of held (`MediaLocation`). Absent for a reader handed a bare string, which is why a
    /// fixture's pictures are the one place bytes are still carried in an event.
    private(set) var location: MediaLocation?
    private let source: String?
    /// Whose record this is reading. Every guard it decides goes through `attributes(_:)`.
    private let subject: TranscriptSubject

    public init(
        subject: TranscriptSubject = .session,
        readImage: @escaping ImageReader = noImageReader,
        readSkill: @escaping SkillReader = noSkillReader,
    ) {
        self.init(source: nil, subject: subject, readImage: readImage, readSkill: readSkill)
    }

    /// The reader a tail builds: it knows which file it is reading, and so can address the pictures
    /// in it rather than retaining them.
    public init(
        source: URL?,
        subject: TranscriptSubject = .session,
        readImage: @escaping ImageReader = noImageReader,
        readSkill: @escaping SkillReader = noSkillReader,
    ) {
        self.source = source?.path
        self.subject = subject
        self.readImage = readImage
        self.readSkill = readSkill
    }

    /// Whether the Turn, spend and Plan a record reports belong to what this reader is reading.
    ///
    /// A Session's reading disowns a sidechain record's three, for the reasons on
    /// `TranscriptSubject`. A Subagent's own file is all sidechain, and all of it is its own.
    func attributes(_ message: MessageRecord) -> Bool {
        switch subject {
        case .session: !message.authorship.isSidechain
        case .subagent: true
        }
    }

    /// One line → the events it carried, in the order the record wrote them.
    ///
    /// Zero events is an ordinary answer, not a failure: a `system` record means nothing to this
    /// reader, and a record that is only plumbing has nothing to say.
    ///
    /// A bare string says nothing about where it sits, so this reading HOLDS its pictures rather
    /// than addressing them, whether or not the reader knows a file (`MediaLocation`) — an offset
    /// guessed at is an address pointing somewhere else.
    public func read(line: String) -> [TranscriptEvent] {
        location = nil
        return events(of: line)
    }

    /// One line, at its place in the file — the face a tail reads through, and the only one whose
    /// pictures can be addressed.
    public func read(_ line: TranscriptLine) -> [TranscriptEvent] {
        location = source.map {
            MediaLocation(transcript: $0, line: line.text, byteOffset: line.byteOffset)
        }
        defer { location = nil }
        let seam: [TranscriptEvent] = line.followsGap ? [.excerpted] : []
        // Whatever the gap swallowed, it is not the record the pending ask was waiting for
        // (`modelSettled`): a bounded read must not join two records the file never put together.
        if line.followsGap {
            askedModel = nil
        }
        return seam + events(of: line.text)
    }

    private func events(of line: String) -> [TranscriptEvent] {
        // A blank line is the file's own punctuation — the trailing newline every writer leaves —
        // and reporting it as unreadable would put noise in front of every real one.
        guard !line.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return [] }
        guard let record = TranscriptRecord.parse(line: line) else {
            return [.unreadableLine(raw: line)]
        }
        switch record {
        case let .user(message):
            // The record's own content is read FIRST, because whether it forks a branch depends on
            // whether it is a prompt — and the answer has to be known before the context cursor
            // runs, so a fork can make that cursor re-state what the dropped branch had announced.
            let said = userEvents(message)
            let fork = superseded(by: message, opening: said)
            if !fork.isEmpty {
                context.restate()
            }
            // Read before the cursor runs, because it MOVES the pending ask (`modelSettled`) and
            // the cursor is then handed what that move settled.
            let settled = modelSettled(by: message)
            // The marker goes BEFORE what this record opens, never after: the branch it supersedes
            // is everything the reading holds up to this moment, and a marker behind this record's
            // own events would take them back too.
            return fork + identity(of: message) + stance(of: message)
                + context.events(for: message)
                + context.events(forModelNamed: settled)
                + said
        case let .assistant(message):
            askedModel = nil
            return identity(of: message) + context.events(for: message) + assistantEvents(message)
        case let .attachment(message):
            askedModel = nil
            return identity(of: message) + context.events(for: message)
        case let .aiTitle(title):
            return [.title(title)]
        case let .lastPrompt(leafUuid):
            return [.headLeaf(uuid: leafUuid)]
        case .queueOperation:
            return [.queued]
        case let .permissionMode(observed):
            return [.mode(cli: observed)]
        case .unknown:
            return []
        }
    }

    /// The model this record SETTLES, where it is a `/model` command's own report of one (#1411).
    ///
    /// The command writes its invocation and its output as two consecutive records, so the ask is
    /// remembered off the first and released by the second. Anything else in between clears it —
    /// every other user record here, and every record carrying content in `events(of:)` — because
    /// an ask held across something else is one the CLI never came back to, and releasing it then
    /// would name a model off a sentence that was about something else.
    private func modelSettled(by message: MessageRecord) -> String? {
        if let asked = CommandedModel.asked(in: message.content) {
            askedModel = asked
            return nil
        }
        defer { askedModel = nil }
        return CommandedModel.reportsASet(in: message.content) ? askedModel : nil
    }

    /// The branch this record abandons, where it forks one (`TranscriptForks`).
    ///
    /// A SESSION's reading only, and nothing about a Subagent's file is being claimed: the marker
    /// is spent by `HubSession.apply`, and a Subagent's reading is appended raw beside the roster
    /// (`SubagentReadings`), so one emitted there would be a dead event in a stream that is
    /// compared by its length. `attributes(_:)` answers the same question for the Turn fold, and
    /// it carries the sidechain half of this guard — a fan-out puts several delegated agents under
    /// one call, and siblings there are the shape of the work rather than a Turn put twice.
    private func superseded(
        by message: MessageRecord,
        opening events: [TranscriptEvent],
    )
        -> [TranscriptEvent] {
        guard subject == .session, attributes(message) else { return [] }
        return forks.superseded(by: message, opening: events)
    }

    private func identity(of message: MessageRecord) -> [TranscriptEvent] {
        message.uuid.map { [.recordIdentity(uuid: $0)] } ?? []
    }

    /// A prompt states the stance it was submitted under, and it is the same observed fact the
    /// `permission-mode` record carries — which is why both are read (`TranscriptRecord`, #629).
    ///
    /// A PROMPT and nothing else: the host's own records carry the field too, and a Subagent's
    /// stance is not the root Session's fact. Counted, either is a record speaking after a set —
    /// which is what snaps the control back off a change that landed.
    private func stance(of message: MessageRecord) -> [TranscriptEvent] {
        guard !message.authorship.isMeta, !message.authorship.isCompactSummary,
              !message.authorship.isSidechain else { return [] }
        return message.permissionMode.map { [.mode(cli: $0)] } ?? []
    }

    /// Every line of a whole file, in order. The batch face of the same reader the tail uses, so a
    /// fixture and a live file are read by one code path.
    public func read(lines: [String]) -> [TranscriptEvent] {
        lines.flatMap { read(line: $0) }
    }

    /// Every line of one read, at its place in the file.
    public func read(_ lines: [TranscriptLine]) -> [TranscriptEvent] {
        lines.flatMap { read($0) }
    }

    private func userEvents(_ message: MessageRecord) -> [TranscriptEvent] {
        // A compact summary is the condensed history itself. Read as a prompt it would open a turn
        // titled with the summary of everything before it.
        if message.authorship.isCompactSummary {
            return [.compaction(atMs: message.timestampMs)]
        }

        let results = message.content.compactMap { block -> TranscriptEvent? in
            guard case let .toolResult(result) = block else { return nil }
            // A created task's id is reported HERE and nowhere else, so the ledger is fed as the
            // result goes past. No event of its own: an entry learning the name updates will
            // address it by is not a change to the list anybody is reading.
            planLedger.identify(call: result.toolUseId, from: message.toolUseResult)
            return .toolCallOutcome(outcome(of: result, in: message))
        }
        // A record carrying results is the tool answering, never the user asking.
        if !results.isEmpty {
            return results
        }

        // A finished background agent writes its report into its OWN file, so the only trace of it
        // in this one is this notification. Every one is routed: suppressed, the report would be
        // lost rather than tidied, and taken at face value it is drawn as a prompt (#945).
        if let report = taskNotification(message.content) {
            return reported(report, in: message)
        }

        return message.authorship.isMeta ? metaEvents(message) : promptEvents(message, in: location)
    }

    /// The CLI talking to itself. Almost all of it means nothing to a reader — but a skill's
    /// expanded body is filed here too, and it is the one place the record says a Session was
    /// handed a skill (#688).
    private func metaEvents(_ message: MessageRecord) -> [TranscriptEvent] {
        guard let directory = skillDirectory(message.content) else { return [] }
        return [.skillLoaded(skillLoad(at: directory, read: readSkill))]
    }
}
