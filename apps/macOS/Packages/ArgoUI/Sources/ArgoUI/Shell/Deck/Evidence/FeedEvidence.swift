import ArgoEngine

/// What the panel is open on.
///
/// A value rather than the row itself, because two different rows open the panel: one call, whose
/// header names the one thing it did, and a folded run of looking, whose header names a count and
/// leaves every step to say which file it came from. A panel taking a `FeedCall` would have left
/// the survey to grow a second panel.
///
/// The ADDRESS is the step's and not this header's, which is the one structural thing to know about
/// the type. A panel showing four files under one path in its header is a panel where three of the
/// four are mislabelled, and the header cannot say which — so the panel says what the ROW said (a
/// verb, a count, how it went) and every result underneath carries the address it actually came
/// from, with the copy control that address needs beside it.
struct FeedEvidence: Equatable, Sendable {
    /// One result inside the panel, under the address it came from.
    struct Step: Equatable, Sendable, Identifiable {
        /// Where in the panel this step is — its position, which is also how the feed points at it.
        /// Assigned by the panel's projection rather than carried from the record: what the
        /// accordion scrolls to is the nth thing down the pane, and there is nothing else stable to
        /// aim at while a live transcript grows.
        let id: Int
        /// What produced this — a path, a command as typed, whatever the call named.
        let address: EvidenceAddress
        /// What that step's own file is written in. Held per step rather than on the panel, because
        /// a folded run of looking has no one language.
        let language: EvidenceLanguage?
        /// Whether the address lies outside the Session's tree — see `FeedPath.isExternal`.
        let isExternal: Bool
        let result: ToolResult

        /// What this step did in lines, from the patch itself. Absent for a result that changed
        /// nothing and for a patch nothing could read: `+0 −0` claims an edit that did nothing.
        var churn: FeedCall.Churn? {
            guard case let .diff(diff) = result else { return nil }
            let churn = FeedCall.Churn(added: diff.added, removed: diff.removed)
            return churn.isSilent ? nil : churn
        }
    }

    /// What the row said the agent did — drawn and spoken, because a mark says "Swift file" to
    /// somebody looking at it and nothing at all to somebody listening.
    let verb: String
    /// The mark the header carries: the kind's own, or a folded run's eye. Never a language — the
    /// languages are the steps', one per address.
    let symbol: String
    /// What the row counted, where it counted rather than named — `Searched 1 · Read 5`. `nil` for
    /// a single call, whose addresses are all in the body.
    let label: String?
    /// How the call ended. The panel is open on what happened AND on how it went, and the outcome
    /// belongs beside the verb rather than beside any one of the results.
    let ending: FeedCall.Ending
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
    /// A path in the working tree. Told apart from every other name because it is the one that has
    /// a shape: the parent is context and the filename is the answer, so a header draws them in two
    /// inks rather than as one grey run the eye has to find the end of.
    case filed(String)
    /// A pattern, a URL, a tool's own name, a count — whatever else named the subject.
    case named(String)
    /// A command as the agent typed it, whole.
    case typed(String)

    /// How many lines a command may run across. Unbounded wrapping was rejected for a real reason —
    /// the header would grow with whatever happened to be open and push the close control down the
    /// pane — and one line is the File's rule applied to a subject it is wrong for. Three is the
    /// most that still reads as a header rather than as the first thing in the panel.
    static let commandLines = 3

    /// How much of a command one of those lines holds, at the PANEL'S FLOOR — the width the cut has
    /// to be right at, since a wider panel can only fit more. Measured off the render rather than
    /// reasoned about: 320 points less the header's padding, its mark, and the outcome and controls
    /// sharing the line it opens on leaves the address about 250, and the mono sets about eight
    /// points to the character.
    ///
    /// Deliberately not the measure a feed ROW is cut to. That one answers to the feed's own width,
    /// and a cut borrowed from a wider surface is worse than no cut: the layout tail-cuts what will
    /// not fit on top of it, so the command carries two ellipses and loses the right-hand end the
    /// middle cut exists to keep.
    static let commandLineLength = 26

    /// The characters themselves. What the ear and the tooltip want: both take the address whole,
    /// and neither has a width to be cut to.
    var text: String {
        switch self {
        case let .filed(text), let .named(text), let .typed(text): text
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
        case let .filed(text), let .named(text): text
        case let .typed(command):
            DeckMiddleCut.applied(to: command, keeping: Self.commandLines * Self.commandLineLength)
        }
    }

    /// A path split where the eye splits it: everything up to the last separator, and the filename.
    /// The parent comes back empty for a name with no parent in it, which is drawn as no parent
    /// rather than as a lone slash.
    var parted: (parent: String, name: String) {
        guard case let .filed(path) = self, let cut = path.lastIndex(of: "/") else {
            return ("", drawn)
        }
        return (String(path[path.startIndex ... cut]), String(path[path.index(after: cut)...]))
    }
}

extension FeedCall {
    /// What the panel shows for one call: its results, each under the address it came from.
    ///
    /// Every step captioned, including the three patches of one file a collapsed run leaves — the
    /// address is where the copy control lives, and a run whose second patch had no header would be
    /// a patch of a file the reader cannot copy the path of.
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
                    result: result,
                )
            },
        )
    }

    /// Whether what the call named lies outside the Session's tree. Only a file can be: a command
    /// is not anywhere, and a pattern names no one place.
    var isExternalSubject: Bool {
        guard case let .file(file) = subject else { return false }
        return file.isExternal
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
        case let .file(file): .filed(file.path)
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
    /// the sentence the unfolded row would have drawn, and prose rather than an address because
    /// nobody copies a sentence into a terminal. The reasoning that keeps a narration off a single
    /// call's own step does not reach here: that step sits under a row still on screen saying the
    /// sentence, and a folded run left no such row behind.
    var caption: EvidenceAddress {
        guard case let .narration(said, _) = subject else { return address }
        return .named(said)
    }

    /// The kind's own mark, which is what the panel's header is now open ON — the verb and how it
    /// went. The LANGUAGE's mark belongs to a step, beside the one address it is true of.
    private var symbol: String {
        kind.symbol ?? ArgoSymbol.plainSource
    }
}
