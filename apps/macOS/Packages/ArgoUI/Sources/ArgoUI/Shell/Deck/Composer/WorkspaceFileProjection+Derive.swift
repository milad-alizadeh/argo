import Foundation

/// Where the `@` menu opens, what it lists and in what order (design decisions 2, 12 and 13).
extension WorkspaceFileProjection {
    /// The menu for a line, or `nil` where the line opens none.
    static func menu(for text: String, in files: [String], touched: [String]) -> Menu? {
        guard let mention = mention(in: text) else { return nil }
        return Menu(
            rows: rows(of: files, touchedBy: touched, matching: mention.query),
            query: mention.query,
        )
    }

    /// The `@` token being typed, and `nil` where there is none.
    ///
    /// Two rules, both decision 2's. **At any token boundary** — the `@` must open the line or
    /// follow whitespace, so `milad@example.com` is an address rather than a mention. **Closed by
    /// the first space after it**, which is what says the file is named and the sentence has gone
    /// on; it is also what leaves the line sendable, since a settled mention draws no menu over
    /// the ⏎ that sends it.
    ///
    /// The LAST such token, because that is the one being typed. An earlier mention in the same
    /// line is already settled and must not reopen.
    static func mention(in text: String) -> Mention? {
        guard let at = text.lastIndex(of: sigil), opensToken(text, at: at) else { return nil }
        let typed = text[text.index(after: at)...]
        guard !typed.contains(where: \.isWhitespace) else { return nil }
        return Mention(query: String(typed), range: at ..< text.endIndex)
    }

    /// Whether the sigil stands at a token boundary rather than inside a word.
    private static func opensToken(_ text: String, at index: String.Index) -> Bool {
        guard index > text.startIndex else { return true }
        return text[text.index(before: index)].isWhitespace
    }

    private static let sigil: Character = "@"

    /// Touched first, in the order they were touched, then everything else in the order the tree
    /// listed it. A touched path the tree does not carry is dropped: the agent reading `/etc/hosts`
    /// is not a file this Workspace offers (acceptance — the picker offers no path outside it).
    private static func rows(
        of files: [String],
        touchedBy touched: [String],
        matching query: String,
    )
        -> [Row] {
        let inTree = Set(files)
        let first = touched.filter(inTree.contains)
        let firstSet = Set(first)
        let ordered = first + files.filter { !firstSet.contains($0) }
        let wanted = Array(query.lowercased())
        var rows: [Row] = []
        for path in ordered where matches(wanted, in: path) {
            rows.append(row(for: path, isTouched: firstSet.contains(path)))
            if rows.count == rowCeiling {
                break
            }
        }
        return rows
    }

    /// A SUBSEQUENCE over the whole path, in order (decision 13): `sesdri` reaches
    /// `…/Session/SessionDriver.swift` in six keystrokes, where a substring match would not.
    private static func matches(_ wanted: [Character], in path: String) -> Bool {
        guard !wanted.isEmpty else { return true }
        var next = wanted.startIndex
        for character in path.lowercased() where character == wanted[next] {
            next += 1
            if next == wanted.endIndex {
                return true
            }
        }
        return false
    }

    private static func row(for path: String, isTouched: Bool) -> Row {
        let segments = path.split(separator: "/")
        let directory = segments.dropLast().joined(separator: "/")
        return Row(
            path: path,
            name: String(segments.last ?? Substring(path)),
            directory: directory.isEmpty ? nil : directory,
            isTouched: isTouched,
        )
    }
}
