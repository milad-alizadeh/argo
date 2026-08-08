import Foundation

/// A pipe table, as its cells.
///
/// A block of `|`-delimited lines was arriving as a paragraph, so the pipes and the row of dashes
/// under the header were on the screen as characters and the columns lined up with nothing. What
/// makes it a table is the DELIMITER row: markdown says a pipe table is a header, a row of dashes,
/// and its body, and one line of pipes on its own is a sentence with pipes in it.
///
/// Every cell keeps its own inline marks for `FeedProseText` to read, exactly as a list item does.
struct MarkdownTable: Equatable {
    let header: [String]
    let rows: [[String]]

    /// The table these lines make, or `nil` for lines that are prose. Called on a block that has
    /// already been closed, so the whole of it is here to look at rather than one line at a time —
    /// which is what lets the second line decide the first.
    static func read(_ lines: [String]) -> MarkdownTable? {
        guard lines.count >= 2, isDelimiter(lines[1]) else { return nil }
        let header = cells(in: lines[0])
        guard !header.isEmpty else { return nil }
        return MarkdownTable(
            header: header,
            // Padded to the header's width and never past it: a ragged row is the agent's, and
            // dropping a cell it wrote would lose it while a short row only leaves a gap.
            rows: lines.dropFirst(2).map { row in
                let cells = cells(in: row).prefix(header.count)
                return cells + Array(repeating: "", count: header.count - cells.count)
            },
        )
    }

    /// `|---|:--:|---:|` and nothing else. The colons that carry alignment are read as part of the
    /// shape but not acted on — every column is set left, because a column of prose that jumps to
    /// the right edge is harder to read than one that ignored the author's colon.
    private static func isDelimiter(_ line: String) -> Bool {
        let cells = cells(in: line)
        guard !cells.isEmpty else { return false }
        return cells.allSatisfy { cell in
            cell.contains("-") && cell.allSatisfy { $0 == "-" || $0 == ":" }
        }
    }

    private static func cells(in line: String) -> [String] {
        var trimmed = line.trimmingCharacters(in: .whitespaces)
        guard trimmed.hasPrefix("|") else { return [] }
        trimmed = String(trimmed.dropFirst())
        if trimmed.hasSuffix("|") {
            trimmed = String(trimmed.dropLast())
        }
        return trimmed
            .components(separatedBy: "|")
            .map { $0.trimmingCharacters(in: .whitespaces) }
    }
}
