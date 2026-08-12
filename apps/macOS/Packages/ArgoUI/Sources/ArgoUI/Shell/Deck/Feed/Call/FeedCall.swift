import ArgoEngine

/// One tool call as a sentence: a mark for the kind of thing it was, a verb, the subject it named,
/// and what it produced.
///
/// Sentence-shaped rather than tabular: columns and a right-hand metadata rail are what turned the
/// discarded #378 attempt into a log table, so there is no slot here for a timestamp and no field a
/// renderer would have to reserve width for.
struct FeedCall: Equatable, Sendable {
    let kind: Kind
    let subject: Subject
    /// What a mutation did in lines, where the record carried a patch to count.
    let churn: Churn?
    let ending: Ending
    /// What the engine kept of what the calls produced — the panel's whole content. A LIST because
    /// a row can stand for a run of calls. Only results with something in them are here: an empty
    /// output or an unreadable patch is dropped at the reading.
    let evidence: [ToolResult]
    /// How many calls this one line stands for. `1` for all but a collapsed run.
    let repeats: Int
    /// What the call itself reported spending. `nil` for the ordinary call; a DELEGATING call's
    /// result carries the whole spend of the subagent it ran, the only place a sidechain's cost is
    /// ever reported.
    let spend: Usage?

    /// Whether the row could open onto anything. Derived from the evidence and never from the kind.
    var disclosure: Disclosure {
        evidence.isEmpty ? .none : .available
    }

    /// The whole row as one sentence, for a reader who cannot see it. Everything the drawn line
    /// says WITHOUT words is spelled out here and nowhere else: the failure ink, the `×3`, and the
    /// parent that tells two same-named files apart.
    var spoken: String {
        [
            kind.verb,
            subject.captioned,
            repeats > 1 ? "\(repeats) times" : nil,
            printed?.drawn,
            ending.spoken,
        ]
        .compactMap(\.self)
        .joined(separator: " ")
    }
}

extension FeedCall {
    /// What the call did, at the grain the feed says it in words — finer than the engine's own
    /// `ToolCallKind` on purpose.
    enum Kind: Equatable, Sendable {
        case search
        case read
        case edit
        case create
        case delete
        /// Where it went is the panel's — the row draws the verb and the filename, no destination.
        case move
        case execute
        /// A skill the agent invoked by name — the name is the whole content of the row.
        case skill
        case fetch
        case delegate
        case mcp
        /// A tool whose kind this CLI did not report. It keeps its own name and takes no mark.
        case unclassified
    }

    /// What the sentence names.
    enum Subject: Equatable, Sendable {
        case file(FileName)
        /// A command as it was typed.
        case command(String)
        /// A pattern, a URL, a brief, a tool's own name — whatever the call named, verbatim.
        case plain(String)
        /// The agent's own account of what the call was for, and the target it stood in for. `nil`
        /// where the narrating call named nothing else.
        case narration(String, standingIn: String?)

        /// The shortest thing that identifies the subject on its own, with no row beside it to
        /// borrow from: the filename, and the parent in front of it where another file in this
        /// feed answers to the same name.
        var captioned: String {
            switch self {
            case let .file(file):
                file.qualifier.map { "\($0)/\(file.name)" } ?? file.name
            case let .command(command): command
            case let .plain(text): text
            // The sentence, not the command behind it: a listener arrives at the row as a reader
            // does.
            case let .narration(text, _): text
            }
        }
    }

    /// A file as the feed addresses it: the filename, and nothing else, at any window width.
    struct FileName: Equatable, Sendable {
        /// The path the record named — never drawn in the feed; the evidence panel opens on it.
        let path: String
        let name: String
        /// The shortest parent that tells this file from another of the same name in this feed.
        /// `nil` where the name is already unambiguous, which is the common case.
        let qualifier: String?
        /// Whether the file lies outside the tree the Session is working in — see
        /// `FeedPath.isExternal`. Never drawn on the row; the panel is what says so.
        let isExternal: Bool

        /// `nil` for a path with nothing in it to name a file by — the caller then says what the
        /// call named some other way rather than drawing a blank subject.
        init?(path: String, isExternal: Bool = false) {
            guard let name = path.split(separator: "/").last else { return nil }
            self.path = path
            self.name = String(name)
            self.qualifier = nil
            self.isExternal = isExternal
        }

