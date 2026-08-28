import ArgoEngine

/// The write half of the Work Item port, raised (#872). The read half is the poll in
/// `AccountsCoordinator` itself; this is the one act the room raises that goes the other way.
extension AccountsCoordinator {
    /// File a ticket, and answer with the refusal that stopped it — `nil` where it landed.
    ///
    /// Answered rather than reported through an alert: this write's refusal belongs BESIDE the
    /// control that raised it (§4 of the failure spec), which is a sentence in the composer and not
    /// a modal over the window. The derivation is `WorkItemCreator`'s; what is left here is taking
    /// the answer into what the room draws.
    ///
    /// The refresh is on BOTH paths. A landed create was adopted into the ledger and a refused one
    /// recorded the health behind it, and `poll.point` raises the landing whether or not the
    /// Binding moved — so one call puts the new ticket in the room and the fault in the chip.
    func createWorkItem(_ draft: WorkItemDraft) async -> WorkItemWriteError? {
        let refusal = await creator.create(draft, forProject: project?.id)
        await refresh()
        return refusal
    }
}
