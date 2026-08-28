import ArgoEngine

/// What the Next-up hero's card DOES (#898, #899). One value and not one bare closure, because the
/// card carries two verbs and the second of them has a reading beside it.
@MainActor
struct NextUpIntents {
    /// Open the pick in the deck's ticket pane, BY NUMBER. It must not move the open view: the hero
    /// ranks across the whole room, so its pick is regularly one the open view does not admit.
    var open: (Int) -> Void = { _ in }

    /// Start a Session on the pick, BY NUMBER, on the same terms the room's toolbar Start does
    /// (#899) — it goes to the Sessions room, which is where the work it began can be seen.
    var start: (Int) -> Void = { _ in }

    /// Which command that Start will send, so the card can say it before it is pressed. `nil` is a
    /// pick that asks for none, and the control says `Start` alone.
    var command: (Int) -> WorkCommand? = { _ in nil }

    /// A card that draws every state and performs none, for a `#Preview` and a specimen.
    static let inert = NextUpIntents()
}
