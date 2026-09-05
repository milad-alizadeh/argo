import ArgoEngine

/// What a backlog row's right-click menu offers, and what pressing an item does (#1247).
///
/// The two capability facts are declared rather than discovered: a provider that writes no
/// transition draws no **Mark as**, and one that cannot delete draws no **Delete**. A control
/// offered and then refused is the affordance ADR-0014 exists to rule out.
package struct BacklogSelectionActs {
    /// The states **Mark as** offers, in the order work moves through them. Empty where this
    /// provider expresses none, which is also where the submenu is absent.
    var states: [TicketCanonicalState] = []
    /// Whether this provider deletes at all.
    var deletes = false
    /// Write one state to every Ticket named.
    var mark: @MainActor ([Int], TicketCanonicalState) -> Void = { _, _ in }
    /// Remove every Ticket named.
    var delete: @MainActor ([Int]) -> Void = { _ in }

    /// What a menu opened on this row acts on: the whole selection when the row is in it, and
    /// that row alone when it is not (`RowSelection.aim`). Sorted, because a set has no order and
    /// a batch reported back has to name its Tickets in one.
    func targets(of row: Int, in selection: RowSelection<Int>) -> [Int] {
        selection.aim(at: row).sorted()
    }

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(
        states: [TicketCanonicalState] = [],
        deletes: Bool = false,
        mark: @escaping @MainActor ([Int], TicketCanonicalState) -> Void = { _, _ in },
        delete: @escaping @MainActor ([Int]) -> Void = { _ in },
    ) {
        self.states = states
        self.deletes = deletes
        self.mark = mark
        self.delete = delete
    }
}
