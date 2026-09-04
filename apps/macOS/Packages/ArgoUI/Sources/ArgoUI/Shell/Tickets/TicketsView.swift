import ArgoDesign

/// One of the backlog's five views (`cockpit-work-room.md` — the sidebar holds views, not
/// tickets). A view's name is WRITTEN rather than inherited from a tracker, which is the whole
/// reason these fit a 280pt rail where ticket titles did not.
package enum TicketsView: String, Sendable, CaseIterable, Identifiable {
    case allOpen
    case unblocked
    case inProgress
    case blocked
    /// The fifth, and the only one not defined over the open set (#1075). It answers "what did I
    /// finish", which the other four cannot: they are filters WITHIN the open set, and a closed
    /// ticket has left it.
    case closed

    package var id: Self {
        self
    }

    var name: String {
        switch self {
        case .allOpen: "All open"
        case .unblocked: "Unblocked"
        case .inProgress: "In progress"
        case .blocked: "Blocked"
        case .closed: "Closed"
        }
    }

    var symbol: String {
        switch self {
        case .allOpen: ArgoSymbol.allOpenView
        case .unblocked: ArgoSymbol.unblockedView
        case .inProgress: ArgoSymbol.inProgressView
        case .blocked: ArgoSymbol.blockedView
        case .closed: ArgoSymbol.closedView
        }
    }

    /// Which SET this view is defined over — and the switch a sixth view cannot get past without
    /// saying (#1075). It is deliberately not derivable from `admits`: a view that inherited a
    /// predicate answering false over the wrong set would read as an empty view rather than as a
    /// mistake.
    enum Source: Equatable, Sendable {
        /// The provider's open listing, which the poll replaces whole on every tick.
        case open
        /// The bounded closed listing, read only when this view is opened.
        case closed
    }

    var source: Source {
        switch self {
        case .allOpen, .unblocked, .inProgress, .blocked: .open
        case .closed: .closed
        }
    }

    /// The order this view's rows stand in, and the second line under the heading states it — a
    /// list ordered one way under a heading naming another is the exact lie that line exists to
    /// prevent (`TicketsChromeProjection`).
    enum Order: Equatable, Sendable {
        /// Highest number first, banded by priority over the roots: the row a reader is looking
        /// for is the one just filed (#819, #892, #1171, #1195).
        case newestNumber
        /// Last touched first, flat. Priority banding and recency cannot both be the list's
        /// structure, and for a set nobody is picking work out of, recency is the question.
        case lastTouched
    }

    var order: Order {
        switch self {
        case .allOpen, .unblocked, .inProgress, .blocked: .newestNumber
        case .closed: .lastTouched
        }
    }

    /// What the heading's middle term names — the grouping in force where there is one, and the
    /// order where the list is flat.
    var grouping: String {
        switch order {
        case .newestNumber: "by priority"
        case .lastTouched: "by last touched"
        }
    }

    /// Whether the list draws the priority headers. False in `Closed`, whose rows are in recency
    /// order: banding them would scatter last week's finished work across three headers.
    var groupsByPriority: Bool {
        order == .newestNumber
    }
}
