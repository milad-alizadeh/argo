import ArgoEngine

/// Where each sequenced ticket sits, built ONCE for a ranking pass — the hero's `PRD sequence` key,
/// indexed rather than searched.
///
/// Asking each ranked item which chart holds it walked every chart's children for every item:
/// `O(pool × items)` for an answer the listing states in one pass over itself (ADR-0028 Rule 1).
///
/// Its own file, and its index `private`, for `TicketsListing`'s reason (ADR-0028, #1070): the
/// counted lookup below is the only door to a placement, so a pass that went back to searching
/// would have to be written somewhere the tally cannot see rather than beside the one that reports.
@MainActor
struct TicketChartPlaces {
    private let places: [Int: TicketChartPlace]

    /// The FIRST chart to claim a number keeps it, which is the answer the search gave: it stopped
    /// at the first chart holding the number, in the provider's own order.
    init(of items: [Ticket]) {
        var built: [Int: TicketChartPlace] = [:]
        var walked = 0
        for (chart, parent) in items.enumerated() where parent.isChartShaped {
            for (child, number) in parent.children.enumerated() {
                walked += 1
                guard built[number] == nil else { continue }
                built[number] = TicketChartPlace(chart: chart, child: child)
            }
        }
        TicketsRoomTally.placed(walked)
        self.places = built
    }

    /// Where this ticket is sequenced, at one lookup, and absent for a ticket in no chart.
    func place(of number: Int) -> TicketChartPlace? {
        TicketsRoomTally.placed(1)
        return places[number]
    }
}

/// Where a chart holds a ticket — both indices, and both the PROVIDER's own author order: the order
/// it served its charts in, which is the order `CHARTS` draws, and the order it served that chart's
/// `children` in.
///
/// Two indices and not one, so a ticket is never ranked against one in another chart by its
/// position alone: nobody sequenced two PRDs against each other, but the provider did serve one
/// before the other, and that is a fact rather than an invention.
///
/// Absent for a ticket in no chart, which sorts BEHIND every ticket in one: a PRD's sequence is
/// somebody stating an order, and an unsequenced ticket does not overtake one on a statement nobody
/// made.
struct TicketChartPlace: Equatable {
    let chart: Int
    let child: Int
}
