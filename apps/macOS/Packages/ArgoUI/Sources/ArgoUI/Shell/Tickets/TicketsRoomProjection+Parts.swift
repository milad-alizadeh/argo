import ArgoEngine

extension TicketsRoomProjection {
    /// The four views, counted over the whole open set — never over the view on screen, or opening
    /// `Blocked` would leave every other count reading its own filter back.
    ///
    /// `Unblocked` and `Blocked` partition the open set and always sum to `All open`
    /// (`cockpit-work-room.md`), so the pair can only be counted where EVERY open ticket's edges
    /// were read. `In progress` is the same rule over the other join: it can only be counted where
    /// every live Session's own link was read (#894). Where one was not, the count is absent
    /// rather than short — a number that has silently dropped what nobody could ask about is worse
    /// than no number.
    static func views(of open: [Ticket], claims: TicketClaims) -> [ViewReading] {
        let edged = open.allSatisfy { $0.blockage != .unread }
        return TicketsView.allCases.map { view in
            guard view.ground.isRead(edges: edged, claims: claims.areWhole) else {
                return ViewReading(id: view, count: nil)
            }
            return ViewReading(
                id: view,
                count: items(of: open, in: view, claimed: claims.numbers).count,
            )
        }
    }

    /// The open items one view holds. The list and the count beside it both come through here.
    static func items(of open: [Ticket], in view: TicketsView, claimed: Set<Int>) -> [Ticket] {
        open.filter { view.admits($0, claimed: claimed.contains($0.number)) }
    }

    /// The parent's `n/m`, over the TRACKER's children rather than the rows drawn under it.
    static func rollUp(of item: Ticket, closed: Set<Int>) -> String? {
        guard !item.children.isEmpty else { return nil }
        return "\(item.children.filter(closed.contains).count)/\(item.children.count)"
    }
}
