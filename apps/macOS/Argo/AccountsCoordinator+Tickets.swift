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

    /// Apply one intent to an existing ticket — closing it or reopening it (#1333) — and answer
    /// with the refusal that stopped it, on the same terms as `createTicket` above.
    func applyTicket(_ intent: TicketIntent, to number: Int) async -> TicketWriteError? {
        let refusal = await ticketCreator.apply(intent, to: number, forProject: project?.id)
        await refresh()
        return refusal
    }

    /// Make one of the reads a room raises — a link followed by number (#895), a page of the closed
    /// listing (#1075). `refresh` is what publishes the answer, for the reason `createTicket` above
    /// ends there too.
    ///
    /// One method for all of them, and it stays one as reads are added: which read this is, and
    /// what each of them keeps, are `TicketReads`' — where a test can reach them (ADR-0022).
    func read(_ read: TicketRead) async {
        let ledgers = TicketPoll.Ledgers(health: health, items: ticketLedger)
        await TicketReads(bindings: bindings, ledgers: ledgers)
            .perform(read, forProject: project?.id)
        await refresh()
    }
}
