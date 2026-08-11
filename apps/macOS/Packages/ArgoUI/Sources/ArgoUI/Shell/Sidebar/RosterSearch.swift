import Foundation

/// Which roster rows a typed query keeps.
///
/// It filters ROWS and not Sessions: a row is what is on screen, so the search matches what a
/// reader can actually see.
enum RosterSearch {
    /// Every row, unchanged, for a query that is blank or nothing but spaces.
    ///
    /// Words are ANDed: `argo rename` keeps the rows matching BOTH, so the search gets narrower as
    /// you type.
    static func matching(_ query: String, in rows: [SessionRosterProjection.Row])
        -> [SessionRosterProjection.Row] {
        let terms = query.split(whereSeparator: \.isWhitespace).map(String.init)
        guard !terms.isEmpty else { return rows }
        return rows.filter { row in
            let haystack = searchable(row)
            return terms.allSatisfy { term in
                haystack.contains { $0.range(of: term, options: matching) != nil }
            }
        }
    }

    /// Case- and diacritic-insensitive: nothing on the roster is a case-sensitive identifier.
    private static let matching: String.CompareOptions = [.caseInsensitive, .diacriticInsensitive]

    /// The three facts a row draws that anyone would search by. The age and the state word are not
    /// here: they are the roster's own wording, not anything a Session said about itself.
    private static func searchable(_ row: SessionRosterProjection.Row) -> [String] {
        [row.title, row.worktree, row.branch].compactMap(\.self)
    }
}
