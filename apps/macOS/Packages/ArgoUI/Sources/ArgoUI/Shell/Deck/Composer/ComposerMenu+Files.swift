import Foundation

/// Where the `@` menu opens, what it lists and in what order (design decisions 2, 12 and 13).
extension ComposerMenu {
    /// The `@` token the reader is typing. It carries no range: the token runs to the end of the
    /// line, so `Listing.pick` counts back from there rather than holding an index into a string
    /// it may outlive.
    struct Mention: Equatable {
        /// What was typed after the `@`, empty while the token is only the sigil.
        let query: String
    }

    /// The listing for a line, or `nil` where the line opens none.
    ///
    /// One section, unlabelled: one clock reads the tree and every path came off it, where the `/`
    /// menu joins two halves with two clocks and has to group and say so.
    static func files(for text: String, in tree: WorkspaceTree, touched: [String]) -> Listing? {
        guard let mention = mention(in: text) else { return nil }
        let rows = rows(of: tree, touchedBy: touched, matching: mention.query)
        let section = Section(id: "files", label: nil, detail: nil, rows: rows)
        return Listing(
            sections: rows.isEmpty ? [] : [section],
            query: mention.query,
            sigil: .file,
        )
    }

    /// The same, off a bare listing. For a caller holding paths and no prepared `WorkspaceTree` —
    /// a test, a specimen — which is why it builds one rather than matching over the strings.
    static func files(for text: String, in paths: [String], touched: [String]) -> Listing? {
        files(for: text, in: WorkspaceTree(paths), touched: touched)
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
        guard let at = text.lastIndex(of: fileSigil), opensToken(text, at: at) else { return nil }
        let typed = text[text.index(after: at)...]
        guard !typed.contains(where: \.isWhitespace) else { return nil }
        return Mention(query: String(typed))
    }

    /// Whether the sigil stands at a token boundary rather than inside a word.
    private static func opensToken(_ text: String, at index: String.Index) -> Bool {
        guard index > text.startIndex else { return true }
        return text[text.index(before: index)].isWhitespace
    }

    private static let fileSigil: Character = "@"

    /// How many matches the derive will build rows for.
    ///
    /// The list shows eleven and scrolls; fifty is headroom for a reader who scrolls rather than
    /// types. It is a bound on the DERIVE and not on the read: a monorepo lists a hundred thousand
    /// paths, all of them reachable by typing, and building a row for each on every keystroke is
    /// what would make the composer stutter.
    static let fileCeiling = 50

    /// The mark on a file this Session's agent has already read or edited (#687).
    static let touched = "touched"

    /// Touched first, in the order they were touched, then everything else in the order the tree
    /// listed it. A touched path the tree does not carry is dropped: the agent reading `/etc/hosts`
    /// is not a file this Workspace offers (acceptance — the picker offers no path outside it).
    private static func rows(
        of tree: WorkspaceTree,
        touchedBy touched: [String],
        matching query: String,
    )
        -> [Row] {
        let first = touched.compactMap(tree.entry)
        let firstSet = Set(first.map(\.path))
        let wanted = Array(query.lowercased().utf8)
        var rows: [Row] = []
        rows.reserveCapacity(fileCeiling)
        // Two passes over the entries rather than one over `first + rest`: concatenating them built
        // a fresh hundred-thousand-element array on every keystroke, which cost more than the
        // matching did.
        for entry in first where matches(wanted, in: entry.folded) {
            rows.append(row(for: entry.path, isTouched: true))
            if rows.count == fileCeiling {
                return rows
            }
        }
        for entry in tree.entries where !firstSet.contains(entry.path) {
            guard matches(wanted, in: entry.folded) else { continue }
            rows.append(row(for: entry.path, isTouched: false))
            if rows.count == fileCeiling {
                return rows
            }
        }
        return rows
    }

    /// A SUBSEQUENCE over the whole path, in order (decision 13): `sesdri` reaches
    /// `…/Session/SessionDriver.swift` in six keystrokes, where a substring match would not.
    ///
    /// Both sides arrive lowercased as UTF-8 bytes, off `WorkspaceTree.Entry` — folding or
    /// re-walking them here would put the cost this takes off the open and back onto every
    /// keystroke.
    private static func matches(_ wanted: [UInt8], in folded: [UInt8]) -> Bool {
        guard !wanted.isEmpty else { return true }
        var next = wanted.startIndex
        for byte in folded where byte == wanted[next] {
            next += 1
            if next == wanted.endIndex {
                return true
            }
        }
        return false
    }

    /// The filename leads and its directory follows, because a nine-segment path is a column of
    /// identical prefixes when the path leads. No accent inking on what matched: a subsequence
    /// scatters the characters across the segments, which speckles the row rather than pointing at
    /// anything, and `at-filter.png` draws none.
    private static func row(for path: String, isTouched: Bool) -> Row {
        let segments = path.split(separator: "/")
        let directory = segments.dropLast().joined(separator: "/")
        return Row(
            id: path,
            // It stays text and never an `AttachmentChip` — dropping and pasting make those (#540).
            insert: "@\(path) ",
            lead: String(segments.last ?? Substring(path)),
            matched: 0 ..< 0,
            // `nil` for a file at the root of the tree, rather than an empty caption standing
            // where a directory would be.
            detail: directory.isEmpty ? nil : Detail(words: directory, voice: .path),
            // Touched sorts first, because the file the reader means next is nearly always one the
            // agent has just been in — the badge is what says so on the row.
            badges: isTouched ? [Badge(words: touched, tone: .quiet)] : [],
        )
    }
}
