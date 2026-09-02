import Foundation

/// One line of a banded source, read as far as the two keywords both types share.
///
/// A journey and a timeline are the same grammar down to here: a header, a title, a run of named
/// bands, and rows under each. Only what a row means differs, which is why `row` hands the line
/// back rather than reading it.
enum MermaidBandsLine: Equatable, Sendable {
    case title(String)
    case section(String)
    /// Neither keyword. The reader's own row rule decides what it is.
    case row(String)
    /// A keyword carrying no words — `section` naming no band, `title` titling nothing. Decidable
    /// and refused, so a half-streamed fence stays a fence instead of drawing a column called
    /// `section`.
    case refused
}

enum MermaidBandsKeyword {
    /// How far a line can be read before the reader's own rules take over.
    static func read(_ line: String) -> MermaidBandsLine {
        if let words = tail(of: line, after: "title") {
            return words.isEmpty ? .refused : .title(words)
        }
        if let words = tail(of: line, after: "section") {
            return words.isEmpty ? .refused : .section(words)
        }
        return .row(line)
    }

    /// Whether the line IS the keyword and nothing else, which is how each of these types spells
    /// its own header.
    static func opens(_ line: String, on keyword: String) -> Bool {
        tail(of: line, after: keyword)?.isEmpty == true
    }

    /// What is left of `line` after `keyword`, or `nil` where the line does not open with it.
    /// Case-insensitive on the keyword alone, because mermaid's own are.
    private static func tail(of line: String, after keyword: String) -> String? {
        guard line.count >= keyword.count,
              line.prefix(keyword.count).lowercased() == keyword.lowercased()
        else { return nil }
        let rest = line.dropFirst(keyword.count)
        guard rest.isEmpty || rest.hasPrefix(" ") else { return nil }
        return rest.trimmingCharacters(in: .whitespaces)
    }
}
