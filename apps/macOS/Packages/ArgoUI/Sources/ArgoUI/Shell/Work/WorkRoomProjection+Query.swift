import ArgoEngine

/// What the backlog's search field narrows by (#873), and the one place it is decided —
/// `cockpit-work-room.md`, **the two narrowings, decided**.
///
/// It matches the ticket's NUMBER and TITLE and nothing else. Not the body: a body is read only for
/// the ticket the deck is open on, so a body match would answer the same query differently
/// depending on what the reader last clicked. Not labels, type or assignee: those are closed sets
/// of the provider's own words, which is what makes them the funnel's — a field that also matched
/// them would overlap the control beside it with nothing on screen to say which one excluded a
/// ticket.
extension WorkRoomProjection {
    /// The reader's query, folded once. Built through `typed(_:)`, which is what refuses a blank —
    /// a field holding only spaces is not a query, and matching everything by accident is the same
    /// false claim as matching nothing.
    struct Query: Sendable, Equatable {
        /// The reader's own text, trimmed and otherwise verbatim. The stated empty quotes it back,
        /// so it is kept beside the folded form rather than recovered from it.
        let raw: String
        /// Case- and diacritic-folded, so the provider's own case is never the reader's problem.
        let folded: String
        /// The same query as digits, where it is one — `#763` and `763` are the same question.
        /// Absent where the reader typed anything else, so a title holding `7` never matches by
        /// number.
        let digits: String?

        static func typed(_ raw: String) -> Query? {
            let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmed.isEmpty else { return nil }
            let number = trimmed.hasPrefix("#") ? String(trimmed.dropFirst()) : trimmed
            return Query(
                raw: trimmed,
                folded: fold(trimmed),
                digits: !number.isEmpty && number.allSatisfy(\.isNumber) ? number : nil,
            )
        }

        func matches(_ item: WorkItem) -> Bool {
            if let digits, String(item.number).contains(digits) {
                return true
            }
            return Self.fold(item.title).contains(folded)
        }

        private static func fold(_ text: String) -> String {
            text.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: nil)
        }
    }

    /// What a query has done to this room, and `nil` where the field is empty. The count is of
    /// MATCHES rather than of rows: the list also draws the ancestors a match hangs from.
    struct Narrowing: Sendable, Equatable {
        /// The reader's query, verbatim — the stated empty quotes it back at them.
        let query: String
        let matches: Int
    }

    /// The shown items a query leaves, and which of them actually matched.
    ///
    /// A match whose parent does not match keeps its parents, as rails: the list's structure is
    /// "priority groups the roots, a child hangs under its parent" (#814, #819), so dropping a
    /// non-matching parent would take a counted result off the screen with it.
    static func narrowed(
        _ shown: [WorkItem],
        to query: Query,
    )
        -> (items: [WorkItem], hits: Set<Int>) {
        let hits = Set(shown.filter(query.matches).map(\.number))
        guard !hits.isEmpty else { return ([], hits) }
        let kept = hits.union(ancestors(of: hits, in: shown))
        return (shown.filter { kept.contains($0.number) }, hits)
    }

    /// Every shown item on the path from a match up to its root. The walk terminates because
    /// `parentEdges` holds no cycle — that is the invariant its own refusal keeps.
    private static func ancestors(of hits: Set<Int>, in shown: [WorkItem]) -> Set<Int> {
        let parents = parentEdges(of: shown)
        var kept: Set<Int> = []
        for hit in hits {
            var walk = parents[hit]
            while let step = walk, !kept.contains(step) {
                kept.insert(step)
                walk = parents[step]
            }
        }
        return kept
    }

    /// The tree with every row that is on screen for a descendant's sake marked as a rail. A pass
    /// over the built tree rather than an argument to `tree(of:reading:closed:)`: what matched is
    /// not something the nesting knows, and the nesting comes out the same either way.
    static func railed(_ rows: [Row], matching hits: Set<Int>) -> [Row] {
        rows.map { row in
            var stated = row
            stated.isRail = !hits.contains(row.id)
            stated.children = railed(row.children, matching: hits)
            return stated
        }
    }
}
