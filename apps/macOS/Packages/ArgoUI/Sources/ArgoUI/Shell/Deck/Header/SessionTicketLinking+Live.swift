import ArgoEngine

/// What the tab line's picker offers over a real backlog and a real selection (#1092). In the
/// package rather than on the coordinator for ADR-0022's reason: a derivation in the app target is
/// one no test can reach.
package extension SessionTicketLinking {
    /// The offering for one Session over one read backlog.
    ///
    /// Open tickets only, newest first — a picker is for work in flight, and a closed ticket
    /// offered beside the open ones would invite attaching a Session to work that is finished. The
    /// one exception is the ticket already pinned: it stays on the list wherever it now sits, so a
    /// pin whose ticket closed under it is still something a reader can see and take back.
    ///
    /// With no Session selected there is nothing to attach and the offering is empty — the picker
    /// is not drawn at all, rather than drawn over a selection that does not exist.
    static func over(
        tickets: [Ticket],
        session: CockpitPresentation.Session?,
        link: @escaping (String, Int?) -> Void,
    )
        -> SessionTicketLinking {
        guard let session else { return SessionTicketLinking() }
        let pinned = session.pinnedTicket
        return SessionTicketLinking(
            options: tickets
                .filter { $0.closure == .open || $0.number == pinned }
                .sorted { $0.number > $1.number }
                .map { Option(number: $0.number, title: $0.title) },
            pinned: pinned,
            link: { number in link(session.id, number) },
        )
    }
}
