import ArgoEngine

/// The Ticket acts a room raises ONE AT A TIME — a write (#872, #1247, #1333), and the by-number
/// read behind a followed link (#895). The repeating read is the poll in `AccountsCoordinator`
/// itself.
extension AccountsCoordinator {
    /// Apply one write, and answer with the refusal that stopped it — `nil` where it landed.
    ///
    /// One method for all of them, and it stays one as writes are added: which write this is, and
    /// what each of them means, are `TicketWriteAct`'s — where a test can reach the dispatch
    /// (ADR-0022).
    ///
    /// `refresh` is the publish every one of them ends in: a landed create was adopted into the
    /// ledger, a refused one recorded the health behind it, and `poll.point` raises the landing
    /// whether or not the Binding moved.
    func writeTicket(_ write: TicketWriteAct) async -> TicketWriteError? {
        let refusal = await ticketCreator.perform(write, forProject: project?.id)
        await refresh()
        return refusal
    }

    /// Make one of the reads a room raises — a link followed by number (#895), a page of the closed
    /// listing (#1075). `refresh` is what publishes the answer, for the reason the write above
    /// ends there too.
    ///
    /// One method for all of them, on the same terms: which read this is, and what each of them
    /// keeps, are `TicketReads`'.
    func read(_ read: TicketRead) async {
        let ledgers = TicketPoll.Ledgers(health: health, items: ticketLedger)
        await TicketReads(bindings: bindings, ledgers: ledgers)
            .perform(read, forProject: project?.id)
        await refresh()
    }
}
