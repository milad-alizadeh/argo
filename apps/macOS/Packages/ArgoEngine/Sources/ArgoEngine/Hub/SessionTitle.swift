import Foundation

/// What a roster row is called, and how firmly.
///
/// The word alone cannot answer "may this be replaced": a title the CLI itself holds is final, the
/// first real prompt is nearly so, a bare `/clear` stands in until something better arrives, and a
/// filename is what is left when nothing has spoken.
///
/// The standings split two-and-two (#1623). The bottom two are ARGO's: nothing outside Argo ever
/// saw them, which is why the same Session read as a machine slug on the phone. The top two are the
/// CLI's own — `CONTEXT.md` L2 · CLI title — and every surface Claude draws already shows them.
/// Which half a name comes from is what decides whether Argo may type it at the prompt, so the
/// halves are told apart here rather than re-derived at the mirror.
struct SessionTitle: Equatable, Sendable {
    /// How much of a claim the current name has. Ordered: a name is only ever overwritten by one
    /// that outranks what would replace it.
    enum Standing: Int, Comparable, Sendable {
        /// The transcript's filename, or the words a spawn opened with — a name only because a row
        /// must have one, and replaced by the first thing that says more.
        case placeholder
        /// A bare slash command (`/clear` opening a fresh transcript): it names the plumbing rather
        /// than the work, so it stands in and stays takeable.
        case provisional
        /// The Session's first real prompt.
        case prompt
        /// The title the CLI's own summariser wrote (`ai-title`). Above `prompt` because it is a
        /// reading of the same conversation that somebody outside Argo can already see.
        case summarised
        /// The title the reader typed at the CLI's own prompt (`custom-title`, which `/rename`
        /// writes). The top of the ladder: a name a person chose outranks one a summariser wrote,
        /// whichever order the two records land in.
        case custom

        /// Whether a name at this standing is one the CLI itself holds, rather than one Argo
        /// assembled and nothing outside Argo has seen.
        var isCLITitle: Bool {
            self >= .summarised
        }

        static func < (lhs: Self, rhs: Self) -> Bool {
            lhs.rawValue < rhs.rawValue
        }
    }

    private(set) var text: String
    private(set) var standing: Standing = .placeholder

    init(startingWith text: String) {
        self.text = text
    }

    /// A title one of the CLI's own records stated (`CONTEXT.md` L2 · CLI title).
    ///
    /// Taken only where it does not fall BELOW what the row already holds, which is the whole of
    /// the two kinds' contest: a summariser record landing after the reader's own `/rename` leaves
    /// the reader's name alone, and a second record of the SAME kind replaces its predecessor,
    /// because writing again is how the CLI says a title moved.
    mutating func state(_ title: String, _ kind: CLITitleKind) {
        guard kind.standing >= standing else { return }
        text = title
        standing = kind.standing
    }

    /// The CLI's own title for this Session, and `nil` where it holds none — the one question the
    /// mirror asks before typing at a prompt (#1623). A prompt-derived name answers `nil`: it is
    /// Argo's, and nothing outside Argo has seen it.
    var cliTitle: String? {
        standing.isCLITitle ? text : nil
    }

    /// Whether the name Argo holds says anything about the WORK, rather than standing in for a name
    /// (#1623). A transcript's UUID filename does not, and neither does the bare `/clear` that
    /// opened a fresh one.
    ///
    /// The floor under the mirror, and it has to be a floor: typing `/rename <uuid>` at the prompt
    /// makes the CLI write a `custom-title`, which is the TOP of this ladder — so a placeholder
    /// mirrored once would outrank every prompt and every summariser title that followed it, and
    /// the row would wear a UUID on both surfaces for good.
    var namesTheWork: Bool {
        standing >= .prompt
    }

    /// The first line of a prompt, taken as the row's name while nothing better has claimed it. A
    /// blank line names nothing and is ignored.
    mutating func observe(prompt: String) {
        guard standing < .prompt,
              let firstLine = prompt.split(whereSeparator: \.isNewline).first
        else { return }
        let candidate = String(firstLine).trimmingCharacters(in: .whitespacesAndNewlines)
        guard !candidate.isEmpty else { return }
        text = candidate
        standing = isBareCommand(candidate) ? .provisional : .prompt
    }

    /// The later half of a resume chain names the whole chain, where it has anything to name it
    /// with: a continuation's own placeholder is never one.
    mutating func merge(_ continuation: SessionTitle) {
        if continuation.standing.isCLITitle, continuation.standing >= standing {
            self = continuation
        } else if standing < .prompt, continuation.standing > .placeholder {
            self = continuation
        }
    }

    private func isBareCommand(_ line: String) -> Bool {
        line.hasPrefix("/") && !line.contains(where: \.isWhitespace)
    }
}
