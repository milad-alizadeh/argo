import Foundation

/// A read's output, read as the numbered listing of a file.
///
/// What comes back from a read is the file with the host's own line numbers written into the text
/// (`     12→import Foundation`). Drawn as a stream those digits cannot be lined up, and nothing
/// can be coloured without colouring them too.
///
/// So the gutter is taken off — and taken off ONLY when every line has one and the numbers run
/// consecutively. That pair of conditions is what keeps this a reading rather than a guess: output
/// that happens to open on a digit fails the first, and a table of numbers fails the second.
/// Anything that fails is `nil` and is drawn exactly as it arrived, which is the honest answer and
/// also the harmless one.
struct EvidenceListing: Equatable, Sendable {
    /// One line of the file, with the number the host gave it — `nil` where the text carried no
    /// gutter, since a line's place in a file is a fact only the host has.
    struct Line: Equatable, Sendable {
        let number: Int?
        let text: String
    }

    let lines: [Line]

    /// `nil` where the text is not a numbered listing — see the type's own note for what that
    /// means.
    init?(_ text: String) {
        let read = Self.split(text)
        let numbered = read.compactMap(Self.numbered)
        guard numbered.count == read.count, !numbered.isEmpty, Self.consecutive(numbered) else {
            return nil
        }
        self.lines = numbered
    }

    /// The same file where nothing wrote a gutter into it — a file ARGO read rather than one a host
    /// printed (a skill's `SKILL.md`). It is still the file, so it is still drawn as one; it just
    /// has no numbers, and none are invented for it.
    init(file text: String) {
        self.lines = Self.split(text).map { Line(number: nil, text: $0) }
    }

    /// The characters of the file itself, gutter and all removed. What anything RENDERING the file
    /// is handed: `    12→## What I found` through a markdown renderer is not the document.
    var text: String {
        lines.map(\.text).joined(separator: "\n")
    }

    /// Whether the host gave these lines numbers. The gutter is drawn only where there is one — an
    /// empty column claims the file has numbers that went missing.
    var hasGutter: Bool {
        lines.contains { $0.number != nil }
    }

    private static func split(_ text: String) -> [String] {
        var read = text.components(separatedBy: "\n")
        // A trailing newline is the end of the last line, not a line of its own — kept, it is a
        // line with no number on it, and the whole reading fails on the file's own final newline.
        if read.last?.isEmpty == true {
            read.removeLast()
        }
        return read
    }

    /// One line split at its gutter. Both delimiters the CLIs write are read — Claude Code's arrow
    /// and the tab a `cat -n` style listing uses — and nothing else is, because a colon or a space
    /// after a number is a shape ordinary output takes all the time.
    private static func numbered(_ line: String) -> Line? {
        let head = line.drop(while: \.isWhitespace)
        let digits = head.prefix(while: \.isNumber)
        guard let number = Int(digits) else { return nil }
        let rest = head.dropFirst(digits.count)
        guard let delimiter = rest.first, delimiter == "→" || delimiter == "\t" else { return nil }
        return Line(number: number, text: String(rest.dropFirst()))
    }

    /// Whether the numbers count up one at a time. A read of the middle of a file starts wherever
    /// it starts, so the FIRST number is checked against nothing — what makes the column a gutter
    /// is that it never skips.
    private static func consecutive(_ lines: [Line]) -> Bool {
        zip(lines, lines.dropFirst()).allSatisfy { line, next in
            guard let number = line.number, let following = next.number else { return false }
            return following == number + 1
        }
    }
}
