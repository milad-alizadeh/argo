/// Finding a file by any part of its path (#1155).
///
/// **Every term has to appear somewhere in the path**, and that is the whole rule. No ranking, no
/// fuzziness, nothing to learn — which is what makes it behave the same on a repository of Swift
/// and a repository of Python. A rule with a score in it answers `serializer` differently
/// depending on which half of a repository it was tuned against; this one answers with both.
public struct AtlasSearch: Sendable {
    /// The words the reader typed, lowercased. Empty where they typed nothing, which is not a
    /// question and matches everything rather than nothing.
    private let terms: [String]

    public init(_ query: String) {
        self.terms = query.lowercased().split(whereSeparator: \.isWhitespace).map(String.init)
    }

    /// Whether the reader typed a question at all. A caller draws the whole map's files when they
    /// did not, and what was found when they did — the two are different sentences, and only this
    /// tells them apart.
    public var isAsking: Bool {
        !terms.isEmpty
    }

    /// Whether this path answers every term.
    ///
    /// The path is lowercased ONCE per file rather than per term: a term list is short and a
    /// repository's file list is not.
    public func matches(_ path: String) -> Bool {
        guard isAsking else { return true }
        let lowered = path.lowercased()
        return terms.allSatisfy(lowered.contains)
    }
}

public extension AtlasMap {
    /// The paths of the files this query finds, in the order the Map holds them (#1155).
    ///
    /// The Map's own order rather than a sorted or scored one: the rule has no ranking in it, so
    /// there is nothing to rank by, and the order a reader sees twice for one query is the order
    /// the measurement was written in.
    func files(matching query: String) -> [String] {
        let search = AtlasSearch(query)
        return plots.map(\.path).filter(search.matches)
    }
}
