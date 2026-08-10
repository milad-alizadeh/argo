import Foundation

/// Which roster rows a typed query keeps.
///
/// Its own type rather than a `filter` in the sidebar, for the reason every other rule about the
/// roster is a projection: what counts as a match is a DECISION — which facts are searched, whether
/// two words mean both or either, what a blank query means — and a decision inside a `body` is one
/// nothing can hold to.
///
/// It filters ROWS and not Sessions, deliberately: a row is what is on screen, so the search
/// matches what a reader can actually see. Searching a fact the row does not draw would return a
/// list whose every entry looks like it does not match.
enum RosterSearch {
    /// Every row, unchanged, for a query that is blank or nothing but spaces — an empty field is
    /// not a filter that matches nothing, it is the absence of one.
    ///
    /// Words are ANDed: `argo rename` keeps the rows matching BOTH, which is how a search gets
    /// narrower as you type. ORing them would widen the list on every keystroke, which reads as
    /// the field being broken.
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

    /// Case- and diacritic-insensitive: a name typed in a hurry is not a different Session, and
    /// nothing on the roster is a case-sensitive identifier — the branch is the closest, and git
    /// does not ask you to shout it either.
    private static let matching: String.CompareOptions = [.caseInsensitive, .diacriticInsensitive]

    /// The three facts a row draws that anyone would search by. The age and the state word are
    /// deliberately not here: they are the roster's own wording of a moment and a status, so
    /// matching them would let `idle` mean something a Session never said about itself.
    private static func searchable(_ row: SessionRosterProjection.Row) -> [String] {
        [row.title, row.worktree, row.branch].compactMap(\.self)
    }
}
