import ArgoEngine

extension TicketsRoomProjection {
    /// The four views, counted over the whole open set — never over the view on screen, or opening
    /// `Blocked` would leave every other count reading its own filter back.
    ///
    /// `Unblocked` and `Blocked` partition the open set and always sum to `All open`
    /// (`cockpit-work-room.md`), so the pair can only be counted where EVERY open ticket's edges
    /// were read. `In progress` rests on the other join, and #1074 split what "read" means there:
    /// a live Session nobody could read a link FOR takes the count absent, because no join
    /// happened; a live Session that named no ticket leaves it SHORT, and the view carries how
    /// short beside the number.
    static func views(of open: [Ticket], claims: TicketClaims) -> [ViewReading] {
        let edged = open.allSatisfy { $0.blockage != .unread }
        return TicketsView.allCases.map { view in
            guard view.ground.isRead(edges: edged, claims: claims.wasRead) else {
                return ViewReading(id: view, count: nil)
            }
            return ViewReading(
                id: view,
                count: items(of: open, in: view, claimed: claims.numbers).count,
                unplaced: view.ground == .claims ? claims.unplaced : 0,
            )
        }
    }

    /// The open items one view holds. The list and the count beside it both come through here.
    static func items(of open: [Ticket], in view: TicketsView, claimed: Set<Int>) -> [Ticket] {
        open.filter { view.admits($0, claimed: claimed.contains($0.number)) }
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
