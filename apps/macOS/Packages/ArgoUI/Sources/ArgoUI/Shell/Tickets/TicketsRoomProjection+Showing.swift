import ArgoEngine

extension TicketsRoomProjection.Room {
    /// The same room, opened on one ticket. The two slots the selection decides, and no other:
    /// everything else is carried across from the remembered room unchanged.
    ///
    /// `unreadNumber` is the number the deck is open on that the listing does not hold, so it is
    /// exactly the case where the detail came back empty (#895) — one branch, said once here.
    ///
    /// Named apart from the room's own `opened`, which is what the VIEW answers about itself
    /// (#1075) and is carried across here like every other field the selection does not decide.
    func showing(_ ticket: TicketsRoomProjection.Detail?, at number: Int?)
        -> TicketsRoomProjection.Room {
        TicketsRoomProjection.Room(
            views: views,
            provider: provider,
            backlog: backlog,
            ticket: ticket,
            unreadNumber: ticket == nil ? number : nil,
            project: project,
            opened: opened,
            nextUp: nextUp,
            narrowing: narrowing,
        )
    }
}
