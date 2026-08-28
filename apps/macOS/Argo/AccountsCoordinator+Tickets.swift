import ArgoEngine

/// The Ticket acts a room raises ONE AT A TIME — a write (#872), and the by-number read behind a
/// followed link (#895). The repeating read is the poll in `AccountsCoordinator` itself.
extension AccountsCoordinator {
    /// File a ticket, and answer with the refusal that stopped it — `nil` where it landed.
    func createTicket(_ draft: TicketDraft) async -> TicketWriteError? {
        let refusal = await ticketCreator.create(draft, forProject: project?.id)
        // On both paths: a landed create was adopted into the ledger, a refused one recorded the
        // health behind it, and `poll.point` raises the landing whether or not the Binding moved.
        await refresh()
        return refusal
    }

    /// Read ONE ticket by the number a link named (#895). `refresh` is what publishes it, for the
    /// reason `createTicket` above ends there too.
    func readTicket(_ number: Int) async {
        await TicketFollower(bindings: bindings, items: ticketLedger, health: health)
            .follow(number, forProject: project?.id)
        await refresh()
    }
}
