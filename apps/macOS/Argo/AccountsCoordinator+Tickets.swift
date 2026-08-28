import ArgoEngine

/// The write half of the Ticket port, raised (#872). The read half is the poll in
/// `AccountsCoordinator` itself.
extension AccountsCoordinator {
    /// File a ticket, and answer with the refusal that stopped it — `nil` where it landed.
    func createTicket(_ draft: TicketDraft) async -> TicketWriteError? {
        let refusal = await ticketCreator.create(draft, forProject: project?.id)
        // On both paths: a landed create was adopted into the ledger, a refused one recorded the
        // health behind it, and `poll.point` raises the landing whether or not the Binding moved.
        await refresh()
        return refusal
    }
}
