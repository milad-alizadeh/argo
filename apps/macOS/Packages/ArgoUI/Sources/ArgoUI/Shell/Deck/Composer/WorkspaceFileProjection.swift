/// What the composer's `@` menu draws, derived from the Workspace's file list and the line being
/// typed (#687, `cockpit-composer-picker.md` decisions 12 and 13).
///
/// A pure function of the two, for the reason `CommandMenuProjection` is one: every rule the design
/// states about where `@` opens and what order files come in is then a thing a test can hold still.
enum WorkspaceFileProjection {
    /// The `@` token the reader is typing, and where it sits — the range is what an insertion
    /// replaces, so the mention lands on the token rather than over the whole line.
    struct Mention: Equatable {
        /// What was typed after the `@`, empty while the token is only the sigil.
        let query: String
        /// The whole token including its `@`, in the draft's own indices.
        let range: Range<String.Index>
    }

    /// The surface, or `nil` where the line opens none. Unlike the `/` menu this has no sections
    /// and no status strip: one clock reads the tree, and every path came from it.
    struct Menu: Equatable {
        let rows: [Row]
        /// What the reader typed after the `@`, for the zero line to name back to them.
        let query: String

        var isEmpty: Bool {
            rows.isEmpty
        }
    }

    /// One file. The filename leads and its directory follows, because a nine-segment path is a
    /// column of identical prefixes when the path leads.
    struct Row: Equatable, Identifiable {
        var id: String {
            path
        }

        /// Relative to the Workspace root — what goes in the draft, and never an absolute path.
        let path: String
        /// The last segment, set in `machine` at the head of the row.
        let name: String
        /// Everything before it, and `nil` for a file at the root of the tree rather than an
        /// empty caption standing where a directory would be.
        let directory: String?
        /// Whether this Session has already read or edited the file. Those sort first, because the
        /// file the reader means next is nearly always one the agent has just been in.
        let isTouched: Bool
    }

    /// The Workspace tree, prepared once when it is read rather than per keystroke.
    ///
    /// Matching is case-insensitive over the whole path, so a plain `[String]` means lowercasing
    /// every path again on every character typed — a hundred thousand allocations per keystroke on
    /// a monorepo. The lowercased form and the membership set are both folded in here instead,
    /// where the cost is paid once per open.
    struct Tree: Equatable {
        /// One path, in tree order, with the form the matcher actually reads.
        struct Entry: Equatable {
            let path: String
            /// The path lowercased, as UTF-8 bytes. BYTES and not a `String`, because walking a
            /// String walks graphemes: measured in RELEASE over 100k paths, a non-matching query
            /// costs about 23ms off bare strings and about 3ms off these. Debug reverses that, so
            /// any re-measurement has to be `swift test -c release`.
            let folded: [UInt8]
        }

        let entries: [Entry]
        private let byPath: [String: Entry]

        init(_ paths: [String]) {
            self.entries = paths.map { Entry(path: $0, folded: Array($0.lowercased().utf8)) }
            self.byPath = Dictionary(
                entries.map { ($0.path, $0) },
                uniquingKeysWith: { first, _ in first },
            )
        }

        /// The entry for a path the tree carries, and `nil` for one it does not — which is how a
        /// touched file outside the Workspace is dropped rather than offered.
        func entry(_ path: String) -> Entry? {
            byPath[path]
        }
    }

    /// How many matches the derive will build rows for.
    ///
    /// The list shows eleven and scrolls; fifty is headroom for a reader who scrolls rather than
    /// types. It is a bound on the DERIVE and not on the read: a monorepo lists a hundred thousand
    /// paths, all of them reachable by typing, and building a row for each on every keystroke is
    /// what would make the composer stutter.
    static let rowCeiling = 50
}
