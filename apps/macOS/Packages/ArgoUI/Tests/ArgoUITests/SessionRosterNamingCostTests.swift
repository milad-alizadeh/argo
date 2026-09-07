import ArgoEngine
@testable import ArgoUI
import Testing

/// What naming a roster COSTS the surfaces that draw off it, in whole-roster passes (ADR-0028 Rule
/// 8): a count and never the milliseconds, because a count is exactly the same idle and loaded.
///
/// The claim is ONE pass per roster, shared, and none at all on a pass the roster did not move in
/// (#1557). The last case is the other half and the one that matters more: a pass shared is a pass
/// that must still be retaken the moment a title's answer could differ.
///
/// The counter is one `@MainActor` global, and other suites reach the same memo. Every body below
/// is SYNCHRONOUS, which is what makes a count safe: a synchronous body on the main actor runs from
/// its `forget()` to its `#expect` without a suspension point, so nothing else can bump the tally
/// in between.
@Suite("Session roster naming cost", .serialized)
@MainActor
struct SessionRosterNamingCostTests {
    /// The user's complaint, counted: both surfaces draw, one pass is taken.
    @Test
    func `the sidebar and the deck header share one naming pass`() {
        SessionRosterNamingMemo.forget()
        let sessions = Self.roster

        _ = RosterListing().reading(of: sessions)
        _ = SessionRosterProjection.namedTitle(for: "one", among: sessions)

        #expect(SessionRosterNamingMemo.cost.passes == 1)
    }

    /// `CockpitView.body` re-runs on any of its own state changes as well as on every presentation
    /// the Hub publishes, so a keystroke in the composer redraws both surfaces over a roster that
    /// did not move. It costs nothing.
    @Test
    func `a repeat pass over the same roster names nothing again`() {
        SessionRosterNamingMemo.forget()
        let sessions = Self.roster

        for _ in 0 ..< 4 {
            _ = RosterListing().reading(of: sessions)
            _ = SessionRosterProjection.namedTitle(for: "one", among: sessions)
        }

        #expect(SessionRosterNamingMemo.cost.passes == 1)
    }

    /// The key is answered by the roster's own storage while the shell hands the same published
    /// array every pass — which it does. A caller that started rebuilding the array would make
    /// every pass an element-by-element walk of the whole roster, and this is what sees that
    /// rather than letting it pass quietly — so the charge is asserted BOTH ways: the second half
    /// is what says the counter is wired to anything at all.
    @Test
    func `a repeat pass walks no Session to answer the key, and a rebuilt roster walks them all`() {
        SessionRosterNamingMemo.forget()
        let sessions = Self.roster

        _ = RosterListing().reading(of: sessions)
        _ = RosterListing().reading(of: sessions)
        #expect(SessionRosterNamingMemo.cost.compared == 0)

        // The same Sessions in a buffer of their own: equal, so the pass is still shared, and paid
        // for by a walk of every row.
        _ = RosterListing().reading(of: sessions.map(\.self))

        #expect(SessionRosterNamingMemo.cost.compared == sessions.count)
        #expect(SessionRosterNamingMemo.cost.passes == 1)
    }

    /// The half a shared pass may not break: a roster that MOVED is named again. Two rows on one
    /// Ticket each take their derived name (#1072); take one away and the survivor is the only row
    /// the Ticket names, so it spends the Ticket's words — and a memo holding the first answer
    /// would leave the header drawing a title no row has.
    @Test
    func `a roster that moved is named again, and the title moves with it`() {
        SessionRosterNamingMemo.forget()
        let rivals = Self.roster

        let contested = SessionRosterProjection.namedTitle(for: "one", among: rivals)
        let alone = SessionRosterProjection.namedTitle(for: "one", among: [rivals[0]])

        #expect(contested == "Write a caption for one folder")
        #expect(alone == "Rough atlas for Argo itself")
        #expect(SessionRosterNamingMemo.cost.passes == 2)
    }

    /// Two Sessions on one Ticket, which is the roster whose titles depend on the whole list.
    private static let roster = [
        RosterSessionFixture.session(
            id: "one", title: "Write a caption for one folder", ticket: .linked(atlas),
        ),
        RosterSessionFixture.session(
            id: "two", title: "These two files change together", ticket: .linked(atlas),
        ),
    ]

    private static let atlas = CockpitPresentation.Session
        .Issue(number: 650, title: "Rough atlas for Argo itself")
}
