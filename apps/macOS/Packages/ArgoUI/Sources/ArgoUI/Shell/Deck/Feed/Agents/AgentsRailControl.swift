import SwiftUI

/// The rail as a control, in one value: what the feed is scoped to, whether the rail is collapsed,
/// and the readings a chip can be scoped onto.
///
/// Bindings, because every one of the three is state the deck owns — the rail writes them and the
/// feed beside it reads them, which is what makes selecting an Agent re-scope one feed rather than
/// open a second.
package struct AgentsRailControl {
    @Binding var scope: FeedScope
    /// Held ABOVE the deck's per-Session identity, beside the seam widths: keyed to the Session it
    /// would spring open again on every switch, and a reader who collapsed the rail meant the rail.
    @Binding var isCollapsed: Bool
    var readings = FeedAgentReader.unread
    /// Stop waiting for one delegation's report (#1267), by the delegating call's own id. Inert by
    /// default, which is what a rail drawn outside the shell gets: a specimen states the chips it
    /// wants and has no Session behind them to end anything on.
    var endDelegation: @MainActor @Sendable (String) -> Void = { _ in }

    /// A rail nothing has scoped and nobody can collapse — what a specimen of some other zone gets,
    /// so it draws the rail without holding state for it.
    static let inert = AgentsRailControl(
        scope: .constant(.session),
        isCollapsed: .constant(false),
    )

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(
        scope: Binding<FeedScope>,
        isCollapsed: Binding<Bool>,
        readings: FeedAgentReader = FeedAgentReader.unread,
        endDelegation: @escaping @MainActor @Sendable (String) -> Void = { _ in },
    ) {
        _scope = scope
        _isCollapsed = isCollapsed
        self.readings = readings
        self.endDelegation = endDelegation
    }
}

extension AgentsRailControl {
    /// What selecting one chip does, or `nil` where there is no reading to scope onto.
    ///
    /// Selecting the chip that is already lit scopes back to the Session. Since #1013 that is no
    /// longer the only way back — the rail's Main entry is — but it stays, because taking it away
    /// would break the gesture readers who found it already use.
    @MainActor func select(_ agent: FeedAgent) -> (() -> Void)? {
        guard readings.hasReading(of: agent) else { return nil }
        return { scope = scope.agent == agent.id ? .session : .subagent(agent.id) }
    }

    /// Stop waiting for one Agent's report, or `nil` where there is nothing for the reader to end
    /// (#1267).
    ///
    /// TWO facts, and each of them takes the act away from a chip that would be lying with it. The
    /// chip has to carry an `openDelegationID`, which says three things at once: the call was a
    /// delegation, the record NAMED it, and the host answered it with a launch receipt rather than
    /// leaving the parent blocked inside a synchronous handover. And it must not be one the reader
    /// has already ended, since ending it a second time changes nothing.
    ///
    /// The chip's DOT is deliberately not among them, and that is the correction the review of
    /// #1267 made. `unknown` is the reading the reader is most often looking at — an idle parent
    /// holding an open delegation, which `DelegatingSession` cannot settle (#1269). And `finished`
    /// reaches the chips `DelegationCeiling` quieted at four hours, which is the very state a lost
    /// report ends in: the dot is off and the Session still reads `running`, so a guard on the dot
    /// would take the way out away from exactly the reader who needs it. What the record ANSWERED
    /// is excluded above rather than here — a report landing clears `openDelegationID`.
    @MainActor func end(_ agent: FeedAgent) -> (() -> Void)? {
        guard let callID = agent.openDelegationID, !readings.hasEnded(callID) else { return nil }
        return { endDelegation(callID) }
    }

    /// Back to the Session's own reading, from wherever the feed is scoped.
    func selectSession() {
        scope = .session
    }
}
