import ArgoEngine

/// What the panel is open on.
///
/// A value rather than the row itself, because two different rows open the panel: one call, whose
/// header names the one thing it did, and a folded run of looking, whose header names a count and
/// leaves every step to say which file it came from. A panel taking a `FeedCall` would have left
/// the survey to grow a second panel.
struct FeedEvidence: Equatable, Sendable {
    struct Step: Equatable, Sendable {
        /// Which call produced this, where the header does not already say it. `nil` for an
        /// ordinary row — repeating one filename above each of three patches is the header,
        /// three times.
        let caption: String?
        let result: ToolResult
    }

    /// What the row said the agent did. Spoken, never drawn: the header shows the file's own mark
    /// and its address, and the verb is what the ROW it was opened from already says. It is kept
    /// for the accessibility label, where there is no mark to look at.
    let verb: String
    /// The address the feed was standing in for — the path from the Session's cwd forward, a
    /// command as typed, a count. Relative and never absolute: thirty characters of this machine
    /// in front of the first character about the work is the half worth cutting, and the feed
    /// already says everything relative to the same place.
    let address: String
    /// What the file is written in, where the address is a file with an extension Argo knows.
    /// Decides the mark on the header and the grammar the patch is coloured against.
    let language: EvidenceLanguage?
    /// Everything the row stands for, in the order it happened.
    let steps: [Step]

    /// The mark the header carries: the language's where there is one, and the plain document
    /// otherwise — a command, a pattern, a folded run of looking. Never a guessed language.
    var symbol: String {
        language?.symbol ?? ArgoSymbol.plainSource
    }
}

extension FeedCall {
    /// What the panel shows for one call. Every step uncaptioned: the header names the subject
    /// already, and a run of three edits is three patches of the SAME file.
    var opened: FeedEvidence {
        FeedEvidence(
            verb: kind.verb,
            address: address,
            language: language,
            steps: evidence.map { FeedEvidence.Step(caption: nil, result: $0) },
        )
    }

    /// Only a FILE has a language. A command's own words end in `.sh` often enough that reading
    /// its last extension would colour a shell invocation as a shell script — the subject decides
    /// whether the question may be asked at all.
    private var language: EvidenceLanguage? {
        guard case let .file(file) = subject else { return nil }
        return EvidenceLanguage(path: file.path)
    }

    /// The whole path for a file, because the panel is the surface the feed defers it to.
    /// Everything else is already whole on the row and is repeated here, so the panel says what it
    /// is open on without the feed beside it.
    private var address: String {
        switch subject {
        case let .file(file): file.path
        case let .command(command): command
        case let .plain(text): text
        }
    }
}
