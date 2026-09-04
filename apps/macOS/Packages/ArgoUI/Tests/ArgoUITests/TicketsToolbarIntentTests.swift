@testable import ArgoUI
import Testing

/// The Tickets toolbar's intents, pinned by shape.
///
/// #900 shipped a funnel over `narrowing`, which `ticketsIntents` never assigned, so the app bound
/// a live-looking mark to `{}` — and no test could see it, because both `#Preview`s constructed the
/// control with the same empty defaults the app was passing.
///
/// What holds now is mostly the compiler: `ArgoIconButton.act` has no default, so a mark cannot be
/// drawn without an act written at its call site, and `BacklogMenu`'s one row is a `Text` rather
/// than a `Button` because there is no choice to offer. This suite covers what the compiler cannot
/// — that a slot cannot be ADDED to the intents unnoticed. It is a change detector by design: the
/// green fix is one line here, and writing it means opening `ticketsIntents` and saying what
/// assigns the slot.
@Suite("Tickets toolbar intents")
@MainActor
struct TicketsToolbarIntentTests {
    /// Every slot, and all three are assigned in `ticketsIntents`.
    static let slots: Set<String> = ["creation", "verbs"]

    @Test
    func `the intents carry no slot the shell leaves unassigned`() {
        let found = Mirror(reflecting: TicketsToolbarIntents.inert).children.compactMap(\.label)

        #expect(Set(found) == Self.slots)
    }

    /// `Verbs`' two link closures are OPTIONAL rather than empty, which is the shape #872 chose for
    /// absent behaviour: a control that cannot act disables rather than drawing live and swallowing
    /// the press. Asserted as a set, so a fourth verb added beside them has to be looked at.
    @Test
    func `the nested groups carry the slots their controls read`() {
        let creation = Mirror(reflecting: TicketsToolbarIntents.Creation()).children
            .compactMap(\.label)
        #expect(Set(creation) == ["act", "control", "reconnect"])

        let verbs = Mirror(reflecting: TicketsToolbarIntents.Verbs.inert).children
            .compactMap(\.label)
        #expect(Set(verbs) == ["start", "command", "openOnHost", "copyLink"])
    }

    /// The list's vessel takes no act at all now: its stored properties are what a caller could
    /// hand it, and there is nothing left to hand.
    @Test
    func `the list's own vessel takes no act`() {
        #expect(Mirror(reflecting: BacklogControls()).children.isEmpty)
    }
}
