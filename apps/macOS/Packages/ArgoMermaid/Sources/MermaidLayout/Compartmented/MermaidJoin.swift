import Foundation

/// The token joining two boxes, found in a line and cut into what it says: the terminal at each
/// end, how the line between them is stroked, and the text either side of the whole token.
///
/// Shared by both readers, because both spell a relationship as `[end][link][end]` and only the
/// alphabet of the ends differs — `<|--o` and `}o..o{` are one shape read twice (#865).
struct MermaidJoin: Equatable, Sendable {
    let tail: MermaidTerminal
    let head: MermaidTerminal
    let line: MermaidFigure.Line
    /// The text before the token, and the text after it, each trimmed.
    let before: String
    let after: String
}

extension MermaidJoin {
    /// The join this line carries, or `nil` where it carries none this reader can read.
    ///
    /// `terminal` is asked what a run of marker characters means at one end — `true` for the tail —
    /// and it is asked LONGEST first, so `<|--` is read as one inheritance rather than as an
    /// association with a stray bar in front of it.
    static func read(_ line: String, terminal: (String, Bool) -> MermaidTerminal?) -> Self? {
        let text = Array(line)
        guard let at = link(in: text) else { return nil }
        guard let tail = end(in: text, upTo: at, terminal: { terminal($0, true) }),
              let head = end(in: text, from: at + 2, terminal: { terminal($0, false) })
        else { return nil }
        return MermaidJoin(
            tail: tail.terminal,
            head: head.terminal,
            line: text[at] == "-" ? .solid : .dotted,
            before: String(text[0 ..< (at - tail.length)]).trimmingCharacters(in: .whitespaces),
            after: String(text[(at + 2 + head.length)...]).trimmingCharacters(in: .whitespaces),
        )
    }

    /// Where the `--` or `..` stands, ignoring anything inside quotes — a cardinality of `1..*`
    /// carries the dashed link's own spelling inside it, and a scan that did not know would cut the
    /// line through the middle of a word.
    private static func link(in text: [Character]) -> Int? {
        var isQuoted = false
        for at in text.indices.dropLast() {
            if text[at] == "\"" {
                isQuoted.toggle()
            }
            guard !isQuoted, text[at] == "-" || text[at] == ".",
                  text[at + 1] == text[at] else { continue }
            return at
        }
        return nil
    }

    /// The run of marker characters running back to the link, longest first.
    private static func end(
        in text: [Character],
        upTo at: Int,
        terminal: (String) -> MermaidTerminal?,
    )
        -> (terminal: MermaidTerminal, length: Int)? {
        for length in stride(from: min(2, at), through: 0, by: -1) {
            guard let read = taken(text, (at - length) ..< at, terminal) else { continue }
            return (read, length)
        }
        return nil
    }

    /// The same run the other way, running on from the link.
    private static func end(
        in text: [Character],
        from at: Int,
        terminal: (String) -> MermaidTerminal?,
    )
        -> (terminal: MermaidTerminal, length: Int)? {
        for length in stride(from: min(2, text.count - at), through: 0, by: -1) {
            guard let read = taken(text, at ..< (at + length), terminal) else { continue }
            return (read, length)
        }
        return nil
    }

    /// What this run of characters means, where it really is a run of markers and not the end of
    /// the name beside it.
    private static func taken(
        _ text: [Character],
        _ span: Range<Int>,
        _ terminal: (String) -> MermaidTerminal?,
    )
        -> MermaidTerminal? {
        guard !runsOn(text, at: span.lowerBound, next: span.lowerBound - 1),
              !runsOn(text, at: span.upperBound - 1, next: span.upperBound) else { return nil }
        return terminal(String(text[span]))
    }

    /// Whether a marker character at the edge of a run is really the last letter of the name beside
    /// it. `o` is a marker AND a letter, so `Foo--Bar` names `Foo` and not `Fo` by aggregation.
    private static func runsOn(_ text: [Character], at: Int, next: Int) -> Bool {
        guard text.indices.contains(at), text.indices.contains(next) else { return false }
        return MermaidScan.isIdentifier(text[at]) && MermaidScan.isIdentifier(text[next])
    }
}
