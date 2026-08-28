import Foundation

/// A `mermaid` fence's source reduced to the lines a reader really reads: comments taken off, the
/// optional trailing `;` taken off, and the blank lines dropped.
///
/// Shared by every diagram type, because `%%` is mermaid's own comment whatever the fence declares
/// — and a second reader spelling this itself would be one spelling away from reading a label as
/// syntax.
enum MermaidSource {
    /// The rest of a line after `keyword `, or `nil` where the line does not open with it. The
    /// space is the point: `stateful --> A` names a state, and reading it as a declaration would
    /// refuse a diagram nothing is wrong with.
    static func word(_ keyword: String, of line: String) -> String? {
        guard line.lowercased().hasPrefix("\(keyword) ") else { return nil }
        return String(line.dropFirst(keyword.count)).trimmingCharacters(in: .whitespaces)
    }

    /// The text either side of the FIRST `:`, or `nil` where the line has none. First and not last,
    /// because everything after it is words and words may carry colons.
    static func split(_ line: String) -> (head: String, tail: String)? {
        guard let at = line.firstIndex(of: ":") else { return nil }
        return (
            String(line[line.startIndex ..< at]).trimmingCharacters(in: .whitespaces),
            String(line[line.index(after: at)...]).trimmingCharacters(in: .whitespaces),
        )
    }

    /// The same words with a wrapping pair of quotes taken off. Mermaid quotes a label only so it
    /// can hold spaces, so the quotes are spelling and not part of what the label says.
    static func unquoted(_ text: String) -> String {
        guard text.count > 1, text.hasPrefix("\""), text.hasSuffix("\"") else { return text }
        return String(text.dropFirst().dropLast())
    }

    static func lines(of source: String) -> [String] {
        source.components(separatedBy: "\n").map(stripped).filter { !$0.isEmpty }
    }

    /// The same lines, each with the column it starts at — for the one diagram type whose
    /// STRUCTURE is the whitespace (#867). A count of leading CHARACTERS: what such a nesting rests
    /// on is that a deeper line starts further along, and any one consistent width answers that.
    ///
    /// `nil` where the indentation MIXES tabs and spaces. A tab is as wide as the reader's editor
    /// says, so a tab beside two spaces has no one answer — and counting either as the other would
    /// nest a line under one it stands shallower than, which is a wrong render rather than none.
    /// The whole source degrades to its fence instead.
    static func indented(of source: String) -> [Line]? {
        let lines = source.components(separatedBy: "\n").compactMap { line -> Line? in
            let text = stripped(line)
            guard !text.isEmpty else { return nil }
            return Line(indent: String(line.prefix { $0 == " " || $0 == "\t" }), text: text)
        }
        let indents = lines.map(\.indent).joined()
        guard !indents.contains("\t") || !indents.contains(" ") else { return nil }
        return lines
    }

    /// One stripped line, and the whitespace it was written behind.
    struct Line: Equatable, Sendable {
        let indent: String
        let text: String

        /// How far along the line starts. One per character, which only means anything because
        /// `indented(of:)` has already refused a source mixing the two widths.
        var column: Int {
            indent.count
        }
    }

    /// One line, stripped. `%%` opens a comment only OUTSIDE a quoted label, which exists precisely
    /// so a label can carry what would otherwise read as syntax.
    private static func stripped(_ line: String) -> String {
        var kept = ""
        var isQuoted = false
        var previous: Character?
        for character in line {
            if character == "\"" {
                isQuoted.toggle()
            }
            if !isQuoted, character == "%", previous == "%" {
                kept.removeLast()
                break
            }
            kept.append(character)
            previous = character
        }
        let trimmed = kept.trimmingCharacters(in: .whitespaces)
        return (trimmed.hasSuffix(";") ? String(trimmed.dropLast()) : trimmed)
            .trimmingCharacters(in: .whitespaces)
    }
}
