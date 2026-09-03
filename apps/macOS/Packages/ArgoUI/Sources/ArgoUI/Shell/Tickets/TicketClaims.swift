import ArgoEngine

/// The claim join as the views take it (#894, #1074): which tickets live Sessions hold, and how
/// many live Sessions the join could not place.
package struct TicketClaims: Equatable, Sendable {
    /// One live Session named well enough to route to (#1092) — a claim's identity, and not only
    /// its count.
    package struct Claimant: Equatable, Sendable, Identifiable {
        package let id: CockpitPresentation.Session.ID
        package let name: String

        /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
        package init(id: CockpitPresentation.Session.ID, name: String) {
            self.id = id
            self.name = name
        }
    }

    /// The tickets placed, keyed to who placed them. The sidebar's `numbers` and a backlog row's
    /// mark read the KEYS of this same value — see `numbers` below — so the mark, the count and the
    /// head's claimant can never disagree about which tickets are claimed.
    package let claimants: [Int: [Claimant]]
    /// Live Sessions that named no ticket, so `numbers` is short by this many. The count is still
    /// printed and states this beside it (#1074).
    package var unplaced = 0
    /// Live Sessions nobody could have read a link for at all. This is what takes the count
    /// ABSENT: no join happened, so there is no partial answer to state.
    package var unread = 0

    /// The tickets placed, off `claimants`' own keys — a computed reading rather than a second
    /// stored set, so the two can never drift (#1092).
    package var numbers: Set<Int> {
        Set(claimants.keys)
    }

    /// Whether the claim ground was read at all. One `unread` Session sinks it: with nothing to
    /// link TO, "n tickets are claimed" is a number off a join that never happened.
    var wasRead: Bool {
        unread == 0
    }

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(claimants: [Int: [Claimant]], unplaced: Int = 0, unread: Int = 0) {
        self.claimants = claimants
        self.unplaced = unplaced
        self.unread = unread
    }

    /// A set with no claimant named — every fixture and test that asks only WHICH tickets are
    /// claimed, never WHO. Real data never takes this path: `init(over:)` below always names one.
    package init(numbers: Set<Int>, unplaced: Int = 0, unread: Int = 0) {
        self.init(
            claimants: Dictionary(uniqueKeysWithValues: numbers.map { ($0, []) }),
            unplaced: unplaced,
            unread: unread,
        )
    }
}

extension TicketClaims {
    /// The join over the live Sessions holding a claim — the one place a Session's link reading
    /// and its identity are mapped onto the claimants a ticket's head and a backlog row both read.
    ///
    /// One exhaustive `switch` over the reading and no `default`, so a fourth reading fails to
    /// compile here rather than being counted nowhere.
    init(over sessions: [CockpitPresentation.Session]) {
        var placed: [Int: [Claimant]] = [:]
        var short = 0
        var blind = 0
        for session in sessions {
            switch session.ticket {
            case let .linked(issue):
                placed[issue.number, default: []]
                    .append(Claimant(id: session.id, name: SessionTitle.resolved(for: session)))
            case .unlinked: short += 1
            case .unread: blind += 1
            }
        }
        self.claimants = placed
        self.unplaced = short
        self.unread = blind
    }
}
