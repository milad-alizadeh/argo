@testable import ArgoUI
import Testing

/// The guard #900 leaves behind: every act the Tickets room's toolbar carries is a slot somebody
/// assigns, and every slot that stays inert says why here.
///
/// The funnel failed both. It drew Mail's own filter mark over `narrowing`, which
/// `ticketsIntents` never assigned, so the shipping app bound a live-looking control to `{}` —
/// and no test could see it, because the two `#Preview`s constructed the control with the same
/// empty defaults the app was passing.
///
/// These are `Mirror` assertions rather than counts: a slot added to the intents or to the
/// control fails here until its line is written, which is the sentence the funnel never had.
@Suite("The Tickets toolbar's acts are all accounted for")
@MainActor
struct BacklogControlsTests {
    /// What the shell assigns in `ticketsIntents`, and the one it deliberately does not.
    static let intentSlots: Set<String> = [
        // Inert BY DESIGN: `BacklogMenu` states the grouping in force rather than offering a
        // choice nothing can answer, and it becomes a real choice when a port reads a second thing
        // to group by (#388). Stated on `ticketsIntents`, not just here.
        "grouping",
        // `intents.creation` — the room's one provider-port write.
        "creation",
        // `intents.verbs` — the open ticket's own.
        "verbs",
    ]

    @Test
    func `the toolbar carries no intent the shell leaves unassigned`() {
        let slots = Mirror(reflecting: TicketsToolbarIntents.inert).children.compactMap(\.label)

        #expect(Set(slots) == Self.intentSlots)
        // Said twice on purpose: the set above is what a future slot has to be added to, and this
        // is what #900 was about — a narrowing nothing wrote and nothing read.
        #expect(!slots.contains("narrowing"))
    }

    /// The two nested groups, held to the same rule. `Verbs`' two link closures are OPTIONAL rather
    /// than empty, which is the shape #872 chose for absent behaviour: a control that cannot act
    /// disables rather than drawing live and swallowing the press.
    @Test
    func `every nested intent is assigned, or absent as an optional`() {
        let creation = Mirror(reflecting: TicketsToolbarIntents.Creation()).children
            .compactMap(\.label)
        #expect(Set(creation) == ["act", "control", "reconnect"])

        let verbs = Mirror(reflecting: TicketsToolbarIntents.Verbs.inert).children
            .compactMap(\.label)
        #expect(Set(verbs) == ["start", "command", "openOnHost", "copyLink"])
    }

    /// One mark in the list's vessel, and it is the menu's (#900). A second act appearing here is
    /// the funnel coming back, and it fails until the intent that drives it exists.
    @Test
    func `the list's own vessel holds one act, and the menu owns it`() {
        let acts = Mirror(reflecting: BacklogControls()).children.compactMap(\.label)

        #expect(acts == ["grouping"])
    }
}
