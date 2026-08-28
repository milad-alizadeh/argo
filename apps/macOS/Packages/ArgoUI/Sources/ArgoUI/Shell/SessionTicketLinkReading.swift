import ArgoEngine

public extension CockpitPresentation.Session {
    /// Which Ticket a Session is on, as a READING rather than an absence (#894).
    ///
    /// One `nil` used to fold two different answers together — nobody could have read a link, and
    /// nothing named one — so a reader could not tell which they were looking at, or whether there
    /// was anything to repair. Three cases, on the pattern `TicketsRoom.Vacancy` already sets.
    enum TicketLinkReading: Equatable, Sendable {
        /// No Ticket provider is bound, so nobody could have read a link at all. Never `unlinked`:
        /// with nothing to link TO, "this Session is on no ticket" is a claim Argo has no ground
        /// for (`CONTEXT.md` degrade-down).
        case unread
        /// A provider is bound and nothing named a Ticket for this Session. The state
        /// `docs/agents/worktrees.md`'s branch naming exists to prevent, and the one a reader
        /// repairs by cutting a branch that says which ticket the work is.
        case unlinked
        /// The link, carrying the tier that produced it — DIRECT from the spawn, DERIVED off the
        /// branch, and never rendered as each other.
        case linked(Issue)
    }
}

extension CockpitPresentation.Session.TicketLinkReading {
    /// The reading a link and a bound provider make between them. No link is two different
    /// answers, and the Binding is the only thing that tells them apart.
    init(link: CockpitPresentation.Session.Issue?, isProviderBound: Bool) {
        guard let link else {
            self = isProviderBound ? .unlinked : .unread
            return
        }
        self = .linked(link)
    }

    /// The link where there is one — what every surface that draws only a link asks.
    var link: CockpitPresentation.Session.Issue? {
        switch self {
        case .unread, .unlinked: nil
        case let .linked(issue): issue
        }
    }

    /// Whether a link was READ, which is a different question from whether there is one: a
    /// Session Argo could not join is the reason `In progress` counts absent rather than short.
    var isRead: Bool {
        switch self {
        case .unread, .unlinked: false
        case .linked: true
        }
    }
}
