import ArgoEngine

/// The claim join as the views take it (#894, #1074): which tickets live Sessions hold, and how
/// many live Sessions the join could not place.
package struct TicketClaims: Equatable, Sendable {
    /// The tickets placed. The sidebar counts these and a backlog row marks itself off the same
    /// set, so the mark and the count cannot disagree about which tickets are claimed.
    package let numbers: Set<Int>
    /// Live Sessions that named no ticket, so `numbers` is short by this many. The count is still
    /// printed and states this beside it (#1074).
    package var unplaced = 0
    /// Live Sessions nobody could have read a link for at all. This is what takes the count
    /// ABSENT: no join happened, so there is no partial answer to state.
    package var unread = 0

    /// Whether the claim ground was read at all. One `unread` Session sinks it: with nothing to
    /// link TO, "n tickets are claimed" is a number off a join that never happened.
    var wasRead: Bool {
        unread == 0
    }

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(numbers: Set<Int>, unplaced: Int = 0, unread: Int = 0) {
        self.numbers = numbers
        self.unplaced = unplaced
        self.unread = unread
    }
}

extension TicketClaims {
    /// The join over the live Sessions' own link readings — the one place the three readings are
    /// mapped onto the two numbers.
    ///
    /// One exhaustive `switch` and no `default`, so a fourth reading fails to compile here rather
    /// than being counted nowhere.
    init(over readings: [CockpitPresentation.Session.TicketLinkReading]) {
        var placed: Set<Int> = []
        var short = 0
        var blind = 0
        for reading in readings {
            switch reading {
            case let .linked(issue): placed.insert(issue.number)
            case .unlinked: short += 1
            case .unread: blind += 1
            }
        }
        self.numbers = placed
        self.unplaced = short
        self.unread = blind
    }
}
