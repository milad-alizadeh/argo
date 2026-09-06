/// One roster row as reconciliation reads it: the id it is published under, and the ids it has
/// absorbed (#1481).
///
/// Reconciliation used to be handed ids alone, and on those it cannot tell a Session that ENDED
/// from one whose row changed the id it is published under. The second is the common case — a
/// resume file read before its origin stands as a Session of its own, and the sweep that finds the
/// origin folds it in (`HubJoinPublishable`) — and reading it as a departure is what moved the
/// reader off the Session they were on.
///
/// A bare string literal is a row that has absorbed nothing, which is every row of a roster with no
/// chains in it.
struct RosterIdentity: Equatable, ExpressibleByStringLiteral {
    let id: CockpitPresentation.Session.ID
    /// Oldest first, in the roster's own key — see `HubSession.absorbedIDs`.
    let absorbedIDs: [CockpitPresentation.Session.ID]

    init(_ id: CockpitPresentation.Session.ID, absorbing absorbedIDs: [CockpitPresentation.Session.ID] = []) {
        self.id = id
        self.absorbedIDs = absorbedIDs
    }

    init(stringLiteral id: String) {
        self.init(id)
    }
}

extension CockpitPresentation.Session {
    /// What reconciliation reads this row as. A projection rather than a stored field: the row is
    /// what the shell renders, and this is the one question asked of it that is about ids alone.
    var identity: RosterIdentity {
        RosterIdentity(id, absorbing: absorbedIDs)
    }
}
