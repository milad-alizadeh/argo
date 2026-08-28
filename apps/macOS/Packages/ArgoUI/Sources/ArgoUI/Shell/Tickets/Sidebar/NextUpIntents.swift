/// What the Next-up hero's card DOES (#898). One value and not one bare closure, because #899 puts
/// a second verb on this card.
@MainActor
struct NextUpIntents {
    /// Open the pick in the deck's ticket pane, BY NUMBER. It must not move the open view: the hero
    /// ranks across the whole room, so its pick is regularly one the open view does not admit.
    var open: (Int) -> Void = { _ in }

    /// A card that draws every state and performs none, for a `#Preview` and a specimen.
    static let inert = NextUpIntents()
}
