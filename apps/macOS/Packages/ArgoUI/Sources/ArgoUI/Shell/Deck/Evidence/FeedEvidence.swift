import ArgoEngine

/// What the panel is open on. The ADDRESS is the step's, not this header's — the header says only
/// what the ROW said (verb, count, outcome).
struct FeedEvidence: Equatable, Sendable {
    struct Step: Equatable, Sendable, Identifiable {
        /// Position in the panel, assigned by the panel's projection rather than carried from the
        /// record — the only thing that stays stable to scroll to while a live transcript grows.
        let id: Int
        /// What produced this — a path, a command as typed, whatever the call named.
        let address: EvidenceAddress
        /// Per step rather than per panel: a folded run of looking has no one language.
        let language: EvidenceLanguage?
        /// Whether the address lies outside the Session's tree — see `FeedPath.isExternal`.
        let isExternal: Bool
        /// Whether this result IS the file at that address: a read printed it, or Argo read it
        /// itself. Everything else a call prints is a message ABOUT the call, however its path is
        /// spelled — so only this may be drawn under the file's grammar or rendered as its
        /// document.
        var holdsTheFile = false
        let result: ToolResult

        /// What this step did in lines, from the patch itself. Absent where it changed nothing:
        /// `+0 −0` claims an edit that did nothing.
        var churn: FeedCall.Churn? {
            guard case let .diff(diff) = result else { return nil }
            let churn = FeedCall.Churn(added: diff.added, removed: diff.removed)
            return churn.isSilent ? nil : churn
        }
    }

    /// What the row said the agent did — drawn AND spoken, since a mark says nothing to a listener.
    let verb: String
    /// The kind's own mark, or a folded run's eye. Never a language — those are the steps'.
    let symbol: String
    /// What the row counted, where it counted rather than named — `Searched 1 · Read 5`. `nil` for
    /// a single call, whose addresses are all in the body.
    let label: String?
    let ending: FeedCall.Ending
    /// In the order it happened.
    let steps: [Step]
}

/// What the panel is open on, and how it is IDENTIFIED — a path by its right-hand end (cut from
/// the front), a command by its first word and its middle arguments (cut in the middle).
enum EvidenceAddress: Equatable, Sendable {
    /// A path in the working tree, drawn in two inks: parent, then filename.
    case filed(String)
    /// A pattern, a URL, a tool's own name, a count — whatever else named the subject.
    case named(String)
    /// A command as the agent typed it, whole.
    case typed(String)

    /// How many lines a command may run across. Three is the most that still reads as a header
    /// rather than as the first thing in the panel.
    static let commandLines = 3

    /// How much of a command one of those lines holds, at the PANEL'S FLOOR — measured off the
    /// render: 320 points less the header's padding, mark, outcome and controls leaves the address
    /// about 250, and the mono sets about eight points to the character.
    /// Not the measure a feed ROW is cut to: the layout tail-cuts on top of this, so a wider
    /// borrowed cut gives the command two ellipses and loses the right-hand end.
    static let commandLineLength = 26

    /// The address whole, uncut — what the ear and the tooltip take.
    var text: String {
        switch self {
        case let .filed(text), let .named(text), let .typed(text): text
        }
    }

    /// What the header actually draws. A path goes over whole and is cut by the layout from the
    /// front; a command is cut here, in the middle, at the length three lines can hold.
    var drawn: String {
        switch self {
        case let .filed(text), let .named(text): text
        case let .typed(command):
            DeckMiddleCut.applied(to: command, keeping: Self.commandLines * Self.commandLineLength)
        }
    }

    /// A path split at the last separator. The parent comes back empty for a name with no parent,
    /// which draws as no parent rather than a lone slash.
    var parted: (parent: String, name: String) {
        guard case let .filed(path) = self, let cut = path.lastIndex(of: "/") else {
            return ("", drawn)
        }
        return (String(path[path.startIndex ... cut]), String(path[path.index(after: cut)...]))
    }
}

extension FeedCall {
    /// What the panel shows for one call: its results, each under the address it came from.
    var opened: FeedEvidence {
        FeedEvidence(
            verb: kind.verb,
            symbol: symbol,
            label: nil,
            ending: ending,
            steps: evidence.enumerated().map { position, result in
                FeedEvidence.Step(
                    id: position,
                    address: address,
                    language: language,
                    isExternal: isExternalSubject,
                    holdsTheFile: holdsTheFile,
                    result: result,
                )
            },
        )
    }

    /// Whether what this call printed is the file itself. A READ prints the file; an edit answered
    /// with a sentence rather than a patch prints a sentence, and drawing that under the file's
    /// grammar would claim the sentence is the file.
    var holdsTheFile: Bool {
        kind == .read
    }

    /// Whether what the call named lies outside the Session's tree. Only a file can be.
    var isExternalSubject: Bool {
        guard case let .file(file) = subject else { return false }
        return file.isExternal
    }

    /// Only a FILE has a language: a command's own words end in `.sh` often enough that reading its
    /// last extension would colour a shell invocation as a shell script.
    var language: EvidenceLanguage? {
        guard case let .file(file) = subject else { return nil }
        return EvidenceLanguage(path: file.path)
    }

    /// The whole path for a file. The shape comes off the SUBJECT, not the surface: only a shell
    /// call's target is a command.
    var address: EvidenceAddress {
        switch subject {
        case let .file(file): .filed(file.path)
        case let .command(command): .typed(command)
        case let .plain(text): .named(text)
        // The command, not the sentence the row drew; a narration standing in for nothing is prose.
        case let .narration(text, target):
            target.map { kind == .execute ? .typed($0) : .named($0) } ?? .named(text)
        }
    }

    /// How a step inside a FOLDED run names the call that produced it: the address, except where
    /// the agent wrote its own account of the call — then that, as prose.
    var caption: EvidenceAddress {
        guard case let .narration(said, _) = subject else { return address }
        return .named(said)
    }

    /// The kind's own mark. The LANGUAGE's mark belongs to a step, beside its one address.
    private var symbol: String {
        kind.symbol ?? ArgoSymbol.plainSource
    }
}
