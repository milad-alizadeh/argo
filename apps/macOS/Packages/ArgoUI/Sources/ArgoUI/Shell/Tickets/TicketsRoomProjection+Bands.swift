import ArgoEngine

/// The backlog's top-level structure: priority over the ROOTS, a child staying under its parent
/// whatever its own priority is (`cockpit-work-room.md` — the one conflict, and how it resolves).
extension TicketsRoomProjection {
    /// One priority band and the roots under it.
    struct Band: Sendable, Equatable, Identifiable {
        /// The provider's own word, verbatim and in its own case, and absent where nothing was
        /// read. Argo neither ranks these nor recases them.
        let priority: String?
        let roots: [Row]

        /// A band nobody read a priority for and one whose word is empty are DIFFERENT bands, so
        /// the two cannot share a key — `ForEach` would draw one of them and drop the other.
        var id: String {
            priority.map { "priority:\($0.lowercased())" } ?? "unread"
        }

        /// What the header reads; `GroupLabel` uppercases it. The unread band names the TIER rather
        /// than claiming the tracker set none (`CONTEXT.md` L2 · degrade-down).
        var label: String {
            priority ?? "no priority read"
        }
    }

    /// The words the design draws headers for, in the order they stand. Still MATCHED here — a word
    /// this list does not hold opens its own band after the three, keyed off the first root
    /// carrying it in the backlog's own order (#892) rather than being ranked against them. It
    /// comes off `TicketPriority` so the header order and the hero's rank read one list (#273):
    /// two copies of these three words is how a band comes to sit above a ticket the hero ranked
    /// below it.
    private static let bandOrder = TicketPriority.known

    /// The roots banded: the three known words first, then any other word in the order its first
    /// root stands in, and the roots nobody read a priority for last.
    static func bands(of roots: [Row]) -> [Band] {
        var order: [String?] = bandOrder.filter { word in
            roots.contains { key($0.priority) == word }
        }
        for root in roots where root.priority != nil && !order.contains(key(root.priority)) {
            order.append(key(root.priority))
        }
        if roots.contains(where: { $0.priority == nil }) {
            order.append(nil)
        }
        return order.map { word in
            let banded = roots.filter { key($0.priority) == word }
            return Band(priority: banded.first?.priority ?? word, roots: banded)
        }
    }

    /// One band's rows in draw order, each told whether its own priority disagrees with the header
    /// above it. This is the array the header COUNTS, so folding a parent lowers the number by
    /// exactly the rows it stopped drawing.
    static func drawn(_ band: Band, shut: Set<Int>) -> [Drawn] {
        drawn(band.roots, shut: shut).map { drawn in
            var stated = drawn
            let agrees = key(drawn.row.priority) == key(band.priority)
            stated.odd = agrees ? nil : drawn.row.priority
            return stated
        }
    }

    /// What two priority words are compared by. A tracker spelling one `High` must not open a
    /// second band beside the `high` one, headed with the same word.
    private static func key(_ word: String?) -> String? {
        word?.lowercased()
    }
}
