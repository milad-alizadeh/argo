@testable import ArgoUI
import Testing

/// The Tickets room's intents, pinned by shape.
///
/// #900 shipped a funnel over `narrowing`, which `ticketsIntents` never assigned, so the app bound
/// a live-looking mark to `{}` — and no test could see it, because both `#Preview`s constructed the
/// control with the same empty defaults the app was passing.
///
/// What holds now is mostly the compiler: `ArgoIconButton.act` has no default, so a mark cannot be
/// drawn without an act written at its call site. This suite covers what the compiler cannot
/// — that a slot cannot be ADDED to the intents unnoticed. It is a change detector by design: the
/// green fix is one line here, and writing it means opening `ticketsIntents` and saying what
/// assigns the slot.
@Suite("Tickets chrome intents")
@MainActor
struct TicketsChromeIntentTests {
    /// Every slot, and all three are assigned in `ticketsIntents`.
    static let slots: Set<String> = ["creation", "verbs"]

    @Test
    func `the intents carry no slot the shell leaves unassigned`() {
        let found = Mirror(reflecting: TicketsChromeIntents.inert).children.compactMap(\.label)

        #expect(Set(found) == Self.slots)
    }

    /// The open ticket's verbs, which #1242 cut to three: the word's act, the command it says, and
    /// starting on a command the reader picked instead. Asserted as a set, so a fourth added beside
    /// them has to be looked at.
    @Test
    func `the nested groups carry the slots their controls read`() {
        let creation = Mirror(reflecting: TicketsChromeIntents.Creation()).children
            .compactMap(\.label)
        #expect(Set(creation) == ["act", "control", "reconnect"])

        let verbs = Mirror(reflecting: TicketsChromeIntents.Verbs.inert).children
            .compactMap(\.label)
        #expect(Set(verbs) == ["start", "command", "startOn"])
    }
}