        private init(path: String, name: String, qualifier: String?, isExternal: Bool) {
            self.path = path
            self.name = name
            self.qualifier = qualifier
            self.isExternal = isExternal
        }

        /// The shared rule's answer, split back into the two things a row draws: the name, and the
        /// parent in front of it.
        func qualified(as label: String) -> FileName {
            let parts = label.split(separator: "/")
            guard let name = parts.last else { return self }
            return FileName(
                path: path,
                name: String(name),
                qualifier: parts.dropLast().isEmpty ? nil : parts.dropLast().joined(separator: "/"),
                isExternal: isExternal,
            )
        }
    }

    /// How the call ended. Three states and no payload; what went wrong is the panel's, whole.
    /// `pending` is a real state and not a missing one — a call the transcript has not answered yet
    /// HAPPENED, and must never read as succeeded.
    enum Ending: Equatable, Sendable {
        case pending
        case succeeded
        case failed
    }

    /// What a mutation did, in lines.
    struct Churn: Equatable, Sendable {
        let added: Int
        let removed: Int

        /// A row drawing `+0 −0` would claim the edit changed nothing rather than that its patch
        /// was unreadable.
        var isSilent: Bool {
            added == 0 && removed == 0
        }
    }

    /// Whether the row could open onto anything — see `FeedCall.disclosure`, which derives it.
    enum Disclosure: Equatable, Sendable {
        case none
        case available
    }

    /// The same call, with its filename told apart from the others in the feed.
    func naming(_ file: FileName) -> FeedCall {
        FeedCall(
            kind: kind,
            subject: .file(file),
            churn: churn,
            ending: ending,
            evidence: evidence,
            repeats: repeats,
            spend: spend,
        )
    }
}

extension FeedCall {
    /// How long this row's line runs, in characters, without building it. `spoken` joins five
    /// pieces, and joining them once per call row per reshape is a string nobody draws. UTF-8
    /// counts, which a `String` answers in constant time where `count` walks graphemes.
    var length: Int {
        kind.verb.utf8.count + 1 + subject.length
    }
}

extension FeedCall.Subject {
    /// How many characters the subject spells.
    var length: Int {
        switch self {
        case let .file(file): file.name.utf8.count + (file.qualifier?.utf8.count ?? 0)
        case let .command(command): command.utf8.count
        case let .plain(text): text.utf8.count
        case let .narration(text, _): text.utf8.count
        }
    }
}

extension FeedCall.Ending {
    var hasFailed: Bool {
        self == .failed
    }

    /// The ink a call with this ending is drawn in, for the row and the lane alike. Only a failure
    /// carries a colour: a pending call is a rung above the finished ones rather than a hue, and a
    /// success is the ordinary case.
    var ink: FeedInk {
        hasFailed ? .failure : .command
    }

    /// What a screen reader hears about the ending, where there is anything to say. A success is
    /// silent, as the drawn line is.
    var spoken: String? {
        switch self {
        case .pending: "still running"
        case .succeeded: nil
        case .failed: "failed"
        }
    }
}

extension FeedCall.Kind {
    /// What the row says the agent did. One word, in the past: a feed is the record of what
    /// happened, not a status line.
    var verb: String {
        switch self {
        case .search: "Searched"
        case .read: "Read"
        case .edit: "Edited"
        case .create: "Created"
        case .delete: "Deleted"
        case .move: "Moved"
        case .execute: "Ran"
        // Not "Ran": one verb over both would make `grill` look like a binary on the machine.
        case .skill: "Invoked"
        case .fetch: "Fetched"
        case .delegate: "Delegated"
        case .mcp, .unclassified: "Called"
        }
    }

    /// `nil` where Argo could not classify the call — the row shows the host's own tool name and
    /// leaves the column empty rather than picking the nearest-looking glyph.
    var symbol: String? {
        switch self {
        case .search: ArgoSymbol.searched
        case .read: ArgoSymbol.read
        case .edit: ArgoSymbol.edited
        case .create: ArgoSymbol.created
        case .delete: ArgoSymbol.deleted
        case .move: ArgoSymbol.moved
        case .execute: ArgoSymbol.ran
        case .skill: ArgoSymbol.skill
        case .fetch: ArgoSymbol.fetched
        case .delegate: ArgoSymbol.delegated
        case .mcp: ArgoSymbol.mcpTool
        case .unclassified: nil
        }
    }
}
