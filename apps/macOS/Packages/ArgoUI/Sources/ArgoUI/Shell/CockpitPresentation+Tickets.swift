import ArgoEngine

/// What the roster says about Tickets — two derivations over the same Sessions, in the package
/// rather than on the coordinator for the reason ADR-0022 gives: a derivation in the app target is
/// one no test can reach.
public extension CockpitPresentation {
    /// The ticket NUMBERS on the roster that carry no title yet. What a resolve is triggered BY, so
    /// a Session appearing on a new branch is read and every ticket already named is left alone.
    var untitledTicketNumbers: Set<Int> {
        Set(sessions.compactMap { $0.ticket.link?.title == nil ? $0.ticket.link?.number : nil })
    }

    /// Which ticket each Session is on, keyed by chain id — what a resolve is performed OVER.
    ///
    /// Every linked Session, titled or not: the resolve replaces the whole set of stored titles,
    /// and one built from the untitled alone would drop the names it was not re-reading.
    var ticketLinks: [String: Int] {
        sessions.reduce(into: [String: Int]()) { links, session in
            guard let number = session.ticket.link?.number else { return }
            links[session.id] = number
        }
    }
}
