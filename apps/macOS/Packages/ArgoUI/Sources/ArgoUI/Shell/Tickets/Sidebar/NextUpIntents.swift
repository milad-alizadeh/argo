/// What the Next-up hero's card DOES (#898).
///
/// One value rather than one closure: the card is the room's answer to "what should I pick up",
/// and #899 puts a second verb on it — starting a Session on the pick. A card that took its one
/// act as a bare parameter would have to be re-shaped to take a second.
///
/// Every verb is addressed BY NUMBER rather than closed over the pick. The card knows which ticket
/// it is drawing; a closure built per pick would be a second place that could be built for a
/// different one.
@MainActor
struct NextUpIntents {
    /// Open the pick in the deck's ticket pane, which is the same act as clicking its backlog row.
    /// It must not move the open view: the hero ranks across the room and the view is a filter the
    /// reader chose, so an open that re-pointed the rail would answer a question nobody asked.
    var open: (Int) -> Void = { _ in }

    /// A card that draws every state and performs none, for a `#Preview` and a specimen.
    static let inert = NextUpIntents()
}
