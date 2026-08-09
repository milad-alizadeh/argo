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
    let address: EvidenceAddress
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

/// What the panel is open on, and how that thing is IDENTIFIED — which is one question, because
/// what identifies a thing is what has to survive when it does not fit.
///
/// A path is identified by its right-hand end, so it takes one line cut from the front. A command
/// is
/// identified by its first word and by the arguments in its middle, so it opens on its beginning,
/// wraps, and spends its ellipsis in the middle. One rule over both would have to be wrong about
/// one
/// of them — which is what a header designed for a File and inherited by a command was.
enum EvidenceAddress: Equatable, Sendable {
    /// A path, a pattern, a tool's own name, a count — whatever named the subject.
    case named(String)
    /// A command as the agent typed it, whole.
    case typed(String)

    /// How many lines a command may run across. Unbounded wrapping was rejected for a real reason —
    /// the header would grow with whatever happened to be open and push the close control down the
    /// pane — and one line is the File's rule applied to a subject it is wrong for. Three is the
    /// most that still reads as a header rather than as the first thing in the panel.
    static let commandLines = 3

    /// The characters themselves. What the ear and the tooltip want: both take the address whole,
    /// and neither has a width to be cut to.
    var text: String {
        switch self {
        case let .named(text), let .typed(text): text
        }
    }

    /// What the header actually draws.
    ///
    /// A path is handed over whole and cut by the layout, from the front, so it answers to the
    /// width
    /// the reader dragged the panel to. A command cannot be: cutting it from the front takes the
    /// verb, and cutting it from the back takes the arguments — so it is cut by the shared rule,
    /// once, at the length three lines of it can hold.
    var drawn: String {
        switch self {
        case let .named(text): text
        case let .typed(command): DeckMiddleCut.applied(to: command, over: Self.commandLines)
        }
    }
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
    ///
    /// The shape comes off the SUBJECT and not off the surface: only a shell call's target is a
    /// command, and a pattern or a URL standing behind a narration is an address like any other.
    var address: EvidenceAddress {
        switch subject {
        case let .file(file): .named(file.path)
        case let .command(command): .typed(command)
        case let .plain(text): .named(text)
        // The command, not the sentence the row drew. The panel's whole justification is that it
        // says the one thing the row could not — repeating the narration here would open a pane on
        // the line that was clicked, and leave what actually ran nowhere to be read. A narration
        // that stood in for nothing is all there was, and is drawn as the prose it is.
        case let .narration(text, target):
            target.map { kind == .execute ? .typed($0) : .named($0) } ?? .named(text)
        }
    }

    /// How a step inside a FOLDED run names the call that produced it.
    ///
    /// The address, except where the agent wrote its own account of the call — then that, which is
    /// the sentence the unfolded row would have drawn. The reasoning that keeps a narration OFF a
    /// single call's header does not reach here: that header is a second look at a row still on
    /// screen saying the sentence, and a folded run left no such row behind.
    var caption: String {
        guard case let .narration(said, _) = subject else { return address.text }
        return said
    }

    /// The language's mark for a file, and the CALL's own for everything else — a command takes
    /// the terminal it was run in, not the generic document that would have made it look like one.
    /// The plain document survives for the one honest gap: a subject Argo could name neither way.
    private var symbol: String {
        language?.symbol ?? kind.symbol ?? ArgoSymbol.plainSource
    }
}
