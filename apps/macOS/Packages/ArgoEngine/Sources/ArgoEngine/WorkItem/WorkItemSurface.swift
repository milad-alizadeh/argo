import Foundation

/// What an adapter DECLARES it can be asked for — the Work Item port's static capability
/// descriptor (`CONTEXT.md` → Ports, #167).
///
/// Read before a control is drawn, never after a write is refused: a capability decides whether an
/// affordance EXISTS, and per-fact `unknown` decides what a present one shows (ADR-0014).
public struct WorkItemSurface: Equatable, Sendable {
    /// The writes this adapter performs. Anything absent is refused before the wire.
    public let writes: Set<WorkItemWrite>

    /// The canonical states this adapter can EXPRESS. A bare tracker reaches `todo`, `done` and
    /// `closed` through open-and-closed and can say nothing about the two in between.
    public let states: Set<WorkItemCanonicalState>

    public init(writes: Set<WorkItemWrite>, states: Set<WorkItemCanonicalState>) {
        self.writes = writes
        self.states = states
    }

    public func offers(_ write: WorkItemWrite) -> Bool {
        writes.contains(write)
    }

    /// Whether a transition to this state is worth offering. False both where transitions are not
    /// written at all and where this particular state cannot be expressed.
    public func expresses(_ state: WorkItemCanonicalState) -> Bool {
        offers(.transition) && states.contains(state)
    }
}
