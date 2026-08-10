import Foundation

/// What a roster row is called, and how firmly.
///
/// The word alone cannot answer "may this be replaced", and every rule about a Session's name is a
/// rule about exactly that: an explicit title is final, the first real prompt is nearly so, a bare
/// `/clear` stands in until something better arrives, and a filename is what is left when nothing
/// has spoken. Holding the word beside its standing keeps those four cases in one place rather than
/// as flags read in pairs wherever a title is set.
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
        /// A title the record stated outright.
        case explicit

        static func < (lhs: Self, rhs: Self) -> Bool {
            lhs.rawValue < rhs.rawValue
        }
    }

    private(set) var text: String
    private(set) var standing: Standing = .placeholder

    init(startingWith text: String) {
        self.text = text
    }

    /// A title the record stated. Final: nothing outranks it, and a later one replaces it.
    mutating func state(_ title: String) {
        text = title
        standing = .explicit
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
        if continuation.standing == .explicit {
            self = continuation
        } else if standing < .prompt, continuation.standing > .placeholder {
            self = continuation
        }
    }

    private func isBareCommand(_ line: String) -> Bool {
        line.hasPrefix("/") && !line.contains(where: \.isWhitespace)
    }
}
