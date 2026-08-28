import ArgoEngine

/// What the backlog's search field narrows by — the number and the title, and nothing else
/// (`cockpit-work-room.md`, **the two narrowings, decided**).
extension TicketsRoomProjection {
    /// The reader's query, folded once. `typed(_:)` is the only way in, because it is what refuses
    /// a blank — a field holding only spaces would otherwise match every ticket.
    struct Query: Sendable, Equatable {
        /// Trimmed and otherwise verbatim, because the stated empty quotes it back.
        let raw: String
        let folded: String
        /// The query as digits, where it is one — `#763` and `763` are the same question, and a
        /// title holding `7` is not.
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

        func matches(_ item: Ticket) -> Bool {
            if let digits, String(item.number).contains(digits) {
                return true
            }
            return Self.fold(item.title).contains(folded)
        }

        private static func fold(_ text: String) -> String {
            text.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: nil)
        }
    }

    /// What a query has done to this room, and `nil` where the field is empty.
    struct Narrowing: Sendable, Equatable {
        let query: String
        /// The MATCHES, never the rows: the list also draws the ancestors a match hangs from.
        let matches: Int
    }

    /// One query's answer over the items a view is already showing.
    struct Narrowed {
        let query: Query
        /// The matches AND the ancestors they hang from, in the order the provider served them.
        let items: [Ticket]
        /// Which of `items` matched. The rest are on screen for a descendant's sake.
        let hits: Set<Int>

        var narrowing: Narrowing {
            Narrowing(query: query.raw, matches: hits.count)
        }
    }

    /// A match whose parent does not match keeps its parents, as rails: the list's structure is
    /// "priority groups the roots, a child hangs under its parent" (#814, #819), so dropping a
    /// non-matching parent would take a counted result off the screen with it.
    ///
    /// An ancestor the VIEW excluded is not brought back — the chain stops there and the match
    /// stands as a root, which is what `tree(of:reading:closed:)` already does with any shown item
    /// whose parent is not shown.
    static func narrowed(_ shown: [Ticket], to query: Query) -> Narrowed {
        let hits = Set(shown.filter(query.matches).map(\.number))
        guard !hits.isEmpty else { return Narrowed(query: query, items: [], hits: hits) }
        let kept = hits.union(ancestors(of: hits, in: shown))
        let items = shown.filter { kept.contains($0.number) }
        return Narrowed(query: query, items: items, hits: hits)
    }

    /// Every shown item on the path from a match up to its root. The walk terminates because
    /// `parentEdges` holds no cycle — that is the invariant its own refusal keeps.
    private static func ancestors(of hits: Set<Int>, in shown: [Ticket]) -> Set<Int> {
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

    /// The tree with every row that is on screen for a descendant's sake marked as a rail.
    static func railed(_ rows: [Row], matching hits: Set<Int>) -> [Row] {
        rows.map { row in
            var stated = row
            stated.isRail = !hits.contains(row.id)
            stated.children = railed(row.children, matching: hits)
            return stated
        }
    }
}
