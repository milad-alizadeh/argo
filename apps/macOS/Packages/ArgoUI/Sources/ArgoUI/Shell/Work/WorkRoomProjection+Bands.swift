/// The backlog's top-level structure: priority over the ROOTS (#819).
///
/// Nesting and priority grouping cannot both be the structure — a child's priority is its own, and
/// one parent's children scatter across all three bands. The design resolves it by banding the
/// roots alone and letting a child hang under its parent whatever its own priority is. So a header
/// can stand over rows that disagree with it, and where one does the ROW says so — the header never
/// speaks for it (`cockpit-work-room.md` — the one conflict, and how it resolves).
extension WorkRoomProjection {
    /// One priority band and the roots under it.
    struct Band: Sendable, Equatable, Identifiable {
        /// The provider's own word, verbatim, and absent where nothing was read. Argo neither
        /// ranks these nor recases them.
        let priority: String?
        let roots: [Row]

        /// Stable across a re-derive, and distinct from every word a provider could serve: the
        /// unread band's key is the one string a priority word cannot be.
        var id: String {
            priority ?? ""
        }

        /// What the header reads. `GroupLabel` uppercases, so this is spelled in the provider's own
        /// case — and the unread band names the TIER rather than claiming the tracker set none.
        var label: String {
            priority ?? "no priority read"
        }
    }

    /// The three words the design draws headers for, in the order they stand. MATCHED, never
    /// ranked (`WorkReading+NextUp` matches `high` the same way): Argo has no ladder, so a word it
    /// has no band for keeps a header of its own rather than being sorted into one of these.
    private static let bandOrder = ["high", "medium", "low"]

    /// The roots banded. The three known words first, then any other word in the order the provider
    /// served it, and the roots nobody read a priority for LAST — a row lost to a missing fact
    /// would be the worse failure, so the unread ones keep a header rather than a band.
    static func bands(of roots: [Row]) -> [Band] {
        var order: [String?] = bandOrder.filter { word in
            roots.contains { $0.priority == word }
        }
        for root in roots where root.priority != nil && !order.contains(root.priority) {
            order.append(root.priority)
        }
        if roots.contains(where: { $0.priority == nil }) {
            order.append(nil)
        }
        return order.map { word in
            Band(priority: word, roots: roots.filter { $0.priority == word })
        }
    }

    /// One band's rows in draw order, each told whether its own priority disagrees with the header
    /// above it. This is the array the header COUNTS, so folding a parent lowers the number by
    /// exactly the rows it stopped drawing.
    static func drawn(_ band: Band, shut: Set<Int>) -> [Drawn] {
        drawn(band.roots, shut: shut).map { drawn in
            var stated = drawn
            stated.odd = drawn.row.priority == band.priority ? nil : drawn.row.priority
            return stated
        }
    }
}
