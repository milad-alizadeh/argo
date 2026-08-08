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
    /// What went wrong. Absent for a call that did not fail — which is every call that earns only
    /// one line.
    let failure: CommandFailure?
    let disclosure: Disclosure
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

    /// Whether the row could open onto anything.
    ///
    /// Derived from whether the engine kept a result, never from the kind: two reads of the same
    /// file, one answered by the record and one not, are two different rows, and a marker that
    /// followed the kind would promise evidence that was never stored.
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
            failure: failure,
            disclosure: disclosure,
        )
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
