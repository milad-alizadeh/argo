import ArgoEngine

/// What the panel is open on.
///
/// A value rather than the row itself, because two different rows open the panel: one call, whose
/// header names the one thing it did, and a folded run of looking, whose header names a count and
/// leaves every step to say which file it came from. A panel taking a `FeedCall` would have left
/// the survey to grow a second panel.
struct FeedEvidence: Equatable, Sendable {
    /// One result inside the panel, with whatever the header could not say about it.
    struct Step: Equatable, Sendable {
        /// Which call produced this, where the header does not already say it — the same address
        /// the header would have carried. `nil` for an ordinary row: repeating one path above each
        /// of three patches is the header, three times.
        let address: String?
        /// What that step's own file is written in. Held per step rather than taken from the
        /// header, because a folded run of looking has no one language.
        let language: EvidenceLanguage?
        let result: ToolResult
    }

    /// What the row said the agent did. Drawn only where `saysVerb`; spoken always, because a mark
    /// says "Swift file" to somebody looking at it and nothing at all to somebody listening.
    let verb: String
    /// The mark the header carries: a file's language, a command's terminal, a folded run's eye.
    /// Never a guessed language — a subject that is not a file takes the mark of what it WAS.
    let symbol: String
    /// The address the feed was standing in for — the path from the Session's cwd forward, a
    /// command as typed, a count. Relative and never absolute: thirty characters of this machine
    /// in front of the first character about the work is the half worth cutting, and the feed
    /// already says everything relative to the same place.
    let address: String
    /// What the file is written in, where the address is a file with an extension Argo knows.
    /// Decides the grammar a patch under this header is coloured against.
    let language: EvidenceLanguage?
    /// How the call ended. Part of what the panel is open ON for a command, which is identified by
    /// what it was and how it went; a file's header says neither and draws nothing for it.
    let ending: FeedCall.Ending
    /// Whether the verb is drawn as well as spoken.
    ///
    /// A file's header is its mark and its path: the mark already says the one thing the row could
    /// not, and `EDITED` above it spends the first line restating the line that was clicked. A
    /// command has no such mark, so its header keeps the word — without it, a terminal glyph and a
    /// command line say nothing about whether the thing was run, and its outcome has nowhere to go.
    let saysVerb: Bool
    /// Everything the row stands for, in the order it happened.
    let steps: [Step]
}

extension FeedCall {
    /// What the panel shows for one call. Every step uncaptioned: the header names the subject
    /// already, and a run of three edits is three patches of the SAME file.
    var opened: FeedEvidence {
        FeedEvidence(
            verb: kind.verb,
            symbol: symbol,
            address: address,
            language: language,
            ending: ending,
            saysVerb: language == nil,
            steps: evidence.map { FeedEvidence.Step(address: nil, language: nil, result: $0) },
        )
    }

    /// Only a FILE has a language. A command's own words end in `.sh` often enough that reading
    /// its last extension would colour a shell invocation as a shell script — the subject decides
    /// whether the question may be asked at all.
    var language: EvidenceLanguage? {
        guard case let .file(file) = subject else { return nil }
        return EvidenceLanguage(path: file.path)
    }

    /// The whole path for a file, because the panel is the surface the feed defers it to.
    /// Everything else is already whole on the row and is repeated here, so the panel says what it
    /// is open on without the feed beside it.
    var address: String {
        switch subject {
        case let .file(file): file.path
        case let .command(command): command
        case let .plain(text): text
        }
    }

    /// The language's mark for a file, and the CALL's own for everything else — a command takes
    /// the terminal it was run in, not the generic document that would have made it look like one.
    /// The plain document survives for the one honest gap: a subject Argo could name neither way.
    private var symbol: String {
        language?.symbol ?? kind.symbol ?? ArgoSymbol.plainSource
    }
}
