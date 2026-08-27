/// The Workspace's file list, prepared once when it is read rather than per keystroke (#687).
///
/// Matching is case-insensitive over the whole path, so a plain `[String]` means lowercasing every
/// path again on every character typed — a hundred thousand allocations per keystroke on a
/// monorepo. The lowercased form and the membership set are both folded in here instead, where the
/// cost is paid once per open.
struct WorkspaceTree: Equatable {
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
