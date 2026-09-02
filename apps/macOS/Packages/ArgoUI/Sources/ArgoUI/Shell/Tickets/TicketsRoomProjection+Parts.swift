import ArgoEngine

extension TicketsRoomProjection {
    /// The two sets the room's views are defined over, split ONCE (#1075) — the provider's open
    /// listing, and the bounded closed one where it has been read.
    ///
    /// Split here rather than per view, so the closed set cannot leak into a reading defined over
    /// the open one: `nextUp`, `hasItems` and the four original counts all take `open` and have no
    /// way to reach the rest.
    struct Sets: Sendable {
        let open: [Ticket]
        /// The closed LISTING in the order the provider served it, and empty where nothing has been
        /// read. Empty is not the same as unread — `closedWasRead` below carries that, and the
        /// count is zero over the first and absent over the second.
        let closed: [Ticket]
        let claims: TicketClaims
        /// Whether the closed read has ANSWERED, which is what the fifth count rests on.
        let closedWasRead: Bool

        /// The two sets as the provider's items divide, plus what Argo alone knows about them.
        static func of(_ reading: TicketsReading) -> Sets {
            Sets(
                open: reading.items.filter { $0.closure == .open },
                // The numbers the closed READ answered with, never every closed ticket in hand: a
                // ticket followed by number (#895) is here for the roll-up and is not the listing.
                //
                // Still closure-checked, and the check is not redundant: a ticket the read
                // answered with can be REOPENED, and `TicketLedger.items(of:)` then serves the
                // poll's fresher open copy under the same number. Membership alone would list it
                // here, counted, drawing no closure word for a closure that was withdrawn.
                closed: reading.items.filter {
                    $0.closure != .open && reading.closedListing?.numbers
                        .contains($0.number) == true
                },
                claims: reading.claims,
                closedWasRead: reading.closedListing != nil,
            )
        }

        /// The items a view is defined over. A `switch` and never a ternary on `.open`: a third
        /// source has to be answered here rather than falling quietly to the closed side.
        func items(for source: TicketsView.Source) -> [Ticket] {
            switch source {
            case .open: open
            case .closed: closed
            }
        }

        /// What each view's count rests on having been read. `edges` is asked of the OPEN set alone
        /// — a closed listing read without edges must not turn `Blocked` absent.
        var reads: TicketsView.Reads {
            TicketsView.Reads(
                edges: open.allSatisfy { $0.blockage != .unread },
                claims: claims.areWhole,
                closedListing: closedWasRead,
            )
        }
    }

    /// The five views, each counted over its OWN set — never over the view on screen, or opening
    /// `Blocked` would leave every other count reading its own filter back.
    ///
    /// `Unblocked` and `Blocked` partition the open set and always sum to `All open`
    /// (`cockpit-work-room.md`), so the pair can only be counted where EVERY open ticket's edges
    /// were read. `In progress` rests on the other join, and #1074 split what "read" means there:
    /// a live Session nobody could read a link FOR takes the count absent, because no join
    /// happened; a live Session that named no ticket leaves it SHORT, and the view carries how
    /// short beside the number. `Closed` is the same rule over a read of its own: absent until the
    /// provider has answered (#1075).
    static func views(of sets: Sets) -> [ViewReading] {
        let reads = sets.reads
        return TicketsView.allCases.map { view in
            guard view.ground.isRead(given: reads) else {
                return ViewReading(id: view, count: nil)
            }
            return ViewReading(
                id: view,
                count: items(of: sets, in: view).count,
                unplaced: view.ground == .claims ? sets.claims.unplaced : 0,
            )
        }
    }

    /// The items one view holds. The list and the count beside it both come through here.
    static func items(of sets: Sets, in view: TicketsView) -> [Ticket] {
        sets.items(for: view.source)
            .filter { view.admits($0, claimed: sets.claims.numbers.contains($0.number)) }
    }

    /// The blockage worth marking on a backlog row, and `nil` where the row marks nothing (#896).
    ///
    /// A nil-returning seam on the pattern of `TicketState.filing(beside:)` (#893): it WITHHOLDS
    /// the fact rather than handing the row a value it would have to know not to draw. Two
    /// different silences reach the same nothing — the provider said the way is clear, and the
    /// provider served no edges at all — and that is correct, because a row that drew either would
    /// be claiming `unblocked` over the second (`CONTEXT.md` L2 · degrade-down).
    static func blockage(of item: Ticket) -> Blockage? {
        guard let standing = item.standingBlockers, standing > 0 else { return nil }
        return Blockage(count: standing, isStranded: item.blockage == .stranded)
    }

    /// The parent's `n/m`, over the TRACKER's children rather than the rows drawn under it.
    static func rollUp(of item: Ticket, closed: Set<Int>) -> String? {
        guard !item.children.isEmpty else { return nil }
        return "\(item.children.filter(closed.contains).count)/\(item.children.count)"
    }
}
