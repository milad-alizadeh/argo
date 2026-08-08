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

    /// Whether the row could open onto anything.
    ///
    /// Derived from the evidence and never from the kind: two reads of the same file, one answered
    /// by the record and one not, are two different rows. Computed rather than stored, so the
    /// marker and what opens behind it cannot disagree.
    var disclosure: Disclosure {
        evidence.isEmpty ? .none : .available
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
        /// `nil` where the host declared a move without saying where to. The verb is still the
        /// truth; the destination is the part that was never written down.
        case move(destination: String?)
        case execute
        case fetch
        case delegate
        case mcp
        /// A tool whose kind this CLI did not report. It keeps its own name and takes no mark.
        case unclassified
    }

    /// What the sentence names. Three shapes, because a file, a command line and a pattern are read
    /// differently and only one of them has a name that is shorter than itself.
    enum Subject: Equatable, Sendable {
        case file(FileName)
        /// A command as it was typed.
        case command(String)
        /// A pattern, a URL, a brief, a tool's own name — whatever the call named, verbatim.
        case plain(String)

        /// What the subject reads as out loud. A file is its name and not its path here too: the
        /// path is what the panel opens on, and a screen reader working down a feed wants the same
        /// short address the eye gets.
        var spoken: String {
            switch self {
            case let .file(file): file.name
            case let .command(command): command
            case let .plain(text): text
            }
        }

        /// What the subject reads as where NO row above it names it — a step inside a folded run of
        /// looking. The same short address, with the parent that tells two same-named files apart
        /// kept on the front: the fold took the filenames off the line, so the captions are the
        /// only place the qualifier still has to do its job.
        var captioned: String {
            guard case let .file(file) = self, let qualifier = file.qualifier else { return spoken }
            return "\(qualifier)/\(file.name)"
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

        /// `nil` for a path with nothing in it to name a file by — the caller then says what the
        /// call named some other way rather than drawing a blank subject.
        init?(path: String) {
            guard let name = path.split(separator: "/").last else { return nil }
            self.path = path
            self.name = String(name)
            self.qualifier = nil
        }

        private init(path: String, name: String, qualifier: String?) {
            self.path = path
            self.name = name
            self.qualifier = qualifier
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
        case .fetch: ArgoSymbol.fetched
        case .delegate: ArgoSymbol.delegated
        case .mcp: ArgoSymbol.mcpTool
        case .unclassified: nil
        }
    }

    /// Where a moved file went, drawn as a quiet qualifier after the name.
    var destination: String? {
        guard case let .move(destination) = self else { return nil }
        return destination
    }
}
