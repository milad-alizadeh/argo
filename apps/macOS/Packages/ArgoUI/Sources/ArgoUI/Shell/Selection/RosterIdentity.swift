/// One roster row as reconciliation reads it (#1481): the id it is published under, the ids it has
/// retired, and whether the reader would have to open the archive to see it.
///
/// On ids alone reconciliation cannot tell a Session that ENDED from one whose row changed the id
/// it is published under, and the second is the common case — see `HubSession.absorbedIDs`.
struct RosterIdentity: Equatable {
    let id: CockpitPresentation.Session.ID
    /// Oldest first, in the roster's own key — see `HubSession.absorbedIDs`.
    let absorbedIDs: [CockpitPresentation.Session.ID]
    /// Archived rows are still ON the roster and may still be selected, but they are behind a
    /// disclosure the reader has not opened. Reconciliation will not LAND on one.
    let isArchived: Bool

    init(
        _ id: CockpitPresentation.Session.ID,
        absorbing absorbedIDs: [CockpitPresentation.Session.ID] = [],
        isArchived: Bool = false,
    ) {
        self.id = id
        self.absorbedIDs = absorbedIDs
        self.isArchived = isArchived
    }
}

extension CockpitPresentation.Session {
    /// What reconciliation reads this row as. A projection rather than a stored field: the row is
    /// what the shell renders, and this is the one question asked of it that is about ids alone.
    var identity: RosterIdentity {
        RosterIdentity(id, absorbing: absorbedIDs, isArchived: isArchived)
    }
}
