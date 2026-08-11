import ArgoEngine

/// One tool call as a sentence: a mark for the kind of thing it was, a verb, the subject it named,
/// and what it produced.
///
/// Sentence-shaped rather than tabular, which is the whole decision. Columns and a right-hand
/// metadata rail are what turned the discarded #378 attempt into a log table, so there is no slot
/// here for a timestamp and no field a renderer would have to reserve width for.
struct FeedCall: Equatable, Sendable {
    let kind: Kind
    let subject: Subject
    /// What a mutation did in lines, where the record carried a patch to count.
    let churn: Churn?
    let ending: Ending
    /// What the engine kept of what the calls produced — the panel's whole content, and the reason
    /// the row can be opened at all. Carried rather than looked up later so the disclosure marker
    /// cannot promise something the panel then has nothing to show for.
    ///
    /// A LIST because a row can stand for a run of calls: three edits of one file are one line and
    /// three patches. Only results with something in them are here — an empty output or an
    /// unreadable patch is dropped at the reading, so the row does not offer a panel that would
    /// open onto "nothing was kept".
    let evidence: [ToolResult]
    /// How many calls this one line stands for. `1` for all but a collapsed run.
    let repeats: Int
    /// What the call itself reported spending. `nil` for the ordinary call, which spends nothing of
    /// its own — a DELEGATING call is what this is for: its result carries the whole spend of the
    /// subagent it ran, and that result is the only place a sidechain's cost is ever reported.
    let spend: Usage?

    /// Whether the row could open onto anything.
    ///
    /// Derived from the evidence and never from the kind: two reads of the same file, one answered
    /// by the record and one not, are two different rows. Computed rather than stored, so the
    /// marker and what opens behind it cannot disagree.
    var disclosure: Disclosure {
        evidence.isEmpty ? .none : .available
    }

    /// The whole row as one sentence, for a reader who cannot see it.
    ///
    /// Everything the drawn line says WITHOUT words is spelled out here and nowhere else: the
    /// failure ink, the `×3`, and the parent that tells two same-named files apart. A value on the
    /// call rather than a string built in the view, so the claim is one a test can hold.
    var spoken: String {
        [
            kind.verb,
            subject.captioned,
            repeats > 1 ? "\(repeats) times" : nil,
            ending.spoken,
        ]
        .compactMap(\.self)
        .joined(separator: " ")
    }
}

extension FeedCall {
    /// What the call did, at the grain the feed says it in words.
    ///
    /// Finer than the engine's own `ToolCallKind` on purpose: `edit` is one thing to a reader of
    /// transcripts and four to a reader of a feed, and leaving a creation and a deletion to be told
    /// apart by their diffstats asks the reader to do arithmetic to learn what happened.
    enum Kind: Equatable, Sendable {
        case search
        case read
        case edit
        case create
        case delete
        /// Where it went is the panel's. The verb is the news; a second address trailing the
        /// filename put a word after the row that the reader has to discard to reach the end of it.
        case move
        case execute
        /// A skill the agent invoked by name. Told apart from an `execute` because the reader's
        /// question about it is WHICH skill — the name is the whole content of the row.
        case skill
        case fetch
        case delegate
        case mcp
        /// A tool whose kind this CLI did not report. It keeps its own name and takes no mark.
        case unclassified
    }

    /// What the sentence names. Four shapes, because a file, a command line, a pattern and a
    /// sentence the agent wrote are read differently — and only one of them has a name that is
    /// shorter than itself.
    enum Subject: Equatable, Sendable {
        case file(FileName)
        /// A command as it was typed.
        case command(String)
        /// A pattern, a URL, a brief, a tool's own name — whatever the call named, verbatim.
        case plain(String)
        /// The agent's own account of what the call was for, and the target it stood in for.
        ///
        /// The pair is the point: the row draws the sentence and the panel still opens on the
        /// command, which is what makes the sentence falsifiable against what actually ran. `nil`
        /// where the narrating call named nothing else — then the sentence is all there was.
        case narration(String, standingIn: String?)

        /// The shortest thing that identifies the subject on its own, with no row beside it to
        /// borrow from: the filename, and the parent in front of it where another file in this
        /// feed answers to the same name.
        ///
        /// Two surfaces need exactly this, for the same reason and so from one rule. A step inside
        /// a folded run of looking has no line above it naming the file, because the fold took the
        /// filenames off. And a screen reader arrives at ONE row, with no column to scan — the
        /// qualifier the eye resolves by comparing two lines has to be in the words.
        var captioned: String {
            switch self {
            case let .file(file):
                file.qualifier.map { "\($0)/\(file.name)" } ?? file.name
            case let .command(command): command
            case let .plain(text): text
            // The sentence, and not the command behind it: a listener arrives at the row the way a
            // reader does, and the row says what the agent was doing.
            case let .narration(text, _): text
            }
        }
    }

    /// A file as the feed addresses it: the filename, and nothing else, at any window width.
    struct FileName: Equatable, Sendable {
        /// The path the record named. Held so two files of the same name can be told apart, and so
        /// the evidence panel has an address to open — never drawn in the feed.
        let path: String
        let name: String
        /// The shortest parent that tells this file from another of the same name in this feed.
        /// `nil` where the name is already unambiguous, which is the common case.
        let qualifier: String?
        /// Whether the file lies outside the tree the Session is working in — see
        /// `FeedPath.isExternal`. Never drawn on the row, which is one line of the shortest thing
        /// that identifies the call; the panel is where an address is read, so it is the panel that
        /// says the address is somewhere else.
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
        /// parent in front of it. One label, two inks — the qualifier is deliberately quieter,
        /// because it is there to disambiguate rather than to be read.
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

    /// How the call ended. Three states and no payload: the row says WHICH of them happened and
    /// nothing about it in words — a failure is the line in the failure ink with a cross after it,
    /// and what went wrong is the panel's, whole.
    ///
    /// `pending` is a real state and not a missing one: a call the transcript has not answered yet
    /// HAPPENED, and saying it succeeded quietly would be the feed's first lie.
    enum Ending: Equatable, Sendable {
        case pending
        case succeeded
        case failed
    }

    /// What a mutation did, in lines.
    struct Churn: Equatable, Sendable {
        let added: Int
        let removed: Int

        /// A patch nothing could read counts nothing, and a row that draws `+0 −0` is claiming the
        /// edit changed nothing rather than that its patch was unreadable.
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

extension FeedCall.Ending {
    var hasFailed: Bool {
        self == .failed
    }

    /// What a screen reader hears about the ending, where there is anything to say. A success is
    /// silent for the same reason the line carries no word for it: the reading is the sentence, and
    /// "succeeded" after every call is noise in the ear as much as on the screen.
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
        // Not "Ran": a skill and a shell command are two different things to a reader watching a
        // turn, and one verb over both makes `grill` look like a binary on the machine.
        case .skill: "Invoked"
        case .fetch: "Fetched"
        case .delegate: "Delegated"
        case .mcp, .unclassified: "Called"
        }
    }

    /// `nil` where Argo could not classify the call. A mark is a claim about what happened, and
    /// this is the one case where nothing is known — so the row shows the host's own tool name and
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
